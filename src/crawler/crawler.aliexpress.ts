// src/crawler/crawler.aliexpress.ts

import { nanoid } from "nanoid";
import puppeteer, { Browser } from "puppeteer-core";
import { Observable, Observer } from "rxjs";
import { IBaseCrawler } from "./types/base-crawler.interface";
import { CrawledProduct } from "./types/crawler.types";
import { CrawlerEvent, CrawlerEventType } from "./types/crawler-events";

interface ScrapedAliExpressProduct {
	title: string;
	detailPageUrl: string;
	imageUrl: string;
	price: string;
	rating: string;
	reviewCount: string;
	supplier: string;
	moq: string;
	hasTradeAssurance: string;
	hasFreeShipping: string;
}

export class AliExpressCrawler implements IBaseCrawler {
	private readonly SBR_WS_ENDPOINT = process.env.SBR_WS_ENDPOINT;
	private readonly SOURCE = "AliExpress";

	constructor() {
		if (!this.SBR_WS_ENDPOINT) {
			throw new Error("SBR_WS_ENDPOINT environment variable is required");
		}
	}

	/**
	 * Stream products as they are scraped
	 */
	streamSearch(query: string, maxPages: number = 2): Observable<CrawlerEvent> {
		return new Observable((observer: Observer<CrawlerEvent>) => {
			this.executeSearch(query, maxPages, observer).catch((error) => {
				observer.next({
					type: CrawlerEventType.CRAWLER_ERROR,
					source: this.SOURCE,
					error: error.message,
					timestamp: Date.now(),
				});
				observer.complete();
			});
		});
	}

