// src/crawler/crawler.alibaba.ts

import puppeteer, { Browser, Page } from "puppeteer-core";
import { CrawledProduct } from "./types/crawler.types";

export class AlibabaCrawler {
	// Use the same endpoint as Amazon for now
	private readonly SBR_WS_ENDPOINT =
		"wss://brd-customer-hl_a0e4cccb-zone-scraping_alibaba:eqa4zqx927r3@brd.superproxy.io:9222";

	// Delay helper
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
			// Set user agent
			await page.setUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			);

			// Set viewport
			await page.setViewport({ width: 1920, height: 1080 });

			// Go directly to search results
			const searchUrl = `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(
				searchPhrase,
			)}`;

			console.log("Going directly to Alibaba search URL:", searchUrl);
			await page.goto(searchUrl, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});

			// Wait for page to render
			await this.delay(5000);

			// Take a screenshot
			await page.screenshot({ path: "alibaba-loaded.png", fullPage: true });

			const pageContent = await page.content();
			const pageTitle = await page.title();
			console.log("Page title:", pageTitle);

			// Get body text for debugging
			const bodyText = await page.evaluate(() => document.body.innerText);
			console.log("Body text length:", bodyText.length);
			console.log("First 500 chars:", bodyText.substring(0, 500));

			// Only block if we see actual CAPTCHA or verification text
			// Don't block just because the word "verify" appears in the page
			const hasCaptchaChallenge =
				bodyText.includes("Please verify you are a human") ||
				bodyText.includes("Press & Hold") ||
				bodyText.includes("Slide to verify") ||
				pageContent.includes('id="nc_1_wrapper"') || // Alibaba CAPTCHA element
				pageTitle.toLowerCase().includes("robot check");

			if (hasCaptchaChallenge) {
				throw new Error(
					"Alibaba is showing CAPTCHA challenge - check alibaba-loaded.png",
				);
			}

			// Check if we got products - Alibaba shows "Showing X products"
			if (bodyText.includes("products from") || bodyText.includes("Showing")) {
				console.log("✓ Products page detected!");
			}

			// Try multiple selectors based on the screenshot
			const possibleSelectors = [
				'div[class*="organic-list"]', // Main container
				'div[data-content="shop_search_result"]',
				".organic-list-offer",
				".search-card-e-slider", // Image container
				'a[href*="/product-detail/"]', // Product links
				"div.organic-gallery-offer-outter",
			];

			let selectorFound = false;
			let foundSelector = "";

			for (const selector of possibleSelectors) {
				try {
					const count = await page.evaluate((sel) => {
						return document.querySelectorAll(sel).length;
					}, selector);

					console.log(`Trying selector "${selector}": ${count} elements found`);

					if (count > 0) {
						console.log(`✓ Found selector: ${selector}`);
						foundSelector = selector;
						selectorFound = true;
						break;
					}
				} catch (e) {
					console.log(`✗ Selector failed: ${selector}`);
				}
			}

			if (!selectorFound) {
				// Debug: show what classes are actually on the page
				console.log("\n=== DEBUGGING INFO ===");
				const classInfo = await page.evaluate(() => {
					const elements = document.querySelectorAll(
						'[class*="organic"], [class*="search"], [class*="product"]',
					);
					return Array.from(elements)
						.slice(0, 10)
						.map((el) => ({
							tag: el.tagName,
							class: el.className,
							hasImage: !!el.querySelector("img"),
							hasLink: !!el.querySelector("a"),
						}));
				});
				console.log("Elements found:", JSON.stringify(classInfo, null, 2));
				console.log("======================\n");

				// Save HTML for inspection
				const fs = require("fs");
				fs.writeFileSync("alibaba-page.html", pageContent);
				console.log("Page HTML saved to alibaba-page.html");

				throw new Error(
					"Could not find product cards - check alibaba-loaded.png and alibaba-page.html",
				);
			}

			const url = page.url();
			await browser.close();
			return url;
		} catch (error) {
			console.error("Error in getSearchResultsUrl:", (error as Error).message);
			await page.screenshot({
				path: "alibaba-error-screenshot.png",
				fullPage: true,
			});

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

			await page.setViewport({ width: 1920, height: 1080 });

			console.log("Navigating to Alibaba:", url);
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

			// Wait for page to stabilize
			await this.delay(5000);

			// Based on the screenshot, products are in divs with organic classes
			const possibleSelectors = [
				'div[class*="organic-list"]',
				"div.organic-list-offer",
				'div[data-content="shop_search_result"] > div',
				".organic-gallery-offer-outter",
			];

			let workingSelector = "";
			for (const selector of possibleSelectors) {
				const count = await page.evaluate((sel) => {
					return document.querySelectorAll(sel).length;
				}, selector);

				if (count > 3) {
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
							// Title - look for links with product titles
							let title = "";
							const titleElement =
								card.querySelector("a[title]") ||
								card.querySelector("h2 a") ||
								card.querySelector('[class*="title"]');

							if (titleElement) {
								title =
									titleElement.getAttribute("title") ||
									(titleElement as HTMLElement).innerText?.trim() ||
									(titleElement as HTMLElement).textContent?.trim() ||
									"";
							}

							if (!title || title.length < 5) return null;

							// Product URL
							const linkElement =
								card.querySelector('a[href*="/product-detail/"]') ||
								card.querySelector('a[href*=".html"]') ||
								card.querySelector("a[href]");
							const detailLink = linkElement?.getAttribute("href") || "N/A";

							// Image
							const imageElement = card.querySelector(
								"img",
							) as HTMLImageElement;
							const imageLink =
								imageElement?.src ||
								imageElement?.getAttribute("data-src") ||
								imageElement?.getAttribute("data-image") ||
								imageElement?.getAttribute("srcset")?.split(" ")[0] ||
								"N/A";

							// Price - very flexible
							let price = "N/A";
							const priceElements = card.querySelectorAll(
								'[class*="price"], [class*="Price"]',
							);
							for (const el of priceElements) {
								const text = (el as HTMLElement).innerText?.trim();
								if (
									text &&
									(text.includes("$") || text.includes("US") || /\d/.test(text))
								) {
									price = text;
									break;
								}
							}

							// MOQ (Minimum Order Quantity)
							let moq = "N/A";
							const moqElements = card.querySelectorAll(
								'[class*="moq"], [class*="min-order"]',
							);
							for (const el of moqElements) {
								const text = (el as HTMLElement).innerText?.trim();
								if (text && text.toLowerCase().includes("piece")) {
									moq = text;
									break;
								}
							}

							// Supplier
							let supplier = "N/A";
							const supplierElements = card.querySelectorAll(
								'[class*="company"], [class*="supplier"]',
							);
							for (const el of supplierElements) {
								const text = (el as HTMLElement).innerText?.trim();
								if (text && text.length > 3 && text.length < 100) {
									supplier = text;
									break;
								}
							}

							// Trade Assurance
							const hasTradeAssurance = card.textContent?.includes(
								"Trade Assurance",
							)
								? "yes"
								: "no";

							return {
								title,
								detailPageUrl: detailLink,
								imageUrl: imageLink,
								price,
								moq,
								supplier,
								rating: "N/A",
								hasTradeAssurance,
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
					'button[class*="next"]',
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
				fullPage: true,
			});
			await browser.close();
			throw error;
		}
	}

	// Main search method
	async search(query: string, maxPages: number = 2): Promise<CrawledProduct[]> {
		try {
			console.log("Alibaba Search:", query);
			console.log("Max pages:", maxPages);
			console.log("------------------------------------");

			let currentUrl = await this.getSearchResultsUrl(query);

			const allData: any[] = [];

			for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
				console.log(`\nScraping Alibaba Page ${pageNum}...`);

				const { data, nextPageUrl } = await this.scrapePage(currentUrl);

				allData.push(...data);

				if (!nextPageUrl) {
					console.log("No more pages. Stopping.");
					break;
				}

				currentUrl = nextPageUrl.startsWith("http")
					? nextPageUrl
					: `https://www.alibaba.com${nextPageUrl}`;

				await this.delay(2000);
			}

			console.log(
				`\nAlibaba scraping finished. Found ${allData.length} products.\n`,
			);

			return this.transformResults(allData);
		} catch (error) {
			console.error("Error in Alibaba search:", error);
			return [];
		}
	}

	// Transform results
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

	private parsePrice(priceString: string): number | undefined {
		if (!priceString || priceString === "N/A") return undefined;
		const match = priceString.match(/[\d,]+\.?\d*/);
		if (match) {
			return parseFloat(match[0].replace(/,/g, ""));
		}
		return undefined;
	}

	private parseCurrency(priceString: string): string {
		if (!priceString || priceString === "N/A") return "USD";
		if (priceString.includes("$") || priceString.includes("US")) return "USD";
		if (priceString.includes("€") || priceString.includes("EUR")) return "EUR";
		if (priceString.includes("£") || priceString.includes("GBP")) return "GBP";
		if (priceString.includes("¥") || priceString.includes("CNY")) return "CNY";
		return "USD";
	}

	private parseRating(ratingString: string): number | undefined {
		if (!ratingString || ratingString === "N/A") return undefined;
		const match = ratingString.match(/(\d+\.?\d*)/);
		if (match) {
			return parseFloat(match[1]);
		}
		return undefined;
	}

	private fixImageUrl(url: string): string {
		if (url.startsWith("//")) {
			return `https:${url}`;
		}
		if (!url.startsWith("http")) {
			return `https://www.alibaba.com${url}`;
		}
		return url;
	}

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
