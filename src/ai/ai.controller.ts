import { Controller, Get, Query } from "@nestjs/common";
import type { AiService } from "./ai.services.";

@Controller("ai")
export class AiController {
	constructor(private readonly aiService: AiService) {}

	@Get("expand")
	async expand(@Query("q") query: string) {
		return this.aiService.expandQuery(query);
	}

	@Get("rank")
	async rank(@Query("q") query: string) {
		const mockProducts = [
			{ title: "Blue Tote Bag", price: 30 },
			{ title: "Deming Tote Bag", price: 28 },
			{ title: "Leather Handbag", price: 15 },
		];

		return this.aiService.rankProducts(query, mockProducts);
	}
}
