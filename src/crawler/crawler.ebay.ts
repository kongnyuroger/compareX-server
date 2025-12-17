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
			const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
				searchPhrase,
			)}`;

			console.log("Going directly to eBay search URL:", searchUrl);

			await page.goto(searchUrl, {
				waitUntil: "networkidle2",
				timeout: 60000,
			});

			// Allow extra time for dynamic content
			await this.delay(5000);

			return page.url();
		} catch (error) {
			console.error("Error in getSearchResultsUrl:", (error as Error).message);
			try {
				await page.screenshot({ path: "ebay-error-screenshot.png" });
			} catch {}
			throw error;
		} finally {
			try {
				await browser.close();
			} catch {}
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

			await page.goto(url, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});

			// eBay JS rendering delay
			await this.delay(7000);

			const data = await page.evaluate(() => {
				const cards = Array.from(
					document.querySelectorAll("li.s-item"),
				) as HTMLElement[];

				return cards
					.map((card) => {
						// TITLE
						const titleEl =
							card.querySelector(".s-item__title") || card.querySelector("h3");

						const title = titleEl?.textContent?.trim() || null;
						if (!title || title.length < 5) return null;

						// PRODUCT URL
						const linkEl =
							card.querySelector(".s-item__link") ||
							card.querySelector("a[href*='/itm/']");

						const detailPageUrl = linkEl?.getAttribute("href") || null;
						if (!detailPageUrl) return null;

						// IMAGE
						const imgEl = card.querySelector("img") as HTMLImageElement;
						const imageUrl =
							imgEl?.getAttribute("src") ||
							imgEl?.getAttribute("data-src") ||
							null;

						// PRICE (ROBUST)
						let price = "N/A";
						const priceEl =
							card.querySelector(".s-item__price") ||
							card.querySelector("[class*='price']");

						if (priceEl) {
							price = priceEl.textContent?.replace(/\s+/g, " ").trim() || "N/A";
						}

						// CONDITION
						const text = card.textContent || "";
						let condition = "N/A";
						if (/Brand New/i.test(text)) condition = "Brand New";
						else if (/New/i.test(text)) condition = "New";
						else if (/Used/i.test(text)) condition = "Used";
						else if (/Refurbished/i.test(text)) condition = "Refurbished";
						else if (/Pre-Owned/i.test(text)) condition = "Pre-Owned";

						// SHIPPING
						const shippingEl = card.querySelector(".s-item__shipping");
						const shipping =
							shippingEl?.textContent?.trim() ||
							(text.includes("Free shipping") ? "Free shipping" : "N/A");

						// FLAGS
						const isSponsored = /Sponsored/i.test(text);
						const isBuyItNow = /Buy It Now/i.test(text);

						return {
							title,
							detailPageUrl,
							imageUrl,
							price,
							condition,
							shipping,
							isSponsored,
							isBuyItNow,
						};
					})
					.filter(Boolean);
			});

			// NEXT PAGE
			const nextPageUrl = await page.evaluate(() => {
				const nextBtn = document.querySelector(
					"a.pagination__next",
				) as HTMLAnchorElement;

				return nextBtn && !nextBtn.hasAttribute("aria-disabled")
					? nextBtn.getAttribute("href")
					: null;
			});

			return { data, nextPageUrl };
		} catch (error) {
			console.error("Error in scrapePage:", (error as Error).message);
			try {
				await page.screenshot({ path: `ebay-error-${Date.now()}.png` });
			} catch {}
			throw error;
		} finally {
			try {
				await browser.close();
			} catch {}
		}
	}

	// PUBLIC SEARCH API
	async search(query: string, maxPages = 2): Promise<CrawledProduct[]> {
		try {
			console.log("eBay Search:", query);
			console.log("Max pages:", maxPages);
			console.log("------------------------------------");

			let currentUrl = await this.getSearchResultsUrl(query);
			const allData: any[] = [];

			for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
				console.log(`Scraping eBay Page ${pageNum}`);

				const { data, nextPageUrl } = await this.scrapePage(currentUrl);

				allData.push(...data);

				if (!nextPageUrl) break;

				currentUrl = nextPageUrl.startsWith("http")
					? nextPageUrl
					: `https://www.ebay.com${nextPageUrl}`;

				await this.delay(2000);
			}

			console.log(`eBay scraping finished. ${allData.length} items`);

			return this.transformResults(allData);
		} catch (error) {
			console.error("Error in eBay search:", error);
			return [];
		}
	}

	// TRANSFORM RESULTS
	private transformResults(rawData: any[]): CrawledProduct[] {
		return rawData.map((item) => ({
			title: item.title,
			price: this.parsePrice(item.price),
			currency: this.parseCurrency(item.price),
			imageUrl: item.imageUrl || undefined,
			productUrl: item.detailPageUrl
				? item.detailPageUrl.startsWith("http")
					? item.detailPageUrl
					: `https://www.ebay.com${item.detailPageUrl}`
				: undefined,
			source: "eBay",
			condition: item.condition !== "N/A" ? item.condition : undefined,
			shipping: item.shipping !== "N/A" ? item.shipping : undefined,
			isSponsored: item.isSponsored,
			isBuyItNow: item.isBuyItNow,
		}));
	}

	// PRICE PARSER (handles ranges)
	private parsePrice(priceString?: string): number | undefined {
		if (!priceString || priceString === "N/A") return undefined;

		const numbers = priceString.match(/[\d,]+\.?\d*/g);
		if (!numbers || numbers.length === 0) return undefined;

		return Math.min(...numbers.map((n) => parseFloat(n.replace(/,/g, ""))));
	}

	// CURRENCY PARSER
	private parseCurrency(priceString?: string): string {
		if (!priceString) return "USD";

		if (priceString.includes("€")) return "EUR";
		if (priceString.includes("£")) return "GBP";
		if (/[¥￥]/.test(priceString)) return "JPY";
		if (priceString.includes("₹")) return "INR";
		if (/A\s*\$|^A\$/.test(priceString)) return "AUD";
		if (/C\s*\$|^C\$/.test(priceString)) return "CAD";
		if (priceString.includes("₩")) return "KRW";
		if (priceString.includes("₽")) return "RUB";
		if (priceString.includes("$")) return "USD";

		return "USD";
	}
}
