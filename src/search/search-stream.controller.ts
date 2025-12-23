// src/search/search-stream.controller.ts

import {
	BadRequestException,
	Controller,
	Get,
	MessageEvent,
	Query,
	Sse,
} from "@nestjs/common";
import { map, Observable } from "rxjs";
import { CrawlerService } from "src/crawler/crawler.service";
import { SearchOrchestratorService } from "./search-orchestrator.service";

@Controller("search")
export class SearchStreamController {
	constructor(
		private readonly crawlerService: CrawlerService,
		private readonly orchestrator: SearchOrchestratorService,
	) {}

	/**
	 * SSE endpoint for streaming search results
	 * Usage: GET /search/stream?q=iphone
	 */
	@Sse("stream")
	streamSearch(@Query("q") query: string): Observable<MessageEvent> {
		if (!query || query.trim().length === 0) {
			throw new BadRequestException('Query parameter "q" is required');
		}

		console.log(`🚀 Starting SSE stream for query: "${query}"`);

		// Start crawling
		const crawlerEvents$ = this.crawlerService.streamAllSites(query, 1);

		// Orchestrate and rank
		const searchMessages$ = this.orchestrator.orchestrateSearch(
			query,
			crawlerEvents$,
		);

		// Transform to SSE MessageEvent format
		return searchMessages$.pipe(
			map(
				(message) =>
					({
						type: message.event,
						data: message.data,
					}) as MessageEvent,
			),
		);
	}
}