	private async executeSearch(
		query: string,
		maxPages: number,
		observer: Observer<CrawlerEvent>,
	): Promise<void> {
		let totalProducts = 0;

		try {
			console.log(`${this.SOURCE}: Starting search for "${query}"`);

			let currentUrl = await this.getSearchResultsUrl(query);

			for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
				const { data, nextPageUrl } = await this.scrapePage(currentUrl);

				// Emit each product immediately
				for (const rawProduct of data) {
					const product = this.transformProduct(rawProduct);

					observer.next({
						type: CrawlerEventType.PRODUCT,
						source: this.SOURCE,
						product,
						timestamp: Date.now(),
					});

					totalProducts++;
				}

				// Emit page completion event
				observer.next({
					type: CrawlerEventType.PAGE_COMPLETE,
					source: this.SOURCE,
					pageNumber: pageNum,
					productsFound: data.length,
					timestamp: Date.now(),
				});

				if (!nextPageUrl) break;

				currentUrl = nextPageUrl.startsWith("http")
					? nextPageUrl
					: `https://www.aliexpress.com${nextPageUrl}`;

				await this.delay(2000);
			}

			// Emit completion event
			observer.next({
				type: CrawlerEventType.CRAWLER_COMPLETE,
				source: this.SOURCE,
				totalProducts,
				timestamp: Date.now(),
			});

			observer.complete();
		} catch (error) {
			observer.error(error);
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private async openBrowser(): Promise<Browser> {
		return puppeteer.connect({ browserWSEndpoint: this.SBR_WS_ENDPOINT });
	}

	private async getSearchResultsUrl(searchPhrase: string): Promise<string> {
		const browser = await this.openBrowser();
		const page = await browser.newPage();

		try {
			await page.setUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			);

			const searchUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(searchPhrase)}`;

			await page.goto(searchUrl, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});

			await this.delay(7000);

			const url = page.url();
			await browser.close();
			return url;
		} catch (error) {
			await page
				.screenshot({ path: "aliexpress-error-screenshot.png" })
				.catch(() => {});
			await browser.close();
			throw error;
		}
	}

	private async scrapePage(
		url: string,
	): Promise<{ data: ScrapedAliExpressProduct[]; nextPageUrl: string | null }> {
		const browser = await this.openBrowser();
		const page = await browser.newPage();

		try {
			await page.setUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			);

			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
			await this.delay(8000);

			const data = await page.evaluate(() => {
				// AliExpress uses various class names, try multiple selectors
				const allDivs = [...document.querySelectorAll("div")] as HTMLElement[];

				const productCards = allDivs.filter((div) => {
					const hasImage = !!div.querySelector("img");
					const hasLink = !!div.querySelector("a");
					const hasPrice =
						div.textContent?.includes("$") ||
						div.textContent?.includes("US") ||
						!!div.querySelector('[class*="price"]');
					const hasMinHeight = div.offsetHeight > 100;
					const hasMaxHeight = div.offsetHeight < 600; // Exclude large containers
					return (
						hasImage && hasLink && hasPrice && hasMinHeight && hasMaxHeight
					);
				});

				return productCards
					.map((card) => {
						try {
							// Extract title
							let title = "";
							const titleElement =
								(card.querySelector('[class*="title"]') as HTMLElement) ||
								(card.querySelector("h1") as HTMLElement) ||
								(card.querySelector("h3") as HTMLElement) ||
								(card.querySelector("a") as HTMLElement);

							if (titleElement) {
								title = titleElement.innerText?.trim() || "";
							}

							if (!title || title.length < 5) return null;

							// Extract link
							const linkElement = card.querySelector("a");
							const detailLink = linkElement?.getAttribute("href") || "N/A";

							// Extract image
							const imageElement = card.querySelector(
								"img",
							) as HTMLImageElement;
							const imageLink =
								imageElement?.src ||
								imageElement?.getAttribute("data-src") ||
								imageElement?.getAttribute("src") ||
								"N/A";

							// Extract price
							let price = "N/A";
							const priceElements = card.querySelectorAll(
								'[class*="price"], [class*="Price"]',
							);
							for (const el of priceElements) {
								const text = (el as HTMLElement).innerText?.trim();
								if (text && /\$?\s*\d+\.?\d*/.test(text)) {
									price = text;
									break;
								}
							}

							// Extract rating
							const ratingElement =
								card.querySelector('[class*="rating"]') ||
								card.querySelector('[class*="star"]');
							const rating =
								(ratingElement as HTMLElement)?.innerText?.trim() || "N/A";

							// Extract review count
							const reviewElement =
								card.querySelector('[class*="review"]') ||
								card.querySelector('[class*="order"]');
							const reviewCount =
								(reviewElement as HTMLElement)?.innerText?.trim() || "N/A";

							// Extract supplier
							const supplierElement = card.querySelector('[class*="store"]');
							const supplier =
								(supplierElement as HTMLElement)?.innerText?.trim() || "N/A";

							// Extract MOQ (Minimum Order Quantity)
							const moqElement = card.querySelector('[class*="moq"]');
							const moq =
								(moqElement as HTMLElement)?.innerText?.trim() || "N/A";

							// Check for Trade Assurance
							const hasTradeAssurance = card.textContent
								?.toLowerCase()
								.includes("trade assurance")
								? "yes"
								: "no";

							// Check for Free Shipping
							const hasFreeShipping =
								card.textContent?.toLowerCase().includes("free shipping") ||
								card.textContent?.toLowerCase().includes("free delivery")
									? "yes"
									: "no";

							return {
								title,
								detailPageUrl: detailLink,
								imageUrl: imageLink,
								price,
								rating,
								reviewCount,
								supplier,
								moq,
								hasTradeAssurance,
								hasFreeShipping,
							};
						} catch {
							return null;
						}
					})
					.filter(Boolean) as ScrapedAliExpressProduct[];
			});

			// Deduplicate by URL (in case parent/child divs matched the same product)
			const seenUrls = new Set<string>();
			const uniqueData = data.filter((product) => {
				if (seenUrls.has(product.detailPageUrl)) {
					return false;
				}
				seenUrls.add(product.detailPageUrl);
				return true;
			});

			const nextPageUrl = await page.evaluate(() => {
				const nextBtn =
					document.querySelector('a[class*="next"]') ||
					document.querySelector('button[class*="next"]') ||
					document.querySelector('a[aria-label*="next"]');
				return nextBtn && !nextBtn.hasAttribute("disabled")
					? nextBtn.getAttribute("href")
					: null;
			});

			await browser.close();
			return { data: uniqueData, nextPageUrl };
		} catch (error) {
			await page
				.screenshot({ path: `aliexpress-error-page-${Date.now()}.png` })
				.catch(() => {});
			await browser.close();
			throw error;
		}
	}

	private transformProduct(raw: ScrapedAliExpressProduct): CrawledProduct {
		const parsedPrice = this.parsePrice(raw.price);

		// Debug logging for price parsing
		if (raw.price !== "N/A" && !parsedPrice) {
			console.warn(
				`AliExpress: Price parsing failed for "${raw.title}" - raw price: "${raw.price}"`,
			);
		}

		return {
			id: nanoid(),
			title: raw.title,
			price: parsedPrice,
			currency: "USD",
			imageUrl: raw.imageUrl !== "N/A" ? raw.imageUrl : undefined,
			productUrl:
				raw.detailPageUrl !== "N/A"
					? raw.detailPageUrl.startsWith("http")
						? raw.detailPageUrl
						: `https://www.aliexpress.com${raw.detailPageUrl}`
					: undefined,
			source: this.SOURCE,
			rating: this.parseRating(raw.rating),
			reviewCount: this.parseReviewCount(raw.reviewCount),
			supplier: raw.supplier !== "N/A" ? raw.supplier : undefined,
			moq: raw.moq !== "N/A" ? raw.moq : undefined,
			hasTradeAssurance: raw.hasTradeAssurance === "yes",
			hasFreeShipping: raw.hasFreeShipping === "yes",
		};
	}

	private parsePrice(priceString: string): number | undefined {
		if (!priceString || priceString === "N/A") return undefined;

		// Remove currency symbols and text
		// Handles formats like: "$299.99", "US $299.99", "€299.99", "$299.99 - $399.99"
		const cleanedPrice = priceString
			.replace(/[€£¥₹₩₽]/g, "")
			.replace(/USD|EUR|GBP|JPY|AUD|CAD|CNY|INR|CHF|KRW|RUB|US/gi, "")
			.replace(/to|-|–/gi, "")
			.trim();

		// Extract first valid price
		const priceMatches = cleanedPrice.match(
			/\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g,
		);

		if (!priceMatches || priceMatches.length === 0) {
			console.warn(`AliExpress: Failed to parse price from: "${priceString}"`);
			return undefined;
		}

		const parsedPrice = parseFloat(priceMatches[0].replace(/,/g, ""));

		if (isNaN(parsedPrice) || parsedPrice <= 0) {
			console.warn(
				`AliExpress: Invalid price parsed: "${priceString}" -> ${parsedPrice}`,
			);
			return undefined;
		}

		return parsedPrice;
	}

	private parseRating(ratingString: string): number | undefined {
		if (!ratingString || ratingString === "N/A") return undefined;
		const match = ratingString.match(/(\d+\.?\d*)/);
		return match ? parseFloat(match[1]) : undefined;
	}

	private parseReviewCount(countString: string): number | undefined {
		if (!countString || countString === "N/A") return undefined;
		const match = countString.match(/[\d,]+/);
		return match ? parseInt(match[0].replace(/,/g, ""), 10) : undefined;
	}
}
