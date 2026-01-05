// src/crawler/crawler.service.ts

import { Injectable } from "@nestjs/common";
import { catchError, merge, Observable, of } from "rxjs";
import { AmazonCrawler } from "./crawler.amazon";
import { EbayCrawler } from "./crawler.ebay";
import { WalmartCrawler } from "./crawler.walmart";
import { CrawlerEvent, CrawlerEventType } from "./types/crawler-events";

@Injectable()
export class CrawlerService {
	private readonly amazon = new AmazonCrawler();
	private readonly walmart = new WalmartCrawler();
	private readonly ebay = new EbayCrawler();

	/**
	 * Stream products from all crawlers in parallel
	 * Errors from one crawler don't stop others
	 */
	streamAllSites(
		query: string,
		maxPages: number = 1,
	): Observable<CrawlerEvent> {
		console.log(`\n🔍 Starting parallel streaming search for: "${query}"\n`);

		const amazonStream$ = this.amazon.streamSearch(query, maxPages).pipe(
			catchError((error) => {
				console.error(`Amazon stream error: ${error.message}`);
				return of<CrawlerEvent>({
					type: CrawlerEventType.CRAWLER_ERROR,
					source: "Amazon",
					error: error.message,
					timestamp: Date.now(),
				});
			}),
		);

		const walmartStream$ = this.walmart.streamSearch(query, maxPages).pipe(
			catchError((error) => {
				console.error(`Walmart stream error: ${error.message}`);
				return of<CrawlerEvent>({
					type: CrawlerEventType.CRAWLER_ERROR,
					source: "Walmart",
					error: error.message,
					timestamp: Date.now(),
				});
			}),
		);

		const ebayStream$ = this.ebay.streamSearch(query, maxPages).pipe(
			catchError((error) => {
				console.error(`eBay stream error: ${error.message}`);
				return of<CrawlerEvent>({
					type: CrawlerEventType.CRAWLER_ERROR,
					source: "eBay",
					error: error.message,
					timestamp: Date.now(),
				});
			}),
		);

		// Merge all streams - products emitted as soon as any crawler finds them
		return merge(amazonStream$, walmartStream$, ebayStream$);
	}
}
