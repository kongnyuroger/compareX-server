// src/search-history/search-history.controller.ts

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
import { lastValueFrom } from "rxjs";
import { AiService } from "src/ai/ai.services";
import { MOCK_PRODUCTS } from "src/ai/constants/mock-products";
import { CrawlerService } from "src/crawler/crawler.service";
import { CrawledProduct } from "src/crawler/types/crawler.types";
import { CrawlerEventType } from "src/crawler/types/crawler-events";
import { SearchParamsDto } from "./dto/search-params.dto";
import { SearchHistoryService } from "./search-history.service";

interface UserRequest extends Request {
	user?: {
		userId: string;
		email: string;
		username: string;
	};
}

@Controller("searchHistory")
export class SearchHistoryController {
	constructor(
		private readonly searchHistoryService: SearchHistoryService,
		private readonly crawlerService: CrawlerService,
		private readonly aiService: AiService,
	) {}

	/**
	 * MAIN SEARCH ENDPOINT (Legacy - Non-Streaming)
	 * For backward compatibility
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

		// Collect all products from streaming crawlers
		const crawledProducts: CrawledProduct[] = [];

		const crawlerEvents$ = this.crawlerService.streamAllSites(query, 1);

		// Convert Observable to Promise and collect all products
		await new Promise<void>((resolve, reject) => {
			crawlerEvents$.subscribe({
				next: (event) => {
					if (event.type === CrawlerEventType.PRODUCT) {
						crawledProducts.push(event.product);
					}
				},
				complete: () => resolve(),
				error: (err) => reject(err),
			});
		});

		// Rank products using ID-based ranking
		const rankedIds = await this.aiService.rankProductsByIds(
			query,
			crawledProducts,
		);

		// Reconstruct products in ranked order
		const rankedProducts = rankedIds
			.map((id) => crawledProducts.find((p) => p.id === id))
			.filter((p): p is CrawledProduct => p !== undefined);

		// Build platform stats
		const platformStats = crawledProducts.reduce(
			(acc, product) => {
				const platform = product.source;
				if (!acc[platform]) {
					acc[platform] = { platform, total: 0 };
				}
				acc[platform].total++;
				return acc;
			},
			{} as Record<string, { platform: string; total: number }>,
		);

		// Save to database
		const searchId = await this.searchHistoryService.saveSearch(
			query,
			userId,
			searchParams,
			rankedProducts,
		);

		return {
			searchId,
			query,
			totalProducts: rankedProducts.length,
			platformStats: Object.values(platformStats),
			rankedProducts,
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
		const userId = req.user!.userId;

		return this.searchHistoryService.getUserHistory(
			userId,
			limit ? +limit : 50,
			skip ? +skip : 0,
		);
	}

	/**
	 * GET A SAVED SEARCH BY ID
	 */
	@UseGuards(AuthGuard("jwt"))
	@Get("history/:id")
	async getSearchById(@Param("id") searchId: string, @Req() req: UserRequest) {
		console.log("session user:", req.user);
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
		// Return mock data or implement trending logic
		return {
			trending: MOCK_PRODUCTS,
		};
	}
}
