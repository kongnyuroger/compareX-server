import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { CrawlerService } from "src/crawler/crawler.service";
import { AiService } from "./ai.services";
import { MOCK_PRODUCTS } from "./constants/mock-products";

@Controller("ai")
export class AiController {
	constructor(
		private readonly aiService: AiService,
		private readonly crawlerService: CrawlerService,
	) {}

	@Get("expand")
	async expand(@Query("q") query: string): Promise<any> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException("Query parameter 'q' is required");
		}
		const crawledResults = await this.crawlerService.searchAllSites(query);
		return crawledResults;
	}
	@Get("rank")
	async rank(@Query("q") query: string): Promise<any> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException("Query parameter 'q' is required");
		}
		return this.aiService.rankProducts(query, MOCK_PRODUCTS);
	}

	@Get("compare")
	async compareProducts(
		@Query("q") query: string,
		@Query("resultsPerPlatform") resultsPerPlatform?: number,
		@Query("globalLimit") globalLimit?: number,
		@Query("minScore") minScore?: number,
		@Query("sortBy") sortBy?:
			| "relevance"
			| "price_low"
			| "price_high"
			| "rating",
	): Promise<any> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException("Query parameter 'q' is required");
		}

		// Crawl products from all sites
		const crawledProducts = await this.crawlerService.searchAllSites(query);

		// Apply intelligent limiting, scoring, and AI ranking
		return this.aiService.rankAndLimitProducts(query, crawledProducts, {
			resultsPerPlatform: resultsPerPlatform ? +resultsPerPlatform : 30,
			globalLimit: globalLimit ? +globalLimit : 90,
			minRelevanceScore: minScore ? +minScore : 0.5,
			sortBy: sortBy || "relevance",
		});
	}
}
