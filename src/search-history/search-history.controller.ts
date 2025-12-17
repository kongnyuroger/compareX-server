import {
	BadRequestException,
	Controller,
	Get,
	NotFoundException,
	Param,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { AiService } from "src/ai/ai.services";
import { MOCK_PRODUCTS } from "src/ai/constants/mock-products";
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

		// Properly extract userId from authenticated user
		const userId = req.user?.userId || null;

		// Crawl all platforms
		const crawledProducts = await this.crawlerService.searchAllSites(query);

		// Rank + filter via AI
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

		// Build platform stats for MongoDB storage
		const platformStats =
			rankedResults.platformStats?.map((p: any) => ({
				platform: p.platform,
				total: p.total,
				kept: p.kept,
				discarded: p.discarded,
			})) || [];

		// SAVE EVERYTHING – full product data with userId
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
			rankedResults.rankedProducts,
			rankedResults.otherProducts,
		);

		return {
			searchId,
			...rankedResults,
		};
	}

	/**
	 * GET USER HISTORY
	 */
	@UseGuards(AuthGuard("jwt"))
	@Get("history")
	async getHistory(
		@Req() req: UserRequest,
		@Query("limit") limit?: number,
		@Query("skip") skip?: number,
	) {
		console.log(req.user);
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
	@UseGuards(AuthGuard("jwt"))
	@Get("history/:id")
	async getSearchById(@Param("id") searchId: string, @Req() req: UserRequest) {
		const userId = req.user!.userId || null;

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
			rankedProducts: search.rankedProducts,
			otherProducts: search.otherProducts,
			filters: search.searchParams,
			createdAt: search.createdAt,
		};
	}

	@Get("trending")
	async getTrending() {
		return MOCK_PRODUCTS;
	}
}
