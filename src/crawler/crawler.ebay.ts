// src/crawler/crawler.ebay.ts

import { nanoid } from "nanoid";
import puppeteer, { Browser } from "puppeteer-core";
import { Observable, Observer } from "rxjs";
import { IBaseCrawler } from "./types/base-crawler.interface";
import { CrawledProduct } from "./types/crawler.types";
import { CrawlerEvent, CrawlerEventType } from "./types/crawler-events";

interface ScrapedEbayProduct {
	title: string;
	detailPageUrl: string;
	imageUrl: string;
	price: string;
	condition: string;
	shipping: string;
	isSponsored: string;
	isBuyItNow: string;
}

export class EbayCrawler implements IBaseCrawler {
	private readonly SBR_WS_ENDPOINT = process.env.SBR_WS_ENDPOINT;
	private readonly SOURCE = "eBay";

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
					: `https://www.ebay.com${nextPageUrl}`;

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
			const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchPhrase)}`;

			await page.goto(searchUrl, {
				waitUntil: "networkidle2",
				timeout: 60000,
			});

			await this.delay(5000);

			const url = page.url();
			await browser.close();
			return url;
		} catch (error) {
			await page
				.screenshot({ path: "ebay-error-screenshot.png" })
				.catch(() => {});
			await browser.close();
			throw error;
		}
	}

	private async scrapePage(
		url: string,
	): Promise<{ data: ScrapedEbayProduct[]; nextPageUrl: string | null }> {
		const browser = await this.openBrowser();
		const page = await browser.newPage();

		try {
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
			await this.delay(7000);

			const data = await page.evaluate(() => {
				const cards = [...document.querySelectorAll("li")] as HTMLElement[];

				return cards
					.map((card) => {
						const hasImage = !!card.querySelector("img");
						const hasLink = !!card.querySelector("a");
						const hasContent =
							card.textContent && card.textContent.trim().length > 50;

						if (!hasImage || !hasLink || !hasContent) return null;

						const titleElement =
							(card.querySelector(".s-item__title") as HTMLElement) ||
							(card.querySelector("h3") as HTMLElement) ||
							(card.querySelector('[role="heading"]') as HTMLElement);

						const title = titleElement?.innerText?.trim() || null;

						if (
							!title ||
							title.length < 5 ||
							title.toLowerCase().includes("shop on ebay")
						) {
							return null;
						}

						const linkElement =
							card.querySelector(".s-item__link") ||
							card.querySelector("a[href*='/itm/']") ||
							card.querySelector("a[href]");
						const detailLink = linkElement?.getAttribute("href") || "N/A";

						const imageElement = card.querySelector("img") as HTMLImageElement;
						const imageLink =
							imageElement?.src ||
							imageElement?.getAttribute("data-src") ||
							"N/A";

						const priceElement = card.querySelector(
							".s-item__price",
						) as HTMLElement;
						const price = priceElement?.innerText?.trim() || "N/A";

						let condition = "N/A";
						const text = card.textContent || "";
						if (text.includes("Brand New")) condition = "Brand New";
						else if (text.includes("New")) condition = "New";
						else if (text.includes("Used")) condition = "Used";
						else if (text.includes("Refurbished")) condition = "Refurbished";
						else if (text.includes("Pre-Owned")) condition = "Pre-Owned";

						const shippingElement = card.querySelector(
							".s-item__shipping",
						) as HTMLElement;
						const shipping =
							shippingElement?.innerText?.trim() ||
							(text.includes("Free shipping") ? "Free shipping" : "N/A");

						const isSponsored =
							text.includes("SPONSORED") || text.includes("Sponsored")
								? "yes"
								: "no";

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
					.filter(Boolean) as ScrapedEbayProduct[];
			});

			const nextPageUrl = await page.evaluate(() => {
				const nextBtn = document.querySelector("a.pagination__next");
				return nextBtn && !nextBtn.hasAttribute("aria-disabled")
					? nextBtn.getAttribute("href")
					: null;
			});

			await browser.close();
			return { data, nextPageUrl };
		} catch (error) {
			await page
				.screenshot({ path: `ebay-error-page-${Date.now()}.png` })
				.catch(() => {});
			await browser.close();
			throw error;
		}
	}

	private transformProduct(raw: ScrapedEbayProduct): CrawledProduct {
		return {
			id: nanoid(),
			title: raw.title,
			price: this.parsePrice(raw.price),
			currency: "USD",
			imageUrl: raw.imageUrl !== "N/A" ? raw.imageUrl : undefined,
			productUrl:
				raw.detailPageUrl !== "N/A"
					? raw.detailPageUrl.startsWith("http")
						? raw.detailPageUrl
						: `https://www.ebay.com${raw.detailPageUrl}`
					: undefined,
			source: this.SOURCE,
			condition: raw.condition !== "N/A" ? raw.condition : undefined,
			shipping: raw.shipping !== "N/A" ? raw.shipping : undefined,
			isSponsored: raw.isSponsored === "yes",
			isBuyItNow: raw.isBuyItNow === "yes",
		};
	}

	private parsePrice(priceString: string): number | undefined {
		if (!priceString || priceString === "N/A") return undefined;

		const cleaned = priceString.replace(/[^\d.,]/g, " ");
		const matches = cleaned.match(/[\d,]+\.?\d*/g);

		if (!matches || matches.length === 0) return undefined;

		// Take the lowest price if it's a range
		return Math.min(...matches.map((p) => parseFloat(p.replace(/,/g, ""))));
	}
}
