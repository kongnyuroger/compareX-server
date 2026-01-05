// src/crawler/types/base-crawler.interface.ts

import { Observable } from "rxjs";
import { CrawlerEvent } from "./crawler-events";

export interface IBaseCrawler {
	/**
	 * Stream products as they are discovered
	 * @param query - Search query
	 * @param maxPages - Maximum pages to scrape
	 * @returns Observable of crawler events
	 */
	streamSearch(query: string, maxPages: number): Observable<CrawlerEvent>;
}
