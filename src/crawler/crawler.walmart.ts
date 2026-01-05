// src/crawler/crawler.walmart.ts

import { nanoid } from "nanoid";
import puppeteer, { Browser } from "puppeteer-core";
import { Observable, Observer } from "rxjs";
import { IBaseCrawler } from "./types/base-crawler.interface";
import { CrawledProduct } from "./types/crawler.types";
import { CrawlerEvent, CrawlerEventType } from "./types/crawler-events";

interface ScrapedWalmartProduct {
	title: string;
	detailPageUrl: string;
	imageUrl: string;
	price: string;
	rating: string;
	reviewCount: string;
	isSponsored: string;
	hasFreeShipping: string;
}

export class WalmartCrawler implements IBaseCrawler {
	private readonly SBR_WS_ENDPOINT = process.env.SBR_WS_ENDPOINT;
	private readonly SOURCE = "Walmart";

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
					: `https://www.walmart.com${nextPageUrl}`;

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
			await page.setViewport({ width: 1920, height: 1080 });

			const searchUrl = `https://www.walmart.com/search?q=${encodeURIComponent(searchPhrase)}`;

			await page.goto(searchUrl, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});

			await this.delay(5000);

			const url = page.url();
			await browser.close();
			return url;
		} catch (error) {
			await page
				.screenshot({ path: "walmart-error-screenshot.png" })
				.catch(() => {});
			await browser.close();
			throw error;
		}
	}

	private async scrapePage(
		url: string,
	): Promise<{ data: ScrapedWalmartProduct[]; nextPageUrl: string | null }> {
		const browser = await this.openBrowser();
		const page = await browser.newPage();

		try {
			await page.setUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			);
			await page.setViewport({ width: 1920, height: 1080 });

			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
			await this.delay(5000);

			const data = await page.evaluate(() => {
				const allDivs = [...document.querySelectorAll("div")] as HTMLElement[];

				const productCards = allDivs.filter((div) => {
					const hasImage = !!div.querySelector("img");
					const hasLink = !!div.querySelector("a");
					const hasPrice =
						div.textContent?.includes("$") ||
						!!div.querySelector('[class*="price"]');
					return hasImage && hasLink && hasPrice;
				});

				return productCards
					.map((card) => {
						try {
							let title = "";
							const titleElement =
								(card.querySelector(
									'[data-automation-id="product-title"]',
								) as HTMLElement) ||
								(card.querySelector(
									'span[data-automation-id="product-title"]',
								) as HTMLElement) ||
								(card.querySelector("a[href*='/ip/']") as HTMLElement);

							if (titleElement) {
								title = titleElement.innerText?.trim() || "";
							}

							if (!title) {
								const links = card.querySelectorAll("a");
								for (const link of links) {
									const text = (link as HTMLElement).innerText?.trim();
									if (text && text.length > 10) {
										title = text;
										break;
									}
								}
							}

							if (!title || title.length < 5) return null;

							const linkElement =
								card.querySelector('a[href*="/ip/"]') ||
								card.querySelector("a[href]");
							const detailLink = linkElement?.getAttribute("href") || "N/A";

							const imageElement = card.querySelector(
								"img",
							) as HTMLImageElement;
							const imageLink =
								imageElement?.src ||
								imageElement?.getAttribute("data-src") ||
								"N/A";

							let price = "N/A";
							const priceElements = card.querySelectorAll(
								'[class*="price"], [data-automation-id*="price"]',
							);
							for (const el of priceElements) {
								const text = (el as HTMLElement).innerText?.trim();
								if (text && text.includes("$")) {
									price = text;
									break;
								}
							}

							const ratingElement =
								card.querySelector('[aria-label*="star"]') ||
								card.querySelector('[class*="rating"]');
							const rating =
								ratingElement?.getAttribute("aria-label") ||
								(ratingElement as HTMLElement)?.innerText?.trim() ||
								"N/A";

							const reviewElement = card.querySelector('[class*="review"]');
							const reviewCount =
								(reviewElement as HTMLElement)?.innerText?.trim() || "N/A";

							const isSponsored = card.textContent?.includes("Sponsored")
								? "yes"
								: "no";
							const hasFreeShipping = card.textContent
								?.toLowerCase()
								.includes("free shipping")
								? "yes"
								: "no";

							return {
								title,
								detailPageUrl: detailLink,
								imageUrl: imageLink,
								price,
								rating,
								reviewCount,
								isSponsored,
								hasFreeShipping,
							};
						} catch {
							return null;
						}
					})
					.filter(Boolean) as ScrapedWalmartProduct[];
			});

			const nextPageUrl = await page.evaluate(() => {
				const nextBtn =
					document.querySelector('a[aria-label="Next page"]') ||
					document.querySelector('button[aria-label="Next page"]');
				return nextBtn && !nextBtn.hasAttribute("aria-disabled")
					? nextBtn.getAttribute("href")
					: null;
			});

			await browser.close();
			return { data, nextPageUrl };
		} catch (error) {
			await page
				.screenshot({ path: `walmart-error-page-${Date.now()}.png` })
				.catch(() => {});
			await browser.close();
			throw error;
		}
	}

	private transformProduct(raw: ScrapedWalmartProduct): CrawledProduct {
		return {
			id: nanoid(),
			title: raw.title,
			price: this.parsePrice(raw.price)?.toString(),
			currency: "USD",
			imageUrl: raw.imageUrl !== "N/A" ? raw.imageUrl : undefined,
			productUrl:
				raw.detailPageUrl !== "N/A"
					? raw.detailPageUrl.startsWith("http")
						? raw.detailPageUrl
						: `https://www.walmart.com${raw.detailPageUrl}`
					: undefined,
			source: this.SOURCE,
			rating: this.parseRating(raw.rating),
			reviewCount: this.parseReviewCount(raw.reviewCount),
			isSponsored: raw.isSponsored === "yes",
			hasFreeShipping: raw.hasFreeShipping === "yes",
		};
	}

	private parsePrice(priceString: string): number | undefined {
		if (!priceString || priceString === "N/A") return undefined;

		const cleanedPrice = priceString
			.replace(/[€£¥₹₩₽]/g, "")
			.replace(/USD|EUR|GBP|JPY|AUD|CAD|CNY|INR|CHF|KRW|RUB/gi, "")
			.replace(/to/gi, "")
			.trim();

		const priceMatches = cleanedPrice.match(
			/\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g,
		);
		if (!priceMatches || priceMatches.length === 0) return undefined;

		const parsedPrice = parseFloat(priceMatches[0].replace(/,/g, ""));
		return isNaN(parsedPrice) || parsedPrice <= 0 ? undefined : parsedPrice;
	}

	private parseRating(ratingString: string): number | undefined {
		if (!ratingString || ratingString === "N/A") return undefined;
		const match = ratingString.match(/(\d+\.?\d*)\s+out\s+of/i);
		return match ? parseFloat(match[1]) : undefined;
	}

	private parseReviewCount(countString: string): number | undefined {
		if (!countString || countString === "N/A") return undefined;
		const match = countString.match(/[\d,]+/);
		return match ? parseInt(match[0].replace(/,/g, ""), 10) : undefined;
	}
}
