// src/search/services/search-orchestrator.service.ts

import { Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";
import {
	bufferTime,
	catchError,
	filter,
	finalize,
	map,
	merge,
	Observable,
	Subject,
	scan,
	takeUntil,
	tap,
} from "rxjs";
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

interface AccumulatedState {
	platformStats: PlatformStats;
	completedCrawlers: number;
	seenProductIds: Set<string>;
	startTime: number;
}

/**
 * Search Orchestrator Service
 *
 * Uses RxJS operators to:
 * - Merge multiple crawler streams
 * - Buffer products for batch ranking
 * - Handle errors gracefully per-crawler
 * - Support cancellation via takeUntil
 * - Manage state accumulation
 *
 * PURE RxJS - NO manual async loops or polling
 */
@Injectable()
export class SearchOrchestratorService {
	private readonly BATCH_SIZE = 10;
	private readonly BUFFER_TIME_MS = 2000; // 2 seconds max wait
	private readonly TOTAL_CRAWLERS = 3;

	constructor(
		private readonly aiService: AiService,
		private readonly crawlSessionService: CrawlSessionService,
	) {}

	/**
	 * Orchestrate search using pure RxJS operators
	 *
	 * Flow:
	 * 1. Take crawler events stream
	 * 2. Use scan() to accumulate state
	 * 3. Use bufferTime() to batch products
	 * 4. Use map() to rank batches
	 * 5. Use merge() to combine all event types
	 * 6. Use takeUntil() for cancellation
	 * 7. Emit SearchStreamMessages for Socket.IO
	 */
	orchestrateSearch(
		searchId: string,
		query: string,
		crawlerEvents$: Observable<CrawlerEvent>,
		cancellation$: Observable<void>,
	): Observable<SearchStreamMessage> {
		const startTime = Date.now();

		// Create subjects for different event streams
		const productSubject = new Subject<CrawledProduct>();
		const statsSubject = new Subject<SearchStreamMessage>();
		const completeSubject = new Subject<SearchStreamMessage>();

		// Accumulate state using scan operator
		const stateAccumulator$ = crawlerEvents$.pipe(
			takeUntil(cancellation$),
			scan<CrawlerEvent, AccumulatedState>(
				(state, event) => {
					// Update state based on event type
					if (event.type === CrawlerEventType.PRODUCT) {
						const productEvent = event as ProductEvent;
						const product = productEvent.product;

						// Ensure product has ID
						if (!product.id) {
							product.id = nanoid(16);
						}

						// Track unique products
						if (!state.seenProductIds.has(product.id)) {
							state.seenProductIds.add(product.id);

							// Emit product to buffer stream
							productSubject.next(product);

							// Update platform stats
							if (!state.platformStats[event.source]) {
								state.platformStats[event.source] = {
									total: 0,
									completed: false,
								};
							}
							state.platformStats[event.source].total++;
						}
					} else if (event.type === CrawlerEventType.PAGE_COMPLETE) {
						// Emit stats event
						statsSubject.next({
							event: "stats",
							data: {
								source: event.source,
								pageComplete: event.pageNumber,
								productsFound: event.productsFound,
								platformStats: state.platformStats,
							},
						});
					} else if (event.type === CrawlerEventType.CRAWLER_COMPLETE) {
						// Mark crawler as completed
						if (!state.platformStats[event.source]) {
							state.platformStats[event.source] = {
								total: 0,
								completed: false,
							};
						}
						state.platformStats[event.source].completed = true;
						state.completedCrawlers++;

						// Check if all crawlers completed
						if (state.completedCrawlers === this.TOTAL_CRAWLERS) {
							const totalProducts = Object.values(state.platformStats).reduce(
								(sum, stat) => sum + stat.total,
								0,
							);

							// Update session in DB
							this.crawlSessionService
								.completeSession(searchId, {
									totalProducts,
									crawlDurationMs: Date.now() - startTime,
								})
								.catch((err) =>
									console.error("Failed to complete session:", err),
								);

							// Emit completion event
							completeSubject.next({
								event: "complete",
								data: {
									searchId,
									totalProducts,
									platformStats: state.platformStats,
									durationMs: Date.now() - startTime,
								},
							});

							// Complete all subjects
							productSubject.complete();
							statsSubject.complete();
							completeSubject.complete();
						}
					} else if (event.type === CrawlerEventType.CRAWLER_ERROR) {
						// Emit error but don't fail entire stream
						statsSubject.next({
							event: "error",
							data: {
								source: event.source,
								error: event.error,
							},
						});

						// Count as completed (failed)
						state.completedCrawlers++;

						if (state.completedCrawlers === this.TOTAL_CRAWLERS) {
							const totalProducts = Object.values(state.platformStats).reduce(
								(sum, stat) => sum + stat.total,
								0,
							);

							this.crawlSessionService
								.completeSession(searchId, {
									totalProducts,
									crawlDurationMs: Date.now() - startTime,
									failedCrawlers: Object.entries(state.platformStats)
										.filter(([_, stat]) => !stat.completed)
										.map(([name]) => name),
								})
								.catch((err) =>
									console.error("Failed to complete session:", err),
								);

							completeSubject.next({
								event: "complete",
								data: {
									searchId,
									totalProducts,
									platformStats: state.platformStats,
									durationMs: Date.now() - startTime,
								},
							});

							productSubject.complete();
							statsSubject.complete();
							completeSubject.complete();
						}
					}

					return state;
				},
				{
					platformStats: {},
					completedCrawlers: 0,
					seenProductIds: new Set<string>(),
					startTime,
				},
			),
			catchError((error) => {
				console.error("State accumulator error:", error);
				this.crawlSessionService
					.failSession(searchId, error.message)
					.catch((err) => console.error("Failed to fail session:", err));
				throw error;
			}),
		);

		// Buffer products for batch ranking
		const rankedProducts$ = productSubject.pipe(
			takeUntil(cancellation$),
			bufferTime(this.BUFFER_TIME_MS, null, this.BATCH_SIZE),
			filter((batch) => batch.length > 0),
			// Rank each batch using AI
			map(async (batch) => {
				return this.rankAndStoreBatch(searchId, query, batch);
			}),
			// Convert Promise to Observable
			map((promise) => promise),
			// Flatten the async operations
			mergeMap((promise) => promise),
			filter((message): message is SearchStreamMessage => message !== null),
			catchError((error) => {
				console.error("Batch ranking error:", error);
				// Return empty to continue stream
				return [];
			}),
		);

		// Subscribe to state accumulator to drive the process
		// This is necessary to trigger the scan operator
		stateAccumulator$.subscribe({
			error: (err) => console.error("State stream error:", err),
			complete: () => console.log("State stream completed"),
		});

		// Merge all output streams
		return merge(
			rankedProducts$,
			statsSubject.asObservable(),
			completeSubject.asObservable(),
		).pipe(
			takeUntil(cancellation$),
			finalize(() => {
				console.log(`🏁 Search orchestration finalized for ${searchId}`);
				productSubject.complete();
				statsSubject.complete();
				completeSubject.complete();
			}),
		);
	}

	/**
	 * Rank a batch of products using AI and store in DB
	 * Returns SearchStreamMessage for emission
	 */
	private async rankAndStoreBatch(
		searchId: string,
		query: string,
		products: CrawledProduct[],
	): Promise<SearchStreamMessage | null> {
		if (products.length === 0) {
			return null;
		}

		try {
			console.log(`🎯 Ranking batch of ${products.length} products...`);

			// STEP 1: Store full products in MongoDB
			await this.crawlSessionService.addProducts(searchId, products);

			// STEP 2: Get ranked IDs AND scores from AI
			const { rankedIds, scores } = await this.aiService.rankProductsWithScores(
				query,
				products,
			);

			// STEP 3: Save ranked IDs to database
			await this.crawlSessionService.appendRankedProductIds(
				searchId,
				rankedIds,
			);

			// STEP 4: Save product scores to database
			await this.crawlSessionService.appendProductScores(searchId, scores);

			// STEP 5: Reconstruct products in ranked order
			const rankedProducts = rankedIds
				.map((id) => products.find((p) => p.id === id))
				.filter((p): p is CrawledProduct => p !== undefined);

			console.log(
				`✅ Ranked, stored, and prepared batch of ${rankedProducts.length} products`,
			);

			// STEP 6: Return message for emission
			return {
				event: "product",
				data: {
					products: rankedProducts,
					scores,
					batchSize: rankedProducts.length,
				},
			};
		} catch (error) {
			console.error("Batch ranking/storage failed:", error);

			// Fallback: store unranked with default scores
			const unrankedIds = products.map((p) => p.id);
			const fallbackScores: ProductScore[] = products.map((p, index) => ({
				productId: p.id,
				relevanceScore: Math.max(50, 100 - index * 2),
				aiReasoning: "Fallback ranking (AI error)",
			}));

			await this.crawlSessionService.addProducts(searchId, products);
			await this.crawlSessionService.appendRankedProductIds(
				searchId,
				unrankedIds,
			);
			await this.crawlSessionService.appendProductScores(
				searchId,
				fallbackScores,
			);

			return {
				event: "product",
				data: {
					products,
					scores: fallbackScores,
					batchSize: products.length,
					aiRankingFailed: true,
				},
			};
		}
	}
}

// Helper for mergeMap (if not imported)
import { mergeMap } from "rxjs/operators";
