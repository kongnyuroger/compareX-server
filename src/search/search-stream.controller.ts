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

@Controller("search")
export class SearchStreamController {
	constructor(
		private readonly crawlerService: CrawlerService,
		private readonly orchestrator: SearchOrchestratorService,
		private readonly crawlSessionService: CrawlSessionService,
		private readonly jwtService: JwtService, // Inject JwtService
		private readonly aiService: AiService,
	) {}

	/**
	 * SSE endpoint for streaming search results
	 * Accepts token as query parameter for EventSource compatibility
	 *
	 * Usage: GET /search/stream?q=iphone&token=JWT_TOKEN
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
		// Normalize query
		query = await this.aiService.normalizeQuery(query);
		console.log(`Normalized query: "${query}"`);

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
	 * Get historical search results by searchId
	 * Standard REST endpoint with JWT guard
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
	 * Get user's search history
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
