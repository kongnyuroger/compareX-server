// src/search/services/search-orchestrator.service.ts

import { Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";
import { Observable, Subject } from "rxjs";
import { AiService } from "src/ai/ai.services";
import { CrawledProduct } from "src/crawler/types/crawler.types";
import {
	CrawlerEvent,
	CrawlerEventType,
	ProductEvent,
	ProductScore,
	SearchStreamMessage,
} from "src/crawler/types/crawler-events";
import { CrawlSessionService } from "./crawl-session.service";

interface PlatformStats {
	[platform: string]: {
		total: number;
		completed: boolean;
	};
}

@Injectable()
export class SearchOrchestratorService {
	constructor(
		private readonly aiService: AiService,
		private readonly crawlSessionService: CrawlSessionService,
	) {}

	orchestrateSearch(
		searchId: string,
		query: string,
		crawlerEvents$: Observable<CrawlerEvent>,
	): Observable<SearchStreamMessage> {
		const messageSubject = new Subject<SearchStreamMessage>();

		const platformStats: PlatformStats = {};
		const productBuffer: CrawledProduct[] = [];
		const seenProductIds = new Set<string>();
		let completedCrawlers = 0;
		const totalCrawlers = 3;
		const startTime = Date.now();

		crawlerEvents$.subscribe({
			next: async (event) => {
				if (event.type === CrawlerEventType.PRODUCT) {
					const productEvent = event as ProductEvent;

					if (!productEvent.product.id) {
						productEvent.product.id = nanoid(16);
					}

					if (seenProductIds.has(productEvent.product.id)) {
						return;
					}
					seenProductIds.add(productEvent.product.id);

					productBuffer.push(productEvent.product);

					if (!platformStats[productEvent.source]) {
						platformStats[productEvent.source] = { total: 0, completed: false };
					}
					platformStats[productEvent.source].total++;

					await this.crawlSessionService.updatePlatformStats(
						searchId,
						productEvent.source,
						platformStats[productEvent.source].total,
					);

					if (productBuffer.length >= 10) {
						await this.rankAndStoreBatch(
							searchId,
							query,
							productBuffer,
							messageSubject,
						);
					}
				} else if (event.type === CrawlerEventType.PAGE_COMPLETE) {
					messageSubject.next({
						event: "stats",
						data: {
							source: event.source,
							pageComplete: event.pageNumber,
							productsFound: event.productsFound,
							platformStats,
						},
					});
				} else if (event.type === CrawlerEventType.CRAWLER_COMPLETE) {
					platformStats[event.source].completed = true;
					completedCrawlers++;

					if (productBuffer.length > 0) {
						await this.rankAndStoreBatch(
							searchId,
							query,
							productBuffer,
							messageSubject,
						);
					}

					if (completedCrawlers === totalCrawlers) {
						const totalProducts = Object.values(platformStats).reduce(
							(sum, stat) => sum + stat.total,
							0,
						);

						await this.crawlSessionService.completeSession(searchId, {
							totalProducts,
							crawlDurationMs: Date.now() - startTime,
						});

						messageSubject.next({
							event: "complete",
							data: {
								searchId,
								totalProducts,
								platformStats,
								durationMs: Date.now() - startTime,
							},
						});

						messageSubject.complete();
					}
				} else if (event.type === CrawlerEventType.CRAWLER_ERROR) {
					messageSubject.next({
						event: "error",
						data: {
							source: event.source,
							error: event.error,
						},
					});

					completedCrawlers++;

					if (completedCrawlers === totalCrawlers) {
						await this.crawlSessionService.completeSession(searchId, {
							totalProducts: Object.values(platformStats).reduce(
								(sum, stat) => sum + stat.total,
								0,
							),
							crawlDurationMs: Date.now() - startTime,
							failedCrawlers: Object.entries(platformStats)
								.filter(([_, stat]) => !stat.completed)
								.map(([name, _]) => name),
						});

						messageSubject.complete();
					}
				}
			},
			error: async (error) => {
				await this.crawlSessionService.failSession(searchId, error.message);
				messageSubject.error(error);
			},
		});

		return messageSubject.asObservable();
	}

	/**
	 * Rank a batch of products, store in DB with scores, and emit
	 */
	private async rankAndStoreBatch(
		searchId: string,
		query: string,
		products: CrawledProduct[],
		subject: Subject<SearchStreamMessage>,
	): Promise<void> {
		if (products.length === 0) return;

		try {
			const batch = products.splice(0, products.length);

			// STEP 1: Store full products in MongoDB
			await this.crawlSessionService.addProducts(searchId, batch);

			// STEP 2: Get ranked IDs AND scores from AI
			const { rankedIds, scores } = await this.aiService.rankProductsWithScores(
				query,
				batch,
			);

			// STEP 3: Save ranked IDs to database
			await this.crawlSessionService.appendRankedProductIds(
				searchId,
				rankedIds,
			);

			// STEP 4: Save product scores to database ← NEW
			await this.crawlSessionService.appendProductScores(searchId, scores);

			// STEP 5: Reconstruct products in ranked order
			const rankedProducts = rankedIds
				.map((id) => batch.find((p) => p.id === id))
				.filter((p): p is CrawledProduct => p !== undefined);

			// STEP 6: Emit to frontend via SSE (with scores) ← UPDATED
			subject.next({
				event: "product",
				data: {
					products: rankedProducts,
					scores, // ← NEW: Include scores in response
					batchSize: rankedProducts.length,
				},
			});

			console.log(
				`✅ Ranked, stored, and emitted batch of ${rankedProducts.length} products with scores`,
			);
		} catch (error) {
			console.error("Batch ranking/storage failed:", error);

			const batch = products.splice(0, products.length);
			const unrankedIds = batch.map((p) => p.id);

			// Fallback scores
			const fallbackScores: ProductScore[] = batch.map((p, index) => ({
				productId: p.id,
				relevanceScore: Math.max(50, 100 - index * 2),
				aiReasoning: "Fallback ranking (AI error)",
			}));

			await this.crawlSessionService.addProducts(searchId, batch);
			await this.crawlSessionService.appendRankedProductIds(
				searchId,
				unrankedIds,
			);
			await this.crawlSessionService.appendProductScores(
				searchId,
				fallbackScores,
			);

			subject.next({
				event: "product",
				data: {
					products: batch,
					scores: fallbackScores,
					batchSize: batch.length,
					aiRankingFailed: true,
				},
			});
		}
	}
}
