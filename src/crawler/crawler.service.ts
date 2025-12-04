import { Injectable } from "@nestjs/common";
import { AmazonCrawler } from "./crawler.amazon";
import { EbayCrawler } from "./crawler.ebay";
import { WalmartCrawler } from "./crawler.walmart";
import { CrawledProduct } from "./types/crawler.types";

@Injectable()
export class CrawlerService {
	private readonly amazon = new AmazonCrawler();
	private readonly walmart = new WalmartCrawler();
	private readonly ebay = new EbayCrawler();

	async searchAllSites(query: string): Promise<CrawledProduct[]> {
		console.log(`\n🔍 Starting parallel search for: "${query}"\n`);

		// Run searches in parallel with proper error handling
		const results = await Promise.allSettled([
			this.walmart.search(query, 1),
			this.amazon.search(query, 1),
			this.ebay.search(query, 1),
			// this.alibaba.search(query, 1), // Uncomment when Alibaba zone is ready
		]);

		// Collect successful results
		const allProducts: CrawledProduct[] = [];

		results.forEach((result, index) => {
			const siteName = ["Amazon", "Walmart", "eBay"][index];

			if (result.status === "fulfilled") {
				console.log(`✅${siteName}: Found ${result.value.length} products`);
				allProducts.push(...result.value);
			} else {
				console.log(` ${siteName}: Failed - ${result.reason.message}`);
			}
		});

		console.log(`\n🎉 Total products found: ${allProducts.length}\n`);

		return allProducts;
	}

	// Search individual sites
	async searchAmazon(
		query: string,
		maxPages: number = 2,
	): Promise<CrawledProduct[]> {
		return this.amazon.search(query, maxPages);
	}

	async searchWalmart(
		query: string,
		maxPages: number = 2,
	): Promise<CrawledProduct[]> {
		return this.walmart.search(query, maxPages);
	}

	async searchEbay(
		query: string,
		maxPages: number = 2,
	): Promise<CrawledProduct[]> {
		return this.ebay.search(query, maxPages);
	}
}
