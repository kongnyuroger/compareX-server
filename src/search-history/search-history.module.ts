import { Module } from "@nestjs/common";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { AiModule } from "src/ai/ai.module";
import { CrawlerModule } from "src/crawler/crawler.module";
import {
	SearchHistory,
	SearchHistorySchema,
} from "./schemas/search-history.schema";
import { SearchHistoryController } from "./search-history.controller";
import { SearchHistoryService } from "./search-history.service";

@Module({
	imports: [
		MongooseModule.forFeature([
			{
				name: SearchHistory.name,
				schema: SearchHistorySchema,
			},
		]),
		CrawlerModule,
		AiModule,
	],
	controllers: [SearchHistoryController],
	providers: [
		SearchHistoryService,
		{
			provide: "SEARCH_HISTORY_MODEL",
			useFactory: (model) => model,
			inject: [getModelToken(SearchHistory.name)],
		},
	],
	exports: [SearchHistoryService],
})
export class SearchHistoryModule {}
