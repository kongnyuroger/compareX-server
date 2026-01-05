import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
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
		JwtModule.register({
			secret: process.env.JWT_SECRET || "your-secret-key",
			signOptions: { expiresIn: "7d" },
		}),
		CrawlerModule,
		AiModule,
	],
	controllers: [SearchStreamController],
	providers: [SearchOrchestratorService, CrawlSessionService],
	exports: [CrawlSessionService],
})
export class SearchModule {}
