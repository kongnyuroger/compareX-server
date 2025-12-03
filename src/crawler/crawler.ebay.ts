// src/crawler/crawler.ebay.ts

import puppeteer, { Browser } from "puppeteer-core";
import { CrawledProduct } from "./types/crawler.types";

export class EbayCrawler {
	private readonly SBR_WS_ENDPOINT = process.env.SBR_WS_ENDPOINT;

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// Open a fresh browser for every page
	private async openBrowser(): Promise<Browser> {
		return puppeteer.connect({ browserWSEndpoint: this.SBR_WS_ENDPOINT });
	}

	// Get search results URL by constructing it directly
	private async getSearchResultsUrl(searchPhrase: string): Promise<string> {
		const browser = await this.openBrowser();
		const page = await browser.newPage();

		try {
			// Go directly to search results
			const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
				searchPhrase,
			)}`;

			console.log("Going directly to eBay search URL:", searchUrl);
			await page.goto(searchUrl, {
				waitUntil: "networkidle2",
				timeout: 60000,
			});

			// Wait for results to load - eBay needs more time
			await this.delay(5000);

			const url = page.url();
			return url;
		} catch (error) {
			console.error("Error in getSearchResultsUrl:", (error as Error).message);
			// Try to take a screenshot, but don't let that throw and mask the original error
			try {
				await page.screenshot({ path: "ebay-error-screenshot.png" });
			} catch (screenshotErr) {
				console.error(
					"Screenshot failed in getSearchResultsUrl:",
					screenshotErr,
				);
			}
			throw error;
		} finally {
			if (browser) {
				try {
					// Close only if connected to avoid errors
					if (
						(browser as any).isConnected ? (browser as any).isConnected() : true
					) {
						await browser.close();
					}
				} catch (closeErr) {
					console.error(
						"Error closing browser in getSearchResultsUrl:",
						closeErr,
					);
				}
			}
		}
	}

	// Scrape a single eBay result page
	private async scrapePage(
		url: string,
	): Promise<{ data: any[]; nextPageUrl: string | null }> {
		const browser = await this.openBrowser();
		const page = await browser.newPage();

		try {
			console.log("Navigating:", url);
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

			// Wait longer for eBay's JavaScript to render
			await this.delay(7000);

			const data = await page.evaluate(() => {
				// Find all product items
				const cards = [...document.querySelectorAll("li")] as HTMLElement[];

				return cards
					.map((card) => {
						// Filter: must have image, link, and substantial text
						const hasImage = !!card.querySelector("img");
						const hasLink = !!card.querySelector("a");
						const hasContent =
							card.textContent && card.textContent.trim().length > 50;

						if (!hasImage || !hasLink || !hasContent) return null;

						// Title - try multiple selectors
						const titleElement =
							(card.querySelector(".s-item__title") as HTMLElement) ||
							(card.querySelector("h3") as HTMLElement) ||
							(card.querySelector('[role="heading"]') as HTMLElement);

						const title = titleElement?.innerText?.trim() || null;

						// Skip invalid titles
						if (
							!title ||
							title.length < 5 ||
							title.toLowerCase().includes("shop on ebay")
						) {
							return null;
						}

						// Product URL
						const linkElement =
							card.querySelector(".s-item__link") ||
							card.querySelector("a[href*='/itm/']") ||
							card.querySelector("a[href]");
						const detailLink = linkElement?.getAttribute("href") || "N/A";

						// Image
						const imageElement = card.querySelector("img") as HTMLImageElement;
						const imageLink =
							imageElement?.src ||
							imageElement?.getAttribute("data-src") ||
							"N/A";

						// Price
						const priceElement = card.querySelector(
							".s-item__price",
						) as HTMLElement;
						const price = priceElement?.innerText?.trim() || "N/A";

						// Condition
						let condition = "N/A";
						const text = card.textContent || "";
						if (text.includes("Brand New")) condition = "Brand New";
						else if (text.includes("New")) condition = "New";
						else if (text.includes("Used")) condition = "Used";
						else if (text.includes("Refurbished")) condition = "Refurbished";
						else if (text.includes("Pre-Owned")) condition = "Pre-Owned";

						// Shipping
						const shippingElement = card.querySelector(
							".s-item__shipping",
						) as HTMLElement;
						const shipping =
							shippingElement?.innerText?.trim() ||
							(text.includes("Free shipping") ? "Free shipping" : "N/A");

						// Sponsored
						const isSponsored =
							text.includes("SPONSORED") || text.includes("Sponsored")
								? "yes"
								: "no";

						// Buy It Now
						const isBuyItNow = text.includes("Buy It Now") ? "yes" : "no";

						return {
							title,
							detailPageUrl: detailLink,
							imageUrl: imageLink,
							price,
							condition,
							shipping,
							isSponsored,
							isBuyItNow,
						};
					})
					.filter(Boolean);
			});

			// Get next page URL
			const nextPageUrl = await page.evaluate(() => {
				const nextBtn = document.querySelector("a.pagination__next");
				return nextBtn && !nextBtn.hasAttribute("aria-disabled")
					? nextBtn.getAttribute("href")
					: null;
			});

			return { data, nextPageUrl };
		} catch (error) {
			console.error("Error in scrapePage:", (error as Error).message);
			// Attempt screenshot but don't let it block error handling
			try {
				await page.screenshot({ path: `ebay-error-page-${Date.now()}.png` });
			} catch (screenshotErr) {
				console.error("Screenshot failed in scrapePage:", screenshotErr);
			}
			throw error;
		} finally {
			if (browser) {
				try {
					if (
						(browser as any).isConnected ? (browser as any).isConnected() : true
					) {
						await browser.close();
					}
				} catch (closeErr) {
					console.error("Error closing browser in scrapePage:", closeErr);
				}
			}
		}
	}

	// Main search method - public interface
	async search(query: string, maxPages: number = 2): Promise<CrawledProduct[]> {
		try {
			console.log("eBay Search:", query);
			console.log("Max pages:", maxPages);
			console.log("------------------------------------");

			// Get search results URL
			let currentUrl = await this.getSearchResultsUrl(query);

			const allData: any[] = [];

			// Loop through pages
			for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
				console.log(`\nScraping eBay Page ${pageNum}...`);

				const { data, nextPageUrl } = await this.scrapePage(currentUrl);

				allData.push(...data);

				if (!nextPageUrl) {
					console.log("No more pages. Stopping.");
					break;
				}

				currentUrl = nextPageUrl.startsWith("http")
					? nextPageUrl
					: `https://www.ebay.com${nextPageUrl}`;

