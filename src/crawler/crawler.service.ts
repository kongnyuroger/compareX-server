// src/crawler/crawler.service.ts

import { Injectable } from "@nestjs/common";
import { AlibabaCrawler } from "./crawler.alibaba";
import { AmazonCrawler } from "./crawler.amazon";
import { CrawledProduct } from "./types/crawler.types";

@Injectable()
export class CrawlerService {
	private readonly alibaba = new AlibabaCrawler();
	private readonly amazon = new AmazonCrawler();

	async searchAllSites(query: string): Promise<CrawledProduct[]> {
		// Run searches in parallel for better performance
		const [alibabaResults, amazonResults] = await Promise.all([
			this.alibaba.search(query),
			this.amazon.search(query),
		]);

		return [...alibabaResults, ...amazonResults];
	}

	// Optional: Search individual sites
	async searchAmazon(
		query: string,
		maxPages: number = 2,
	): Promise<CrawledProduct[]> {
		return this.amazon.search(query, maxPages);
	}

	async searchAlibaba(query: string): Promise<CrawledProduct[]> {
		return this.alibaba.search(query);
	}
}
