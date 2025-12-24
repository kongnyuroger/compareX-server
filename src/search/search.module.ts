// src/search/search.module.ts

import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AiModule } from "src/ai/ai.module";
import { CrawlerModule } from "src/crawler/crawler.module";
import {
	CrawlSession,
	CrawlSessionSchema,
} from "./schemas/crawl-session.schema";
import { SearchStreamController } from "./search-stream.controller";
import { CrawlSessionService } from "./services/crawl-session.service";
import { SearchOrchestratorService } from "./services/search-orchestrator.service";

@Module({
	imports: [
		MongooseModule.forFeature([
			{
				name: CrawlSession.name,
				schema: CrawlSessionSchema,
			},
		]),
		CrawlerModule,
		AiModule,
	],
	controllers: [SearchStreamController],
	providers: [SearchOrchestratorService, CrawlSessionService],
	exports: [CrawlSessionService],
})
export class SearchModule {}
