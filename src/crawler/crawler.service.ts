// src/crawler/crawler.service.ts

import { Injectable } from "@nestjs/common";
import { AlibabaCrawler } from "./crawler.alibaba";
import { AmazonCrawler } from "./crawler.amazon";
import { EbayCrawler } from "./crawler.ebay";
import { WalmartCrawler } from "./crawler.walmart";
import { CrawledProduct } from "./types/crawler.types";

@Injectable()
export class CrawlerService {
	private readonly alibaba = new AlibabaCrawler();
	private readonly amazon = new AmazonCrawler();
	private readonly walmart = new WalmartCrawler();
	private readonly ebay = new EbayCrawler();

	async searchAllSites(query: string): Promise<CrawledProduct[]> {
		// Run searches in parallel for better performance
		const [amazonResults, walmartResults, ebayResults] = await Promise.all([
			//this.alibaba.search(query, 1).catch(() => []), // Catch errors and return empty array
			this.amazon
				.search(query, 1)
				.catch(() => []),
			this.walmart.search(query, 1).catch(() => []),
			this.ebay.search(query, 1).catch(() => []),
		]);

		return [
			//...alibabaResults,
			...amazonResults,
			...walmartResults,
			...ebayResults,
		];
	}

	// Optional: Search individual sites
	async searchAmazon(
		query: string,
		maxPages: number = 2,
	): Promise<CrawledProduct[]> {
		return this.amazon.search(query, maxPages);
	}

	async searchAlibaba(
		query: string,
		maxPages: number = 2,
	): Promise<CrawledProduct[]> {
		return this.alibaba.search(query, maxPages);
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
