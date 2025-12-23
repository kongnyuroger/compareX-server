// src/search/search-orchestrator.service.ts

import { Injectable } from "@nestjs/common";
import { bufferTime, filter, mergeMap, Observable, Subject, tap } from "rxjs";
import { AiService } from "src/ai/ai.services";
import { CrawledProduct } from "src/crawler/types/crawler.types";
import {
	CrawlerEvent,
	CrawlerEventType,
	ProductEvent,
	SearchStreamMessage,
} from "src/crawler/types/crawler-events";

interface PlatformStats {
	[platform: string]: {
		total: number;
		completed: boolean;
	};
}

@Injectable()
export class SearchOrchestratorService {
	constructor(private readonly aiService: AiService) {}

	/**
	 * Orchestrates the search flow:
	 * 1. Buffers products for batching
	 * 2. Ranks them with AI
	 * 3. Emits as SSE messages
	 */
	orchestrateSearch(
		query: string,
		crawlerEvents$: Observable<CrawlerEvent>,
	): Observable<SearchStreamMessage> {
		const messageSubject = new Subject<SearchStreamMessage>();

		const platformStats: PlatformStats = {};
		const productBuffer: CrawledProduct[] = [];
		let completedCrawlers = 0;
		const totalCrawlers = 3; // Amazon, Walmart, eBay

		// Subscribe to crawler events
		crawlerEvents$.subscribe({
			next: (event) => {
				if (event.type === CrawlerEventType.PRODUCT) {
					const productEvent = event as ProductEvent;
					productBuffer.push(productEvent.product);

					// Update stats
					if (!platformStats[productEvent.source]) {
						platformStats[productEvent.source] = { total: 0, completed: false };
					}
					platformStats[productEvent.source].total++;

					// Batch ranking every 10 products or 2 seconds
					if (productBuffer.length >= 10) {
						this.rankAndEmitBatch(query, productBuffer, messageSubject);
					}
				} else if (event.type === CrawlerEventType.PAGE_COMPLETE) {
					// Emit progress update
					messageSubject.next({
						event: "stats",
						data: {
							source: event.source,
							pageComplete: event.pageNumber,
							platformStats,
						},
					});
				} else if (event.type === CrawlerEventType.CRAWLER_COMPLETE) {
					platformStats[event.source].completed = true;
					completedCrawlers++;

					// If all crawlers done, rank remaining products
					if (completedCrawlers === totalCrawlers) {
						if (productBuffer.length > 0) {
							this.rankAndEmitBatch(query, productBuffer, messageSubject);
						}

						// Send completion message
						messageSubject.next({
							event: "complete",
							data: {
								totalProducts: Object.values(platformStats).reduce(
									(sum, stat) => sum + stat.total,
									0,
								),
								platformStats,
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
						messageSubject.complete();
					}
				}
			},
			error: (error) => {
				messageSubject.error(error);
			},
		});

		return messageSubject.asObservable();
	}

	private async rankAndEmitBatch(
		query: string,
		products: CrawledProduct[],
		subject: Subject<SearchStreamMessage>,
	): Promise<void> {
		if (products.length === 0) return;

		try {
			// Take products from buffer
			const batch = products.splice(0, products.length);

			// Rank with AI
			const ranked = await this.aiService.rankProducts(query, batch);

			// Emit ranked products
			subject.next({
				event: "product",
				data: {
					products: ranked.ranked || batch,
					batchSize: batch.length,
				},
			});
		} catch (error) {
			console.error("AI ranking failed:", error);

			// Emit unranked if AI fails
			const batch = products.splice(0, products.length);
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
