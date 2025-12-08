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

		const crawledProducts = await this.crawlerService.searchAllSites(query);

		const rankedResults = await this.aiService.rankAndLimitProducts(
			query,
			crawledProducts,
			{
				resultsPerPlatform: searchParams.resultsPerPlatform ?? 30,
				globalLimit: searchParams.globalLimit ?? 90,
				minRelevanceScore: searchParams.minScore ?? 0.5,
				sortBy: searchParams.sortBy ?? "relevance",
			},
		);

		const searchId = await this.searchHistoryService.saveSearch(
			query,
			userId,
			{
				resultsPerPlatform: searchParams.resultsPerPlatform ?? 30,
				globalLimit: searchParams.globalLimit ?? 90,
				minScore: searchParams.minScore ?? 0.5,
				sortBy: searchParams.sortBy ?? "relevance",
				balance: searchParams.balance ?? false,
			},
			{
				totalFound: rankedResults.totalFound,
				totalAfterFiltering: rankedResults.totalAfterFiltering,
				platforms: rankedResults.platformStats?.map((s: any) => s.platform),
			},
			rankedResults.rankedProducts,
			rankedResults.otherProducts,
		);

		return {
			searchId,
			...rankedResults,
		};
	}
	@UseGuards(AuthGuard("jwt"))
	@Get("history")
	async getHistory(
		@Req() req: UserRequest,
		@Query("limit") limit?: number,
		@Query("skip") skip?: number,
	) {
		const userId = req.user!.userId;

		const validLimit = Math.min(Math.max(limit ? +limit : 50, 1), 100);
		const validSkip = Math.max(skip ? +skip : 0, 0);

		return this.searchHistoryService.getUserHistory(
			userId,
			validLimit,
			validSkip,
		);
	}

	@Post("history/:id")
	async rerunSearch(@Param("id") searchId: string, @Req() req: UserRequest) {
		const userId = req.user?.userId || null;

		const originalSearch = await this.searchHistoryService.getSearchById(
			searchId,
			userId,
		);

		if (!originalSearch) {
			throw new NotFoundException("Search not found");
		}

		return {
			searchId: originalSearch.searchId,
			query: originalSearch.query,
			rerun: true,
			totalFound: originalSearch.resultsSummary?.totalFound || 0,
			totalAfterFiltering:
				originalSearch.resultsSummary?.totalAfterFiltering || 0,
			platforms: originalSearch.resultsSummary?.platforms || [],
			rankedProducts: originalSearch.rankedProducts || [],
			otherProducts: originalSearch.otherProducts || [],
			filters: originalSearch.searchParams || {},
		};
	}

	@Get("stats")
	async getStats() {
		return this.searchHistoryService.getSearchStats();
	}
}
