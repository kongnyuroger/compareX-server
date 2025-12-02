// src/crawler/crawler.service.ts

import { Injectable } from "@nestjs/common";
import { AlibabaCrawler } from "./crawler.alibaba";
import { AmazonCrawler } from "./crawler.amazon";
import { WalmartCrawler } from "./crawler.walmart";
import { CrawledProduct } from "./types/crawler.types";

@Injectable()
export class CrawlerService {
	private readonly alibaba = new AlibabaCrawler();
	private readonly amazon = new AmazonCrawler();
	private readonly walmart = new WalmartCrawler();

	async searchAllSites(query: string): Promise<CrawledProduct[]> {
		// Run searches in parallel for better performance
		const [alibabaResults, amazonResults, walmartResults] = await Promise.all([
			this.alibaba
				.search(query, 2)
				.catch(() => []), // Catch errors and return empty array
			this.amazon.search(query, 2).catch(() => []),
			this.walmart.search(query, 2).catch(() => []),
		]);

		return [...alibabaResults, ...amazonResults, ...walmartResults];
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
}
