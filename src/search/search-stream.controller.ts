// src/search/search-stream.controller.ts

import {
	BadRequestException,
	Controller,
	Get,
	MessageEvent,
	NotFoundException,
	Param,
	Query,
	Req,
	Sse,
} from "@nestjs/common";
import { map, Observable } from "rxjs";
import { CrawlerService } from "src/crawler/crawler.service";
import { CrawlSessionService } from "./services/crawl-session.service";
import { SearchOrchestratorService } from "./services/search-orchestrator.service";

interface UserRequest extends Request {
	user?: {
		userId: string;
		email: string;
		username: string;
	};
}

@Controller("search")
export class SearchStreamController {
	constructor(
		private readonly crawlerService: CrawlerService,
		private readonly orchestrator: SearchOrchestratorService,
		private readonly crawlSessionService: CrawlSessionService,
	) {}

	/**
	 * SSE endpoint for streaming search results
	 * Creates a crawl session and stores all products in MongoDB
	 *
	 * Usage: GET /search/stream?q=iphone
	 */
	@Sse("stream")
	async streamSearch(
		@Query("q") query: string,
		@Req() req: UserRequest,
	): Promise<Observable<MessageEvent>> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException('Query parameter "q" is required');
		}

		const userId = req.user?.userId || null;

		console.log(
			`🚀 Starting SSE stream for query: "${query}" (userId: ${userId || "anonymous"})`,
		);

		// Create crawl session in database
		const searchId = await this.crawlSessionService.createSession(
			query,
			userId,
		);

		console.log(`📝 Created crawl session: ${searchId}`);

		// Start crawling
		const crawlerEvents$ = this.crawlerService.streamAllSites(query, 1);

		// Orchestrate and rank
		const searchMessages$ = this.orchestrator.orchestrateSearch(
			searchId,
			query,
			crawlerEvents$,
		);

		// Transform to SSE MessageEvent format
		return searchMessages$.pipe(
			map((message) => {
				// Inject searchId into all events
				return {
					type: message.event,
					data: {
						searchId,
						...(typeof message.data === "object" && message.data !== null
							? message.data
							: {}),
					},
				} as MessageEvent;
			}),
		);
	}

	/**
	 * Get historical search results by searchId
	 * Returns full products in ranked order from MongoDB
	 */
	@Get("results/:searchId")
	async getSearchResults(
		@Param("searchId") searchId: string,
		@Req() req: UserRequest,
	) {
		const session = await this.crawlSessionService.getSession(searchId);

		if (!session) {
			throw new NotFoundException("Search session not found");
		}

		// Authorization check
		const userId = req.user?.userId || null;
		if (session.userId && session.userId !== userId) {
			throw new BadRequestException("Unauthorized");
		}

		// Get ranked products from MongoDB
		const rankedProducts =
			await this.crawlSessionService.getRankedProducts(searchId);

		return {
			searchId: session.searchId,
			query: session.query,
			status: session.status,
			platformStats: session.platformStats,
			totalProducts: rankedProducts.length,
			rankedProducts, // Full product objects in ranked order
			metadata: session.metadata,
			createdAt: session.createdAt,
			completedAt: session.completedAt,
		};
	}

	/**
	 * Get user's search history
	 */
	@Get("history")
	async getUserHistory(
		@Query("limit") limit?: number,
		@Query("skip") skip?: number,
		@Req() req?: UserRequest,
	) {
		const userId = req?.user?.userId;

		if (!userId) {
			throw new BadRequestException("Authentication required");
		}

		const sessions = await this.crawlSessionService.getUserSessions(
			userId,
			limit ? +limit : 50,
			skip ? +skip : 0,
		);

		return {
			sessions,
			total: sessions.length,
		};
	}
}
