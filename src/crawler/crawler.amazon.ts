import puppeteer, { Browser } from "puppeteer-core";
import { CrawledProduct } from "./types/crawler.types";

export class AmazonCrawler {
	private readonly SBR_WS_ENDPOINT = process.env.SBR_WS_ENDPOINT;

	constructor() {
		if (!this.SBR_WS_ENDPOINT) {
			throw new Error(
				"SBR_WS_ENDPOINT environment variable is required for AmazonCrawler",
			);
		}
	}
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
			// Go directly to search results
			const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(
				searchPhrase,
			)}`;

			console.log("Going directly to search URL:", searchUrl);
			await page.goto(searchUrl, {
				waitUntil: "networkidle2",
				timeout: 60000,
			});

			// Wait for results to load
			await page.waitForSelector(".s-widget-container", { timeout: 60000 });

			const url = page.url();
			await browser.close();
			return url;
		} catch (error) {
			console.error("Error in getSearchResultsUrl:", (error as Error).message);
			await page.screenshot({ path: "error-screenshot.png" });
			await browser.close();
			throw error;
		}
	}

	// Scrape a single Amazon result page
	private async scrapePage(
		url: string,
	): Promise<{ data: any[]; nextPageUrl: string | null }> {
		const browser = await this.openBrowser();
		const page = await browser.newPage();

		try {
			console.log("Navigating:", url);
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

			await page.waitForSelector(".s-widget-container", { timeout: 60000 });

			const data = await page.evaluate(() => {
				const cards = [
					...document.querySelectorAll(".s-widget-container"),
				] as HTMLElement[];

				return cards
					.map((card) => {
						const titleElement = card.querySelector("h2") as HTMLElement;
						const title = titleElement?.innerText || null;
						if (!title) return null;

						const detailLink =
							card.querySelector("h2 a")?.getAttribute("href") ||
							card
								.querySelector("a.a-link-normal.s-no-outline")
								?.getAttribute("href") ||
							"N/A";

						// Get product image link
						const imageElement = card.querySelector(
							"img.s-image",
						) as HTMLImageElement;
						const imageLink =
							imageElement?.src ||
							imageElement?.getAttribute("data-src") ||
							"N/A";

						// Get price
						const priceElement = card.querySelector(
							".a-price .a-offscreen",
						) as HTMLElement;
						const price = priceElement?.innerText || "N/A";

						// Get base price
						const basePriceElement = card.querySelector(
							"span.a-price.a-text-price > span.a-offscreen",
						) as HTMLElement;
						const basePrice = basePriceElement?.innerText || "N/A";

						// Get badge
						const badgeElement = card.querySelector(
							".a-badge-label-inner",
						) as HTMLElement;
						const badge = badgeElement?.innerText || "N/A";

						// Get rating
						const ratingElement = card.querySelector("[aria-label]");
						const rating = ratingElement?.getAttribute("aria-label") || "N/A";

						// Get ratings count
						const ratingsCountElement = card.querySelector(
							".a-row > span:nth-child(2)[aria-label]",
						);
						const ratingsCount =
							ratingsCountElement?.getAttribute("aria-label") || "N/A";

						return {
							title,
							detailPageUrl: detailLink,
							imageUrl: imageLink,
							sponsored: card.querySelector(".puis-sponsored-label-text")
								? "yes"
								: "no",
							badge,
							price,
							basePrice,
							rating,
							ratingsCount,
						};
					})
					.filter(Boolean);
			});

			// Get next page URL
			const nextPageUrl = await page.evaluate(() => {
				const nextBtn = document.querySelector(".s-pagination-next");
				return nextBtn && !nextBtn.getAttribute("aria-disabled")
					? nextBtn.getAttribute("href")
					: null;
			});

			await browser.close();
			return { data, nextPageUrl };
		} catch (error) {
			console.error("Error in scrapePage:", (error as Error).message);
			await page.screenshot({ path: `error-page-${Date.now()}.png` });
			await browser.close();
			throw error;
		}
	}

	// Main search method - public interface
	async search(query: string, maxPages: number = 2): Promise<CrawledProduct[]> {
		try {
			console.log("Amazon Search:", query);
			console.log("Max pages:", maxPages);
			console.log("------------------------------------");

			// Get search results URL
			let currentUrl = await this.getSearchResultsUrl(query);

			const allData: any[] = [];

			// Loop through pages
			for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
				console.log(`\nScraping Amazon Page ${pageNum}...`);

				const { data, nextPageUrl } = await this.scrapePage(currentUrl);

				allData.push(...data);

				if (!nextPageUrl) {
					console.log("No more pages. Stopping.");
					break;
				}

				currentUrl = nextPageUrl.startsWith("http")
					? nextPageUrl
					: `https://www.amazon.com${nextPageUrl}`;

				await this.delay(1500);
			}

			console.log(
				`\nAmazon scraping finished. Found ${allData.length} products.\n`,
			);

			// Transform to CrawledProduct format
			return this.transformResults(allData);
		} catch (error) {
			console.error("Error in Amazon search:", error);
			return [];
		}
	}

	// Transform Amazon results to match CrawledProduct interface
	private transformResults(rawData: any[]): CrawledProduct[] {
		return rawData.map((item) => ({
			title: item.title,
			price: this.parsePrice(item.price),
			currency: "USD",
			imageUrl: item.imageUrl !== "N/A" ? item.imageUrl : undefined,
			productUrl:
				item.detailPageUrl !== "N/A"
					? item.detailPageUrl.startsWith("http")
						? item.detailPageUrl
						: `https://www.amazon.com${item.detailPageUrl}`
					: undefined,
			source: "Amazon",
			rating: this.parseRating(item.rating),
			reviewCount: this.parseReviewCount(item.ratingsCount),
			isSponsored: item.sponsored === "yes",
			badge: item.badge !== "N/A" ? item.badge : undefined,
			basePrice:
				item.basePrice !== "N/A" ? this.parsePrice(item.basePrice) : undefined,
		}));
	}

	// Helper to parse price strings like "$299.99" to number
	private parsePrice(priceString: string): number | undefined {
		if (!priceString || priceString === "N/A") return undefined;

		// Remove commas first
		const cleaned = priceString.replace(/,/g, "");

		const match = cleaned.match(/\d+(\.\d+)?/);
		if (match) {
			return parseFloat(match[0]);
		}

		return undefined;
	}

	// Helper to parse rating strings like "4.5 out of 5 stars" to number
	private parseRating(ratingString: string): number | undefined {
		if (!ratingString || ratingString === "N/A") return undefined;

		const match = ratingString.match(/(\d+\.?\d*)\s+out\s+of/i);
		if (match) {
			return parseFloat(match[1]);
		}
		return undefined;
	}

	// Helper to parse review count strings like "45,234" to number
	private parseReviewCount(countString: string): number | undefined {
		if (!countString || countString === "N/A") return undefined;

		const match = countString.match(/[\d,]+/);
		if (match) {
			return parseInt(match[0].replace(/,/g, ""), 10);
		}
		return undefined;
	}
}
