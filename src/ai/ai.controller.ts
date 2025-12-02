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

		//const terms =  await this.aiService.expandQuery(query);

		const crawledResults = await this.crawlerService.searchWalmart(query, 1);
		//	return {
		//  crawled: crawledResults,

		//};
		return crawledResults;
		//return this.aiService.rankProducts(query, MOCK_PRODUCTS);
	}

	@Get("rank")
	async rank(@Query("q") query: string): Promise<any> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException("Query parameter 'q' is required");
		}
		return this.aiService.rankProducts(query, MOCK_PRODUCTS);
	}
}
