// src/crawler/crawler.amazon.ts

import puppeteer, { Browser } from "puppeteer-core";
import { Observable, Observer } from "rxjs";
import { IBaseCrawler } from "./types/base-crawler.interface";
import { CrawledProduct } from "./types/crawler.types";
import { CrawlerEvent, CrawlerEventType } from "./types/crawler-events";

interface ScrapedAmazonProduct {
	title: string;
	detailPageUrl: string;
	imageUrl: string;
	sponsored: string;
	badge: string;
	price: string;
	basePrice: string;
	rating: string;
	ratingsCount: string;
}

export class AmazonCrawler implements IBaseCrawler {
	private readonly SBR_WS_ENDPOINT = process.env.SBR_WS_ENDPOINT;
	private readonly SOURCE = "Amazon";

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
					: `https://www.amazon.com${nextPageUrl}`;

				await this.delay(1500);
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
			const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchPhrase)}`;

			await page.goto(searchUrl, {
				waitUntil: "networkidle2",
				timeout: 60000,
			});

			await page.waitForSelector(".s-widget-container", { timeout: 60000 });

			const url = page.url();
			await browser.close();
			return url;
		} catch (error) {
			await page
				.screenshot({ path: "amazon-error-screenshot.png" })
				.catch(() => {});
			await browser.close();
			throw error;
		}
	}

	private async scrapePage(
		url: string,
	): Promise<{ data: ScrapedAmazonProduct[]; nextPageUrl: string | null }> {
		const browser = await this.openBrowser();
		const page = await browser.newPage();

		try {
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

						const imageElement = card.querySelector(
							"img.s-image",
						) as HTMLImageElement;
						const imageLink =
							imageElement?.src ||
							imageElement?.getAttribute("data-src") ||
							"N/A";

						const priceElement = card.querySelector(
							".a-price .a-offscreen",
						) as HTMLElement;
						const price = priceElement?.innerText || "N/A";

						const basePriceElement = card.querySelector(
							"span.a-price.a-text-price > span.a-offscreen",
						) as HTMLElement;
						const basePrice = basePriceElement?.innerText || "N/A";

						const badgeElement = card.querySelector(
							".a-badge-label-inner",
						) as HTMLElement;
						const badge = badgeElement?.innerText || "N/A";

						const ratingElement = card.querySelector("[aria-label]");
						const rating = ratingElement?.getAttribute("aria-label") || "N/A";

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
					.filter(Boolean) as ScrapedAmazonProduct[];
			});

			const nextPageUrl = await page.evaluate(() => {
				const nextBtn = document.querySelector(".s-pagination-next");
				return nextBtn && !nextBtn.getAttribute("aria-disabled")
					? nextBtn.getAttribute("href")
					: null;
			});

			await browser.close();
			return { data, nextPageUrl };
		} catch (error) {
			await page
				.screenshot({ path: `amazon-error-page-${Date.now()}.png` })
				.catch(() => {});
			await browser.close();
			throw error;
		}
	}

	private transformProduct(raw: ScrapedAmazonProduct): CrawledProduct {
		return {
			title: raw.title,
			price: this.parsePrice(raw.price),
			currency: "USD",
			imageUrl: raw.imageUrl !== "N/A" ? raw.imageUrl : undefined,
			productUrl:
				raw.detailPageUrl !== "N/A"
					? raw.detailPageUrl.startsWith("http")
						? raw.detailPageUrl
						: `https://www.amazon.com${raw.detailPageUrl}`
					: undefined,
			source: this.SOURCE,
			rating: this.parseRating(raw.rating),
			reviewCount: this.parseReviewCount(raw.ratingsCount),
			isSponsored: raw.sponsored === "yes",
			badge: raw.badge !== "N/A" ? raw.badge : undefined,
			basePrice:
				raw.basePrice !== "N/A" ? this.parsePrice(raw.basePrice) : undefined,
		};
	}

	private parsePrice(priceString: string): number | undefined {
		if (!priceString || priceString === "N/A") return undefined;
		const cleaned = priceString.replace(/,/g, "");
		const match = cleaned.match(/\d+(\.\d+)?/);
		return match ? parseFloat(match[0]) : undefined;
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
