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
	UnauthorizedException,
	UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthGuard } from "@nestjs/passport";
import { map, Observable } from "rxjs";
import { AiService } from "src/ai/ai.services";
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

/**
 * @openapi
 * tags:
 *   - name: Search
 *     description: Real-time product search and streaming endpoints
 */
@Controller("search")
export class SearchStreamController {
	constructor(
		private readonly crawlerService: CrawlerService,
		private readonly orchestrator: SearchOrchestratorService,
		private readonly crawlSessionService: CrawlSessionService,
		private readonly jwtService: JwtService,
		private readonly aiService: AiService,
	) {}

	/**
	 * @openapi
	 * /search/stream:
	 *   get:
	 *     tags:
	 *       - Search
	 *     summary: Stream real-time product search results
	 *     description: |
	 *       Streams ranked product results in real time using *Server-Sent Events (SSE)*.
	 *       Authentication is done via JWT token passed as a *query parameter*
	 *       because EventSource does not support headers.
	 *
	 *     parameters:
	 *       - in: query
	 *         name: q
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Search query (e.g. "iphone 14")
	 *
	 *       - in: query
	 *         name: token
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: JWT authentication token
	 *
	 *     responses:
	 *       200:
	 *         description: Real-time SSE stream started
	 *       400:
	 *         description: Missing or invalid query parameter
	 *       401:
	 *         description: Invalid or expired JWT token
	 */
	@Sse("stream")
	async streamSearch(
		@Query("q") query: string,
		@Query("token") token?: string,
	): Promise<Observable<MessageEvent>> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException('Query parameter "q" is required');
		}

		// Validate authentication token
		if (!token) {
			throw new UnauthorizedException("Authentication token required");
		}
		query = await this.aiService.normalizeQuery(query);
		let userId: string | null = null;

		try {
			// Verify JWT token
			const payload = await this.jwtService.verifyAsync(token, {
				secret: process.env.JWT_SECRET || "your-secret-key",
			});

			userId = payload.userId || payload.sub || null;

			console.log(
				`🚀 Starting SSE stream for query: "${query}" (userId: ${userId || "anonymous"})`,
			);
		} catch (error) {
			console.error("Token verification failed:", error);
			throw new UnauthorizedException("Invalid or expired token");
		}

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
	 * @openapi
	 * /search/results/{searchId}:
	 *   get:
	 *     tags:
	 *       - Search History
	 *     summary: Get search results by search ID
	 *     security:
	 *       - bearerAuth: []
	 *
	 *     parameters:
	 *       - in: path
	 *         name: searchId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Unique search session ID
	 *
	 *     responses:
	 *       200:
	 *         description: Search results retrieved successfully
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Search session not found
	 */
	@UseGuards(AuthGuard("jwt"))
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
		const userId = req?.user?.userId || null;
		if (session.userId && session.userId !== userId) {
			throw new BadRequestException("Unauthorized");
		}

		// Get ranked products from MongoDB
		const rankedProducts =
			await this.crawlSessionService.getRankedProducts(searchId);
		const productScores =
			await this.crawlSessionService.getProductScores(searchId);

		return {
			searchId: session.searchId,
			query: session.query,
			status: session.status,
			platformStats: session.platformStats,
			totalProducts: rankedProducts.length,
			rankedProducts,
			productScores,
			metadata: session.metadata,
			createdAt: session.createdAt,
			completedAt: session.completedAt,
		};
	}

	/**
	 * @openapi
	 * /search/history:
	 *   get:
	 *     tags:
	 *       - Search History
	 *     summary: Get authenticated user's search history
	 *     security:
	 *       - bearerAuth: []
	 *
	 *     parameters:
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *         description: Number of records to return (default: 50)
	 *
	 *       - in: query
	 *         name: skip
	 *         schema:
	 *           type: integer
	 *         description: Number of records to skip
	 *
	 *     responses:
	 *       200:
	 *         description: User search history retrieved successfully
	 *       400:
	 *         description: Authentication required
	 */
	@UseGuards(AuthGuard("jwt"))
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
