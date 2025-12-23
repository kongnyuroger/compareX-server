// src/search/search.module.ts

import { Module } from "@nestjs/common";
import { AiModule } from "src/ai/ai.module";
import { CrawlerModule } from "src/crawler/crawler.module";
import { SearchOrchestratorService } from "./search-orchestrator.service";
import { SearchStreamController } from "./search-stream.controller";

@Module({
	imports: [CrawlerModule, AiModule],
	controllers: [SearchStreamController],
	providers: [SearchOrchestratorService],
	exports: [SearchOrchestratorService],
})
export class SearchModule {}
