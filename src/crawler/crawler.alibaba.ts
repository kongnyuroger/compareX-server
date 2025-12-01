// src/crawler/crawler.alibaba.ts

import puppeteer, { Browser, Page } from "puppeteer-core";
import { CrawledProduct } from "./types/crawler.types";

export class AlibabaCrawler {
	private readonly SBR_WS_ENDPOINT =
		"wss://brd-customer-hl_dee05534-zone-alibaba:f0d9v3ne3eo7@brd.superproxy.io:9222";

	// Delay helper
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// Open a fresh browser for every page — REQUIRED for Bright Data
	private async openBrowser(): Promise<Browser> {
		return puppeteer.connect({ browserWSEndpoint: this.SBR_WS_ENDPOINT });
	}

	// Get search results URL by constructing it directly
	private async getSearchResultsUrl(searchPhrase: string): Promise<string> {
		const browser = await this.openBrowser();
		const page = await browser.newPage();

		try {
			// Set user agent
			await page.setUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			);

			// Go directly to search results
			const searchUrl = `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(
				searchPhrase,
			)}`;

			console.log("Going directly to Alibaba search URL:", searchUrl);
			await page.goto(searchUrl, {
				waitUntil: "networkidle2",
				timeout: 60000,
			});

			// Take a screenshot to see what loaded
			await page.screenshot({ path: "alibaba-loaded.png" });

			// Wait a bit for JavaScript to render
			await this.delay(3000);

			// Try to detect what actually loaded
			const pageContent = await page.content();
			console.log("Page title:", await page.title());

			// Check for CAPTCHA or blocking
			if (
				pageContent.includes("captcha") ||
				pageContent.includes("verify") ||
				(await page.title()).toLowerCase().includes("robot")
			) {
				throw new Error(
					"Alibaba is showing CAPTCHA or blocking - check alibaba-loaded.png",
				);
			}

			// Try multiple possible selectors
			const possibleSelectors = [
				".organic-list-offer",
				".gallery-offer-card",
				'[data-content="shop_search_result"]',
				".card-container",
				".organic-gallery-offer-outter",
				'[class*="search-card"]',
				'[class*="product-card"]',
				".J-offer-wrapper",
				".m-gallery-product-item-wrap",
			];

			let selectorFound = false;
			for (const selector of possibleSelectors) {
				try {
					await page.waitForSelector(selector, { timeout: 5000 });
					console.log(`✓ Found selector: ${selector}`);
					selectorFound = true;
					break;
				} catch (e) {
					console.log(`✗ Selector not found: ${selector}`);
				}
			}

			if (!selectorFound) {
				// Log what we actually got
				console.log("Available classes on page:");
				const classes = await page.evaluate(() => {
					const elements = document.querySelectorAll(
						'[class*="offer"], [class*="card"], [class*="product"]',
					);
					return Array.from(elements)
						.slice(0, 5)
						.map((el) => el.className);
				});
				console.log(classes);

				throw new Error(
					"Could not find product cards - check alibaba-loaded.png and console output",
				);
			}

			const url = page.url();
			await browser.close();
			return url;
		} catch (error) {
			console.error("Error in getSearchResultsUrl:", (error as Error).message);
			await page.screenshot({ path: "alibaba-error-screenshot.png" });

			// Log page HTML to file for debugging
			const content = await page.content();
			const fs = require("fs");
			fs.writeFileSync("alibaba-page.html", content);
			console.log("Page HTML saved to alibaba-page.html");

			await browser.close();
			throw error;
		}
	}

	// Scrape a single Alibaba result page
	private async scrapePage(
		url: string,
	): Promise<{ data: any[]; nextPageUrl: string | null }> {
		const browser = await this.openBrowser();
		const page = await browser.newPage();

		try {
			// Set user agent
			await page.setUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			);

			console.log("Navigating to Alibaba:", url);
			await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

			// Wait for page to stabilize
			await this.delay(3000);

			// Try to find any product cards
			const possibleSelectors = [
				".organic-list-offer",
				".gallery-offer-card",
				'[data-content="shop_search_result"]',
				".card-container",
				".organic-gallery-offer-outter",
				'[class*="search-card"]',
				".J-offer-wrapper",
				".m-gallery-product-item-wrap",
			];

			let workingSelector = "";
			for (const selector of possibleSelectors) {
				const count = await page.evaluate((sel) => {
					return document.querySelectorAll(sel).length;
				}, selector);

				if (count > 0) {
					console.log(`Found ${count} products with selector: ${selector}`);
					workingSelector = selector;
					break;
				}
			}

			if (!workingSelector) {
				throw new Error("No product cards found on page");
			}

			const data = await page.evaluate((selector) => {
				const cards = [...document.querySelectorAll(selector)] as HTMLElement[];

				return cards
					.map((card) => {
						try {
							// Try multiple ways to get title
							const titleSelectors = [
								"h2",
								".title",
								'[class*="title"]',
								"a[title]",
								".organic-list-offer-title",
								".search-card-e-title",
							];

							let title = "";
							for (const sel of titleSelectors) {
								const el = card.querySelector(sel) as HTMLElement;
								if (el) {
									title =
										el.innerText?.trim() ||
										el.textContent?.trim() ||
										el.getAttribute("title") ||
										"";
									if (title) break;
								}
							}

							if (!title) return null;

							// Get product URL
							const linkElement = card.querySelector("a[href]");
							const detailLink = linkElement?.getAttribute("href") || "N/A";

							// Get image
							const imageElement = card.querySelector(
								"img",
							) as HTMLImageElement;
							const imageLink =
								imageElement?.src ||
								imageElement?.getAttribute("data-src") ||
								imageElement?.getAttribute("data-image") ||
								"N/A";

							// Get price - very flexible
							const priceSelectors = [
								'[class*="price"]',
								".offer-price",
								".price-value",
								'[class*="Price"]',
							];

							let price = "N/A";
							for (const sel of priceSelectors) {
								const el = card.querySelector(sel) as HTMLElement;
								if (el?.innerText?.trim()) {
									price = el.innerText.trim();
									break;
								}
							}

							// Get supplier
							const supplierSelectors = [
								'[class*="supplier"]',
								'[class*="company"]',
								'[class*="shop"]',
							];

							let supplier = "N/A";
							for (const sel of supplierSelectors) {
								const el = card.querySelector(sel) as HTMLElement;
								if (el?.innerText?.trim()) {
									supplier = el.innerText.trim();
									break;
								}
							}

							// Get MOQ
							const moqSelectors = [
								'[class*="moq"]',
								'[class*="min-order"]',
								'[class*="minOrder"]',
							];

							let moq = "N/A";
							for (const sel of moqSelectors) {
								const el = card.querySelector(sel) as HTMLElement;
								if (el?.innerText?.trim()) {
									moq = el.innerText.trim();
									break;
								}
							}

							return {
								title,
								detailPageUrl: detailLink,
								imageUrl: imageLink,
								price,
								moq,
								supplier,
								rating: "N/A",
								hasTradeAssurance: card.querySelector(
									'[title*="Trade Assurance"]',
								)
									? "yes"
									: "no",
							};
						} catch (error) {
							console.error("Error parsing product card:", error);
							return null;
						}
					})
					.filter(Boolean);
			}, workingSelector);

			console.log(`Extracted ${data.length} products from page`);

			// Get next page URL
			const nextPageUrl = await page.evaluate(() => {
				const nextSelectors = [
					".next",
					"a.page-next",
					'[aria-label="Next"]',
					".seb-pagination__pages a:last-child",
					'[class*="next"]',
				];

				for (const sel of nextSelectors) {
					const nextBtn = document.querySelector(sel);
					if (
						nextBtn &&
						!nextBtn.classList.contains("disabled") &&
						!nextBtn.hasAttribute("disabled")
					) {
						return nextBtn.getAttribute("href");
					}
				}
				return null;
			});

			await browser.close();
			return { data, nextPageUrl };
		} catch (error) {
			console.error("Error in scrapePage:", (error as Error).message);
			await page.screenshot({
				path: `alibaba-error-page-${Date.now()}.png`,
			});
			await browser.close();
			throw error;
		}
	}

	// Main search method - public interface
	async search(query: string, maxPages: number = 2): Promise<CrawledProduct[]> {
		try {
			console.log("Alibaba Search:", query);
			console.log("Max pages:", maxPages);
			console.log("------------------------------------");

			// Get search results URL
			let currentUrl = await this.getSearchResultsUrl(query);

			const allData: any[] = [];

			// Loop through pages
			for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
				console.log(`\nScraping Alibaba Page ${pageNum}...`);

				const { data, nextPageUrl } = await this.scrapePage(currentUrl);

				allData.push(...data);

				if (!nextPageUrl) {
					console.log("No more pages. Stopping.");
					break;
				}

				// Handle relative URLs
				currentUrl = nextPageUrl.startsWith("http")
					? nextPageUrl
					: `https://www.alibaba.com${nextPageUrl}`;

				await this.delay(2000);
			}

			console.log(
				`\nAlibaba scraping finished. Found ${allData.length} products.\n`,
			);

			// Transform to CrawledProduct format
			return this.transformResults(allData);
		} catch (error) {
			console.error("Error in Alibaba search:", error);
			return [];
		}
	}

	// Transform Alibaba results to match CrawledProduct interface
	private transformResults(rawData: any[]): CrawledProduct[] {
		return rawData.map((item) => ({
			title: item.title,
			price: this.parsePrice(item.price),
			currency: this.parseCurrency(item.price),
			imageUrl:
				item.imageUrl !== "N/A" ? this.fixImageUrl(item.imageUrl) : undefined,
			productUrl:
				item.detailPageUrl !== "N/A"
					? this.fixProductUrl(item.detailPageUrl)
					: undefined,
			source: "Alibaba",
			supplier: item.supplier !== "N/A" ? item.supplier : undefined,
			moq: item.moq !== "N/A" ? item.moq : undefined,
			rating: this.parseRating(item.rating),
			hasTradeAssurance: item.hasTradeAssurance === "yes",
		}));
	}

	// Helper to parse price strings
	private parsePrice(priceString: string): number | undefined {
		if (!priceString || priceString === "N/A") return undefined;

		const match = priceString.match(/[\d,]+\.?\d*/);
		if (match) {
			return parseFloat(match[0].replace(/,/g, ""));
		}
		return undefined;
	}

	// Helper to parse currency from price string
	private parseCurrency(priceString: string): string {
		if (!priceString || priceString === "N/A") return "USD";

		if (priceString.includes("$") || priceString.includes("US")) return "USD";
		if (priceString.includes("€") || priceString.includes("EUR")) return "EUR";
		if (priceString.includes("£") || priceString.includes("GBP")) return "GBP";
		if (priceString.includes("¥") || priceString.includes("CNY")) return "CNY";

		return "USD";
	}

	// Helper to parse rating
	private parseRating(ratingString: string): number | undefined {
		if (!ratingString || ratingString === "N/A") return undefined;

		const match = ratingString.match(/(\d+\.?\d*)/);
		if (match) {
			return parseFloat(match[1]);
		}
		return undefined;
	}

	// Fix image URLs (convert to absolute if relative)
	private fixImageUrl(url: string): string {
		if (url.startsWith("//")) {
			return `https:${url}`;
		}
		if (!url.startsWith("http")) {
			return `https://www.alibaba.com${url}`;
		}
		return url;
	}

	// Fix product URLs (convert to absolute if relative)
	private fixProductUrl(url: string): string {
		if (url.startsWith("//")) {
			return `https:${url}`;
		}
		if (!url.startsWith("http")) {
			return `https://www.alibaba.com${url}`;
		}
		return url;
	}
}
