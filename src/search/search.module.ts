// src/search/search.module.ts

import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { AiModule } from "src/ai/ai.module";
import { CrawlerModule } from "src/crawler/crawler.module";
import { SearchStreamGateway } from "./gateways/search-stream.gateway";
import {
	CrawlSession,
	CrawlSessionSchema,
} from "./schemas/crawl-session.schema";
import { SearchStreamController } from "./search-stream.controller";
import { CrawlSessionService } from "./services/crawl-session.service";
import { SearchOrchestratorService } from "./services/search-orchestrator.service";

/**
 * Search Module
 *
 * Provides both WebSocket (Socket.IO) and REST endpoints for search
 *
 * Architecture:
 * - Gateway: Socket.IO for real-time streaming
 * - Controller: REST for historical results
 * - Services: Business logic with RxJS streams
 */
@Module({
	imports: [
		// MongoDB schemas
		MongooseModule.forFeature([
			{
				name: CrawlSession.name,
				schema: CrawlSessionSchema,
			},
		]),

		// JWT for authentication
		JwtModule.register({
			secret: process.env.JWT_SECRET || "your-secret-key",
			signOptions: { expiresIn: "7d" },
		}),

		// External modules
		CrawlerModule,
		AiModule,
	],

	// Controllers for REST endpoints
	controllers: [SearchStreamController],

	// Gateway for WebSocket/Socket.IO
	providers: [
		SearchStreamGateway,
		SearchOrchestratorService,
		CrawlSessionService,
	],

	// Export services for use in other modules
	exports: [CrawlSessionService, SearchOrchestratorService],
})
export class SearchModule {}
