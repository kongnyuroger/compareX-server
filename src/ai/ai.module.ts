import { Module } from "@nestjs/common";
import { CrawlerService } from "src/crawler/crawler.service";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.services";

@Module({
	controllers: [AiController],
	providers: [AiService, CrawlerService],
	exports: [AiService],
})
export class AiModule {}
