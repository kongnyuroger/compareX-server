// src/crawler/crawler.walmart.ts

import puppeteer, { Browser } from "puppeteer-core";
import { CrawledProduct } from "./types/crawler.types";

export class WalmartCrawler {
	// You'll need to create a Walmart zone in Bright Data
	// For now, using the Amazon zone (may or may not work)
	private readonly SBR_WS_ENDPOINT = process.env.SBR_WS_ENDPOINT;

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
			// Set realistic user agent
			await page.setUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			);

			// Set viewport
			await page.setViewport({ width: 1920, height: 1080 });

			// Go directly to search results
			const searchUrl = `https://www.walmart.com/search?q=${encodeURIComponent(
				searchPhrase,
			)}`;

			console.log("Going directly to Walmart search URL:", searchUrl);
			await page.goto(searchUrl, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});

			// Wait longer for React/JavaScript to render
			await this.delay(5000);

			// Take a screenshot to see what loaded
			await page.screenshot({ path: "walmart-loaded.png", fullPage: true });

			const pageContent = await page.content();
			const pageTitle = await page.title();
			console.log("Page title:", pageTitle);

			// Check if we actually got content (not a block page)
			const bodyText = await page.evaluate(() => document.body.innerText);
			console.log("Body text length:", bodyText.length);
			console.log("First 500 chars:", bodyText.substring(0, 500));

			// More lenient blocking detection - only check for actual block messages
			if (
				bodyText.includes("Access Denied") ||
				bodyText.includes("access denied") ||
				bodyText.includes("Request blocked") ||
				pageTitle.toLowerCase().includes("access denied") ||
				pageContent.includes("cf-browser-verification") // Cloudflare
			) {
				throw new Error(
					"Walmart is blocking access - check walmart-loaded.png",
				);
			}

			// Try multiple possible selectors for Walmart product cards
			const possibleSelectors = [
				"[data-item-id]",
				'[data-testid="list-view"]',
				'div[data-testid="list-view"] > div > div', // More specific
				'[data-automation-id="product-title"]',
				".search-result-gridview-item",
				".search-result-product-title",
				'[class*="SearchGridItem"]',
				'[data-testid="item-stack"]',
				'div[data-testid="item-stack"] > div',
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
						await page.waitForSelector(selector, { timeout: 3000 });
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
				// Log what we actually got
				console.log("\n=== DEBUGGING INFO ===");
				console.log("Available elements on page:");

				const elementInfo = await page.evaluate(() => {
					const allElements = document.querySelectorAll("*");
					const dataElements: any[] = [];

					allElements.forEach((el) => {
						// Look for elements with data attributes
						if (el.hasAttributes()) {
							const attrs = Array.from(el.attributes);
							const dataAttrs = attrs.filter(
								(attr) =>
									attr.name.startsWith("data-") || attr.name === "class",
							);

							if (
								dataAttrs.length > 0 &&
								el.textContent &&
								el.textContent.trim().length > 0
							) {
								dataElements.push({
									tag: el.tagName,
									attrs: dataAttrs
										.map((a) => `${a.name}="${a.value}"`)
										.join(" "),
									textPreview: el.textContent.trim().substring(0, 50),
								});
							}
						}
					});

					return dataElements.slice(0, 20); // First 20 elements
				});

				console.log(JSON.stringify(elementInfo, null, 2));
				console.log("======================\n");

				console.log("Page HTML saved to walmart-page.html");

				throw new Error(
					"Could not find product cards - check walmart-loaded.png, walmart-page.html and console output",
				);
			}

			const url = page.url();
			await browser.close();
			return url;
		} catch (error) {
			console.error("Error in getSearchResultsUrl:", (error as Error).message);
			await page.screenshot({
				path: "walmart-error-screenshot.png",
				fullPage: true,
			});

			// Log page HTML to file for debugging
			const content = await page.content();

			console.log("Page HTML saved to walmart-page.html");

			await browser.close();
			throw error;
		}
	}

	// Scrape a single Walmart result page
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

			// Set viewport
			await page.setViewport({ width: 1920, height: 1080 });

			console.log("Navigating to Walmart:", url);
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

			// Wait for page to stabilize
			await this.delay(5000);

			// Try to find product cards with more selectors
			const possibleSelectors = [
				"[data-item-id]",
				'div[data-testid="list-view"] > div > div',
				'[data-testid="item-stack"] > div',
				".search-result-gridview-item",
				'[class*="SearchGridItem"]',
				'div[data-automation-id*="product"]',
			];

			let workingSelector = "";
			for (const selector of possibleSelectors) {
				const count = await page.evaluate((sel) => {
					return document.querySelectorAll(sel).length;
				}, selector);

				if (count > 3) {
					// Need at least 3 products
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
							// Title - try multiple approaches
							let title = "";

							// Try data-automation-id first
							const titleByAutomation = card.querySelector(
								'[data-automation-id="product-title"]',
							) as HTMLElement;
							if (titleByAutomation) {
								title = titleByAutomation.innerText?.trim() || "";
							}

							// Try span with product title
							if (!title) {
								const titleBySpan = card.querySelector(
									'span[data-automation-id="product-title"]',
								) as HTMLElement;
								if (titleBySpan) {
									title = titleBySpan.innerText?.trim() || "";
								}
							}

							// Try any link with text
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

							if (!title) return null;

							// Product URL
							const linkElement =
								card.querySelector('a[href*="/ip/"]') ||
								card.querySelector("a[link-identifier]") ||
								card.querySelector("a[href]");
							const detailLink = linkElement?.getAttribute("href") || "N/A";

							// Image
							const imageElement = card.querySelector(
								"img",
							) as HTMLImageElement;
							const imageLink =
								imageElement?.src ||
								imageElement?.getAttribute("data-src") ||
								imageElement?.getAttribute("srcset")?.split(" ")[0] ||
								"N/A";

							// Price - be very flexible
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

							// Rating
							let rating = "N/A";
							const ratingElement =
								card.querySelector('[aria-label*="star"]') ||
								card.querySelector('[class*="rating"]');
							if (ratingElement) {
								rating =
									ratingElement.getAttribute("aria-label") ||
									(ratingElement as HTMLElement).innerText?.trim() ||
									"N/A";
							}

							// Review count
							let reviewCount = "N/A";
							const reviewElement = card.querySelector('[class*="review"]');
							if (reviewElement) {
								reviewCount =
									(reviewElement as HTMLElement).innerText?.trim() || "N/A";
							}

							// Badges
							const isSponsored =
								card.textContent?.includes("Sponsored") ||
								card.textContent?.includes("Ad")
									? "yes"
									: "no";

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
								isSponsored,
								hasFreeShipping,
								hasWalmartPlus: "no", // Hard to detect
							};
						} catch (error) {
							return { error: true, message: String(error) };
						}
					})
					.filter(Boolean);
			}, workingSelector);

			console.log(`Extracted ${data.length} products from page`);

			// Get next page URL
			const nextPageUrl = await page.evaluate(() => {
				const nextSelectors = [
					'a[aria-label="Next page"]',
					'button[aria-label="Next page"]',
					".paginator-btn-next",
					'[class*="next"]',
				];

				for (const sel of nextSelectors) {
					const nextBtn = document.querySelector(sel);
					if (
						nextBtn &&
						!nextBtn.classList.contains("disabled") &&
						!nextBtn.hasAttribute("disabled") &&
						!nextBtn.getAttribute("aria-disabled")
					) {
						return nextBtn.getAttribute("href") || null;
					}
				}
				return null;
			});

			await browser.close();
			return { data, nextPageUrl };
		} catch (error) {
			console.error("Error in scrapePage:", (error as Error).message);
			await page.screenshot({
				path: `walmart-error-page-${Date.now()}.png`,
				fullPage: true,
			});
			await browser.close();
			throw error;
		}
	}

	// Main search method - public interface
	async search(query: string, maxPages: number = 2): Promise<CrawledProduct[]> {
		try {
			console.log("Walmart Search:", query);
			console.log("Max pages:", maxPages);
			console.log("------------------------------------");

			// Get search results URL
			let currentUrl = await this.getSearchResultsUrl(query);

			const allData: any[] = [];

			// Loop through pages
			for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
				console.log(`\nScraping Walmart Page ${pageNum}...`);

				const { data, nextPageUrl } = await this.scrapePage(currentUrl);

				allData.push(...data);

				if (!nextPageUrl) {
					console.log("No more pages. Stopping.");
					break;
				}

				// Handle relative URLs
				currentUrl = nextPageUrl.startsWith("http")
					? nextPageUrl
					: `https://www.walmart.com${nextPageUrl}`;

				await this.delay(2000);
			}

			console.log(
				`\nWalmart scraping finished. Found ${allData.length} products.\n`,
			);

			// Transform to CrawledProduct format
			return this.transformResults(allData);
		} catch (error) {
			console.error("Error in Walmart search:", error);
			return [];
		}
	}

	// Transform Walmart results to match CrawledProduct interface
	private transformResults(rawData: any[]): CrawledProduct[] {
		return rawData.map((item) => ({
			title: item.title,
			price: this.parsePrice(item.price),
			currency: "USD",
			imageUrl:
				item.imageUrl !== "N/A" ? this.fixImageUrl(item.imageUrl) : undefined,
			productUrl:
				item.detailPageUrl !== "N/A"
					? this.fixProductUrl(item.detailPageUrl)
					: undefined,
			source: "Walmart",
			rating: this.parseRating(item.rating),
			reviewCount: this.parseReviewCount(item.reviewCount),
			isSponsored: item.isSponsored === "yes",
			hasFreeShipping: item.hasFreeShipping === "yes",
			hasWalmartPlus: item.hasWalmartPlus === "yes",
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

	// Helper to parse rating strings
	private parseRating(ratingString: string): number | undefined {
		if (!ratingString || ratingString === "N/A") return undefined;

		const match = ratingString.match(/(\d+\.?\d*)/);
		if (match) {
			return parseFloat(match[1]);
		}
		return undefined;
	}

	// Helper to parse review count
	private parseReviewCount(countString: string): number | undefined {
		if (!countString || countString === "N/A") return undefined;

		const match = countString.match(/[\d,]+/);
		if (match) {
			return parseInt(match[0].replace(/,/g, ""), 10);
		}
		return undefined;
	}

	// Fix image URLs
	private fixImageUrl(url: string): string {
		if (url.startsWith("//")) {
			return `https:${url}`;
		}
		if (!url.startsWith("http")) {
			return `https://www.walmart.com${url}`;
		}
		return url;
	}

	// Fix product URLs
	private fixProductUrl(url: string): string {
		if (url.startsWith("//")) {
			return `https:${url}`;
		}
		if (!url.startsWith("http")) {
			return `https://www.walmart.com${url}`;
		}
		return url;
	}
}
