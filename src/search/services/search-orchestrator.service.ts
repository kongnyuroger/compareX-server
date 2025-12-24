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

	/**
	 * Orchestrates the search flow with MongoDB storage
	 */
	orchestrateSearch(
		searchId: string,
		query: string,
		crawlerEvents$: Observable<CrawlerEvent>,
	): Observable<SearchStreamMessage> {
		const messageSubject = new Subject<SearchStreamMessage>();

		const platformStats: PlatformStats = {};
		const productBuffer: CrawledProduct[] = [];
		const seenProductIds = new Set<string>(); // Prevent duplicates
		let completedCrawlers = 0;
		const totalCrawlers = 3;
		const startTime = Date.now();

		// Subscribe to crawler events
		crawlerEvents$.subscribe({
			next: async (event) => {
				if (event.type === CrawlerEventType.PRODUCT) {
					const productEvent = event as ProductEvent;

					// Assign unique ID if not present
					if (!productEvent.product.id) {
						productEvent.product.id = nanoid(16);
					}

					// Skip duplicates (can happen if same product on multiple pages)
					if (seenProductIds.has(productEvent.product.id)) {
						console.log(
							`⚠️  Skipping duplicate product: ${productEvent.product.id}`,
						);
						return;
					}
					seenProductIds.add(productEvent.product.id);

					// Add to buffer for batching
					productBuffer.push(productEvent.product);

					// Update platform stats
					if (!platformStats[productEvent.source]) {
						platformStats[productEvent.source] = { total: 0, completed: false };
					}
					platformStats[productEvent.source].total++;

					// Update DB stats
					await this.crawlSessionService.updatePlatformStats(
						searchId,
						productEvent.source,
						platformStats[productEvent.source].total,
					);

					// Batch processing: rank and store every 10 products
					if (productBuffer.length >= 10) {
						await this.rankAndStoreBatch(
							searchId,
							query,
							productBuffer,
							messageSubject,
						);
					}
				} else if (event.type === CrawlerEventType.PAGE_COMPLETE) {
					// Emit progress update
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

					// Rank and store remaining products from this crawler
					if (productBuffer.length > 0) {
						await this.rankAndStoreBatch(
							searchId,
							query,
							productBuffer,
							messageSubject,
						);
					}

					// If all crawlers done, finalize
					if (completedCrawlers === totalCrawlers) {
						const totalProducts = Object.values(platformStats).reduce(
							(sum, stat) => sum + stat.total,
							0,
						);

						// Mark session as completed
						await this.crawlSessionService.completeSession(searchId, {
							totalProducts,
							crawlDurationMs: Date.now() - startTime,
						});

						// Send completion message
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
	 * Rank a batch of products, store in DB, and emit
	 */
	private async rankAndStoreBatch(
		searchId: string,
		query: string,
		products: CrawledProduct[],
		subject: Subject<SearchStreamMessage>,
	): Promise<void> {
		if (products.length === 0) return;

		try {
			// Take products from buffer
			const batch = products.splice(0, products.length);

			// Step 1: Store full products in MongoDB
			await this.crawlSessionService.addProducts(searchId, batch);

			// Step 2: Get ranked IDs from AI
			const rankedIds = await this.aiService.rankProductsByIds(query, batch);

			// Step 3: Save ranked IDs to database (maintains order)
			await this.crawlSessionService.appendRankedProductIds(
				searchId,
				rankedIds,
			);

			// Step 4: Reconstruct ranked products for streaming
			const rankedProducts = rankedIds
				.map((id) => batch.find((p) => p.id === id))
				.filter((p): p is CrawledProduct => p !== undefined);

			// Step 5: Emit ranked products to frontend
			subject.next({
				event: "product",
				data: {
					products: rankedProducts,
					batchSize: rankedProducts.length,
				},
			});

			console.log(
				`✅ Ranked, stored, and emitted batch of ${rankedProducts.length} products`,
			);
		} catch (error) {
			console.error("Batch ranking/storage failed:", error);

			// Fallback: store unranked
			const batch = products.splice(0, products.length);
			const unrankedIds = batch.map((p) => p.id);

			await this.crawlSessionService.addProducts(searchId, batch);
			await this.crawlSessionService.appendRankedProductIds(
				searchId,
				unrankedIds,
			);

			subject.next({
				event: "product",
				data: {
					products: batch,
					batchSize: batch.length,
					aiRankingFailed: true,
				},
			});
		}
	}
}