				await this.delay(2000);
			}

			console.log(
				`\neBay scraping finished. Found ${allData.length} products.\n`,
			);

			// Transform to CrawledProduct format
			return this.transformResults(allData);
		} catch (error) {
			console.error("Error in eBay search:", error);
			return [];
		}
	}

	// Transform eBay results to match CrawledProduct interface
	private transformResults(rawData: any[]): CrawledProduct[] {
		return rawData.map((item) => ({
			title: item.title,
			price: this.parsePrice(item.price),
			currency: this.parseCurrency(item.price), // { changed code }
			imageUrl: item.imageUrl !== "N/A" ? item.imageUrl : undefined,
			productUrl:
				item.detailPageUrl !== "N/A"
					? item.detailPageUrl.startsWith("http")
						? item.detailPageUrl
						: `https://www.ebay.com${item.detailPageUrl}`
					: undefined,
			source: "eBay",
			condition: item.condition !== "N/A" ? item.condition : undefined,
			shipping: item.shipping !== "N/A" ? item.shipping : undefined,
			isSponsored: item.isSponsored === "yes",
			isBuyItNow: item.isBuyItNow === "yes",
		}));
	}

	// Helper to parse price strings like "$299.99" to number
	private parsePrice(priceString: string): number | undefined {
		if (!priceString || priceString === "N/A") return undefined;

		const match = priceString.match(/[\d,]+\.?\d*/);
		if (match) {
			return parseFloat(match[0].replace(/,/g, ""));
		}
		return undefined;
	}

	// Helper to extract currency code from price string, fallback to 'USD'
	private parseCurrency(priceString?: string): string {
		if (!priceString) return "USD";

		// Check for explicit currency codes
		const codeMatch = priceString.match(
			/\b(USD|EUR|GBP|JPY|AUD|CAD|CNY|INR|CHF|KRW|RUB)\b/i,
		);
		if (codeMatch) return codeMatch[1].toUpperCase();

		// Symbols and common patterns
		if (priceString.includes("€")) return "EUR";
		if (priceString.includes("£")) return "GBP";
		// Handle Yen vs Yuan: prioritize CNY if indicated, otherwise JPY
		if (/[¥￥]/.test(priceString)) {
			if (/C\s*¥|CNY|CN¥/i.test(priceString)) return "CNY";
			return "JPY";
		}
		if (priceString.includes("₹")) return "INR";
		if (/A\s*\$|^A\$|AUD/i.test(priceString)) return "AUD";
		if (/C\s*\$|^C\$|CAD/i.test(priceString)) return "CAD";
		if (priceString.includes("CHF")) return "CHF";
		if (priceString.includes("₩")) return "KRW";
		if (priceString.includes("₽")) return "RUB";

		// Dollar sign fallback -> USD
		if (priceString.includes("$")) return "USD";

		// Default fallback
		return "USD";
	}
}
