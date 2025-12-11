import {
	BadRequestException,
	Controller,
	Get,
	NotFoundException,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { AiService } from "src/ai/ai.services";
import { CrawlerService } from "src/crawler/crawler.service";
import { SearchParamsDto } from "./dto/search-params.dto";
import { SearchHistoryService } from "./search-history.service";

interface UserRequest extends Request {
	user?: {
		userId: string;
		email: string;
		username: string;
	};
}

@Controller("search")
export class SearchHistoryController {
	constructor(
		private readonly searchHistoryService: SearchHistoryService,
		private readonly crawlerService: CrawlerService,
		private readonly aiService: AiService,
	) {}

	/**
	 * MAIN SEARCH ENDPOINT
	 * Stores 100% of product object data
	 * Supports anonymous + logged-in users
	 */
	@Get()
	async search(
		@Query("q") query: string,
		@Query() searchParams: SearchParamsDto,
		@Req() req: UserRequest,
	) {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException('Query parameter "q" is required');
		}

		const userId = req.user?.userId || null;

		// 1️⃣ Crawl all platforms
		const crawledProducts = await this.crawlerService.searchAllSites(query);

		// 2️⃣ Rank + filter via AI
		const rankedResults = await this.aiService.rankAndLimitProducts(
			query,
			crawledProducts,
			{
				resultsPerPlatform: searchParams.resultsPerPlatform || 30,
				globalLimit: searchParams.globalLimit || 90,
				minRelevanceScore: searchParams.minScore || 0.5,
				sortBy: searchParams.sortBy || "relevance",
			},
		);

		// 3️⃣ Build platform stats for MongoDB storage
		const platformStats =
			rankedResults.platformStats?.map((p: any) => ({
				platform: p.platform,
				total: p.total,
				kept: p.kept,
				discarded: p.discarded,
			})) || [];

		// 4️⃣ SAVE EVERYTHING — full product data, not trimmed
		const searchId = await this.searchHistoryService.saveSearch(
			query,
			userId,
			{
				resultsPerPlatform: searchParams.resultsPerPlatform || 30,
				globalLimit: searchParams.globalLimit || 90,
				minScore: searchParams.minScore || 0.5,
				sortBy: searchParams.sortBy || "relevance",
				balance: searchParams.balance || false,
			},
			{
				totalFound: rankedResults.totalFound,
				totalAfterFiltering: rankedResults.totalAfterFiltering,
				platformStats,
			},
			rankedResults.rankedProducts, // ⬅ FULL PRODUCTS STORED
			rankedResults.otherProducts, // ⬅ FULL PRODUCTS STORED
		);

		return {
			searchId,
			...rankedResults,
		};
	}

	/**
	 * GET USER HISTORY
	 * Only logged-in users can see their own history
	 */
	@UseGuards(AuthGuard("jwt"))
	@Get("history")
	async getHistory(
		@Req() req: UserRequest,
		@Query("limit") limit?: number,
		@Query("skip") skip?: number,
	) {
		const userId = req.user!.userId;

		return this.searchHistoryService.getUserHistory(
			userId,
			limit ? +limit : 50,
			skip ? +skip : 0,
		);
	}

	/**
	 * GET A SAVED SEARCH BY ID
	 * Returns EXACT stored products
	 */
	@Get("history/:id")
	async getSearchById(@Param("id") searchId: string, @Req() req: UserRequest) {
		const userId = req.user?.userId || null;

		const search = await this.searchHistoryService.getSearchById(
			searchId,
			userId,
		);

		if (!search) {
			throw new NotFoundException("Search not found");
		}

		return {
			searchId: search.searchId,
			query: search.query,
			resultsSummary: search.resultsSummary,
			rankedProducts: search.rankedProducts, // FULL RAW PRODUCTS
			otherProducts: search.otherProducts, // FULL RAW PRODUCTS
			filters: search.searchParams,
			createdAt: search.createdAt,
		};
	}

	/**
	 * REPLAY SEARCH
	 * Returns 100% raw saved data, identical to original search()
	 */
	@UseGuards(AuthGuard("jwt"))
	@Post("history/:id/replay")
	async replaySearch(@Param("id") searchId: string, @Req() req: UserRequest) {
		const userId = req.user?.userId || null;

		const search = await this.searchHistoryService.getSearchById(
			searchId,
			userId,
		);

		if (!search) {
			throw new NotFoundException("Search not found");
		}

		// Build per-platform counts dynamically
		const platformStats =
			search.resultsSummary?.platformStats ||
			this.buildPlatformStats(search.rankedProducts, search.otherProducts);

		return {
			searchId: search.searchId,
			query: search.query,
			resultsSummary: {
				...search.resultsSummary,
				platformStats,
			},
			rankedProducts: search.rankedProducts,
			otherProducts: search.otherProducts,
			filters: search.searchParams,
			fromHistory: true,
			originalSearchDate: search.createdAt,
		};
	}

	private buildPlatformStats(ranked: any[], other: any[]) {
		const platforms = new Map<string, number>();

		[...ranked, ...other].forEach((p) => {
			platforms.set(p.source, (platforms.get(p.source) || 0) + 1);
		});

		return Array.from(platforms.entries()).map(([platform, count]) => ({
			platform,
			total: count,
			kept: count,
			discarded: 0,
		}));
	}
}
