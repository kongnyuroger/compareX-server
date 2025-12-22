import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import type { AiService } from "./ai.services";
import { MOCK_PRODUCTS } from "./constants/mock-products";
@Controller("ai")
export class AiController {
	constructor(private readonly aiService: AiService) {}

	@Get("expand")
	async expand(@Query("q") query: string): Promise<any> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException("Query parameter 'q' is required");
		}
		//const terms =  await this.aiService.expandQuery(query);

		return this.aiService.rankProducts(query, MOCK_PRODUCTS);
	}

	@Get("rank")
	async rank(@Query("q") query: string): Promise<any> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException("Query parameter 'q' is required");
		}
		return this.aiService.rankProducts(query, MOCK_PRODUCTS);
	}
}
