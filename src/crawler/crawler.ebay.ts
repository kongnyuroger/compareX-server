// src/crawler/crawler.ebay.ts

import puppeteer, { Browser, Page } from "puppeteer-core";
import { CrawledProduct } from "./types/crawler.types";

export class EbayCrawler {
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

			// Go directly to search results - eBay uses _nkw parameter for search
			const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
				searchPhrase,
			)}`;

			console.log("Going directly to eBay search URL:", searchUrl);
			await page.goto(searchUrl, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});

			// Wait for page to render
			await this.delay(5000);

			// Take a screenshot
			await page.screenshot({ path: "ebay-loaded.png", fullPage: true });

			const pageContent = await page.content();
			const pageTitle = await page.title();
			console.log("Page title:", pageTitle);

			// Get body text for debugging
			const bodyText = await page.evaluate(() => document.body.innerText);
			console.log("Body text length:", bodyText.length);
			console.log("First 500 chars:", bodyText.substring(0, 500));

			// Check for blocking
			if (
				bodyText.includes("Access Denied") ||
				bodyText.includes("blocked") ||
				pageTitle.toLowerCase().includes("access denied")
			) {
				throw new Error("eBay is blocking access - check ebay-loaded.png");
			}

			// Try multiple selectors for eBay product cards
			const possibleSelectors = [
				".s-item", // Main product item class
				".srp-results .s-item",
				"li.s-item",
				'[class*="s-item"]',
				".srp-river-results li",
				"ul.srp-results li",
				'[data-view="mi:1686"]', // eBay's data attribute
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
						'[class*="item"], [class*="product"], [class*="srp"], li',
					);
					return Array.from(elements)
						.slice(0, 20)
						.map((el) => ({
							tag: el.tagName,
							class: el.className,
							id: el.id,
							hasImage: !!el.querySelector("img"),
							hasLink: !!el.querySelector("a"),
							textPreview: (el as HTMLElement).innerText?.substring(0, 50),
						}));
				});
				console.log("Elements found:", JSON.stringify(classInfo, null, 2));
				console.log("======================\n");

				// Save HTML for inspection
				const fs = require("fs");
				fs.writeFileSync("ebay-page.html", pageContent);
				console.log("Page HTML saved to ebay-page.html");

				throw new Error(
					"Could not find product cards - check ebay-loaded.png and ebay-page.html",
				);
			}

			const url = page.url();
			await browser.close();
			return url;
		} catch (error) {
			console.error("Error in getSearchResultsUrl:", (error as Error).message);
			await page.screenshot({
				path: "ebay-error-screenshot.png",
				fullPage: true,
			});

			const content = await page.content();
			const fs = require("fs");
			fs.writeFileSync("ebay-page.html", content);
			console.log("Page HTML saved to ebay-page.html");

			await browser.close();
			throw error;
		}
	}

	// Scrape a single eBay result page
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

			console.log("Navigating to eBay:", url);
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

			// Wait for page to stabilize - longer wait for eBay
			await this.delay(7000);

			// Take screenshot for debugging
			await page.screenshot({ path: `ebay-scrape-${Date.now()}.png` });

			// Log what's on the page
			console.log("\n=== CHECKING PAGE CONTENT ===");
			const debugInfo = await page.evaluate(() => {
				return {
					hasLi: document.querySelectorAll("li").length,
					hasUl: document.querySelectorAll("ul").length,
					hasSItem: document.querySelectorAll('[class*="s-item"]').length,
					hasItem: document.querySelectorAll('[class*="item"]').length,
					allClasses: Array.from(document.querySelectorAll("*"))
						.slice(0, 100)
						.map((el) => el.className)
						.filter((c) => c && typeof c === "string" && c.includes("item"))
						.slice(0, 10),
				};
			});
			console.log("Debug info:", JSON.stringify(debugInfo, null, 2));
			console.log("==============================\n");

			// Find product cards - try all possible selectors
			const possibleSelectors = [
				".s-item",
				"li.s-item",
				".srp-results .s-item",
				"ul.srp-results li",
				'[class*="s-item"]',
				'[data-view="mi:1686"]',
				".srp-river-results li",
				"ul[class*='srp'] li",
			];

			let workingSelector = "";
			for (const selector of possibleSelectors) {
				const count = await page.evaluate((sel) => {
					return document.querySelectorAll(sel).length;
				}, selector);

				console.log(`Testing "${selector}": ${count} elements`);

				if (count > 2) {
					// Need at least 2 products (first one is often a header)
					console.log(`✓ Using selector: ${selector}`);
					workingSelector = selector;
					break;
				}
			}

			if (!workingSelector) {
				// Last resort - try to find any structure that looks like products
				console.log("Trying generic approach...");
				const genericCount = await page.evaluate(() => {
					const items = document.querySelectorAll("li");
					let productLikeItems = 0;
					items.forEach((li) => {
						const hasImage = !!li.querySelector("img");
						const hasLink = !!li.querySelector("a");
						const hasPrice = li.textContent?.includes("$");
						if (hasImage && hasLink && hasPrice) {
							productLikeItems++;
						}
					});
					return productLikeItems;
				});

				console.log(
					`Found ${genericCount} product-like items using generic approach`,
				);

				if (genericCount > 2) {
					workingSelector = "li"; // Use generic li selector
					console.log("✓ Using generic 'li' selector");
				} else {
					throw new Error("No product cards found on page");
				}
			}

			const data = await page.evaluate((selector) => {
				const cards = [...document.querySelectorAll(selector)] as HTMLElement[];

				return cards
					.map((card) => {
						try {
							// Filter out non-product items
							const hasImage = !!card.querySelector("img");
							const hasLink = !!card.querySelector("a");
							const hasTextContent =
								card.textContent && card.textContent.trim().length > 20;

							if (!hasImage || !hasLink || !hasTextContent) {
								return null;
							}

							// Title - try multiple approaches
							let title = "";
							const titleSelectors = [
								".s-item__title",
								"h3",
								'[role="heading"]',
								".s-item__title span",
								"div[class*='title']",
								"a[href*='/itm/']",
							];

							for (const sel of titleSelectors) {
								const el = card.querySelector(sel) as HTMLElement;
								if (el && el.innerText?.trim()) {
									title = el.innerText.trim();
									break;
								}
							}

							// If still no title, try getting it from any link
							if (!title) {
								const links = card.querySelectorAll("a");
								for (const link of links) {
									const text = (link as HTMLElement).innerText?.trim();
									if (
										text &&
										text.length > 10 &&
										!text.toLowerCase().includes("shop")
									) {
										title = text;
										break;
									}
								}
							}

							// Skip items without valid titles
							if (
								!title ||
								title.length < 5 ||
								title.toLowerCase().includes("shop on ebay") ||
								title.toLowerCase().includes("see more")
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
							const imageElement = card.querySelector(
								"img",
							) as HTMLImageElement;
							const imageLink =
								imageElement?.src ||
								imageElement?.getAttribute("data-src") ||
								imageElement?.getAttribute("srcset")?.split(" ")[0] ||
								"N/A";

							// Price - very flexible
							let price = "N/A";
							const priceSelectors = [
								".s-item__price",
								'[class*="price"]',
								'span[class*="POSITIVE"]',
							];

							for (const sel of priceSelectors) {
								const el = card.querySelector(sel) as HTMLElement;
								if (el && el.innerText?.trim()) {
									const text = el.innerText.trim();
									if (text.includes("$") || /\d/.test(text)) {
										price = text;
										break;
									}
								}
							}

							// If still no price, search text content
							if (price === "N/A" && card.textContent) {
								const priceMatch = card.textContent.match(/\$[\d,]+\.?\d*/);
								if (priceMatch) {
									price = priceMatch[0];
								}
							}

							// Condition
							let condition = "N/A";
							if (card.textContent) {
								if (card.textContent.includes("Brand New"))
									condition = "Brand New";
								else if (card.textContent.includes("New")) condition = "New";
								else if (card.textContent.includes("Used")) condition = "Used";
								else if (card.textContent.includes("Refurbished"))
									condition = "Refurbished";
								else if (card.textContent.includes("Pre-Owned"))
									condition = "Pre-Owned";
							}

							// Shipping
							let shipping = "N/A";
							const shippingElement =
								card.querySelector(".s-item__shipping") ||
								card.querySelector('[class*="shipping"]');
							if (shippingElement) {
								shipping =
									(shippingElement as HTMLElement).innerText?.trim() || "N/A";
							} else if (card.textContent?.includes("Free shipping")) {
								shipping = "Free shipping";
							}

							// Sponsored
							const isSponsored =
								card.textContent?.includes("SPONSORED") ||
								card.textContent?.includes("Sponsored")
									? "yes"
									: "no";

							// Buy It Now
							const isBuyItNow = card.textContent?.includes("Buy It Now")
								? "yes"
								: "no";

							return {
								title,
								detailPageUrl: detailLink,
								imageUrl: imageLink,
								price,
								condition,
								shipping,
								seller: "N/A",
								watchCount: "N/A",
								isSponsored,
								isBuyItNow,
							};
						} catch (error) {
							console.error("Error parsing product card:", error);
							return null;
						}
					})
					.filter(Boolean);
			}, workingSelector);

			console.log(`Extracted ${data.length} products from page`);

			if (data.length === 0) {
				console.log("WARNING: No products extracted. Check screenshots.");
			}

			// Get next page URL
			const nextPageUrl = await page.evaluate(() => {
				const nextSelectors = [
					"a.pagination__next",
					'a[type="next"]',
					'nav.pagination a[aria-label*="Next"]',
					'.pagination__next:not([aria-disabled="true"])',
					'a[aria-label="Go to next search page"]',
				];

				for (const sel of nextSelectors) {
					const nextBtn = document.querySelector(sel);
					if (
						nextBtn &&
						!nextBtn.classList.contains("pagination__next--disabled") &&
						!nextBtn.hasAttribute("aria-disabled")
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
				path: `ebay-error-page-${Date.now()}.png`,
				fullPage: true,
			});
			await browser.close();
			throw error;
		}
	}

	// Main search method
	async search(query: string, maxPages: number = 2): Promise<CrawledProduct[]> {
		try {
			console.log("eBay Search:", query);
			console.log("Max pages:", maxPages);
			console.log("------------------------------------");

			let currentUrl = await this.getSearchResultsUrl(query);

			const allData: any[] = [];

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

			return this.transformResults(allData);
		} catch (error) {
			console.error("Error in eBay search:", error);
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
			source: "eBay",
			condition: item.condition !== "N/A" ? item.condition : undefined,
			shipping: item.shipping !== "N/A" ? item.shipping : undefined,
			seller: item.seller !== "N/A" ? item.seller : undefined,
			watchCount: item.watchCount !== "N/A" ? item.watchCount : undefined,
			isSponsored: item.isSponsored === "yes",
			isBuyItNow: item.isBuyItNow === "yes",
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

		if (priceString.includes("$") || priceString.includes("USD")) return "USD";
		if (priceString.includes("€") || priceString.includes("EUR")) return "EUR";
		if (priceString.includes("£") || priceString.includes("GBP")) return "GBP";
		if (priceString.includes("¥") || priceString.includes("JPY")) return "JPY";
		if (priceString.includes("C$") || priceString.includes("CAD")) return "CAD";
		if (priceString.includes("A$") || priceString.includes("AUD")) return "AUD";

		return "USD";
	}

	private fixImageUrl(url: string): string {
		if (url.startsWith("//")) {
			return `https:${url}`;
		}
		if (!url.startsWith("http")) {
			return `https://www.ebay.com${url}`;
		}
		return url;
	}

	private fixProductUrl(url: string): string {
		if (url.startsWith("//")) {
			return `https:${url}`;
		}
		if (!url.startsWith("http")) {
			return `https://www.ebay.com${url}`;
		}
		return url;
	}
}
