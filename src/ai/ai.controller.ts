import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { AiService } from "./ai.services";
import { MOCK_PRODUCTS } from "./constants/mock-products";
@Controller("ai")
export class AiController {
	constructor(private readonly aiService: AiService) {}

	@Get("expand")
	async expand(@Query("q") query: string): Promise<any> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException("Query parameter 'q' is required");
		}

		const normalizedQuery = this.aiService.normalizeQuery(query);
		//const terms =  await this.aiService.expandQuery(normalizedQuery);

		return normalizedQuery;
	}

	@Get("rank")
	async rank(@Query("q") query: string): Promise<any> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException("Query parameter 'q' is required");
		}
		return MOCK_PRODUCTS;
	}
}
