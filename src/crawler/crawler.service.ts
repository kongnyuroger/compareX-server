// src/crawler/crawler.service.ts

import { Injectable } from "@nestjs/common";
import { catchError, merge, Observable, of, shareReplay } from "rxjs";
import { AliExpressCrawler } from "./crawler.aliexpress";
import { AmazonCrawler } from "./crawler.amazon";
import { EbayCrawler } from "./crawler.ebay";
import { WalmartCrawler } from "./crawler.walmart";
import { CrawlerEvent, CrawlerEventType } from "./types/crawler-events";

/**
 * Crawler Service
 *
 * Uses RxJS merge operator to combine multiple crawler streams
 * Each crawler runs independently and errors are isolated
 *
 * Key RxJS patterns:
 * - merge(): Combine multiple Observables into one
 * - catchError(): Isolate failures per crawler
 * - shareReplay(): Share single execution across subscribers
 */
@Injectable()
export class CrawlerService {
	private readonly amazon = new AmazonCrawler();
	private readonly walmart = new WalmartCrawler();
	private readonly ebay = new EbayCrawler();
	private readonly aliexpress = new AliExpressCrawler();

	/**
	 * Stream products from all crawlers in parallel
	 *
	 * Returns a SINGLE Observable that merges all crawler streams
	 * Errors from one crawler don't stop others (fault isolation)
	 *
	 * @param query - Search query
	 * @param maxPages - Max pages per crawler (default: 1)
	 * @returns Observable<CrawlerEvent> - Merged stream of all events
	 */
	streamAllSites(
		query: string,
		maxPages: number = 1,
	): Observable<CrawlerEvent> {
		console.log(`\n🔍 Starting parallel streaming search for: "${query}"\n`);

		// Create isolated streams with error handling
		const amazonStream$ = this.createIsolatedStream(
			() => this.amazon.streamSearch(query, maxPages),
			"Amazon",
		);

		const walmartStream$ = this.createIsolatedStream(
			() => this.walmart.streamSearch(query, maxPages),
			"Walmart",
		);

		const ebayStream$ = this.createIsolatedStream(
			() => this.ebay.streamSearch(query, maxPages),
			"eBay",
		);

		const aliexpressStream$ = this.createIsolatedStream(
			() => this.aliexpress.streamSearch(query, maxPages),
			"AliExpress",
		);

		// Merge all streams - products emitted as soon as any crawler finds them
		// shareReplay(1) ensures multiple subscribers get the same events
		return merge(
			amazonStream$,
			walmartStream$,
			ebayStream$,
			aliexpressStream$,
		).pipe(shareReplay({ bufferSize: 100, refCount: true }));
	}

	/**
	 * Create an isolated stream with comprehensive error handling
	 * Ensures one crawler's failure doesn't crash the entire search
	 *
	 * @param streamFactory - Function that creates the crawler stream
	 * @param source - Crawler name for logging
	 * @returns Observable with isolated error handling
	 */
	private createIsolatedStream(
		streamFactory: () => Observable<CrawlerEvent>,
		source: string,
	): Observable<CrawlerEvent> {
		return streamFactory().pipe(
			catchError((error) => {
				console.error(`❌ ${source} stream error:`, error.message);

				// Emit error event but don't crash the stream
				return of<CrawlerEvent>({
					type: CrawlerEventType.CRAWLER_ERROR,
					source,
					error: error.message || "Unknown error",
					timestamp: Date.now(),
				});
			}),
		);
	}

	/**
	 * Stream from a single crawler (optional utility method)
	 */
	streamSingleSite(
		source: "Amazon" | "Walmart" | "eBay" | "AliExpress",
		query: string,
		maxPages: number = 1,
	): Observable<CrawlerEvent> {
		console.log(`🔍 Starting search on ${source} for: "${query}"`);

		let crawler:
			| AmazonCrawler
			| WalmartCrawler
			| EbayCrawler
			| AliExpressCrawler;

		switch (source) {
			case "Amazon":
				crawler = this.amazon;
				break;
			case "Walmart":
				crawler = this.walmart;
				break;
			case "eBay":
				crawler = this.ebay;
				break;
			case "AliExpress":
				crawler = this.aliexpress;
				break;
			default:
				throw new Error(`Unknown crawler source: ${source}`);
		}

		return this.createIsolatedStream(
			() => crawler.streamSearch(query, maxPages),
			source,
		);
	}
}
