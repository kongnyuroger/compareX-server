// src/crawler/types/crawler-events.ts

import { CrawledProduct } from "./crawler.types";

export enum CrawlerEventType {
	PRODUCT = "product",
	PAGE_COMPLETE = "page_complete",
	CRAWLER_COMPLETE = "crawler_complete",
	CRAWLER_ERROR = "crawler_error",
}

export interface ProductEvent {
	type: CrawlerEventType.PRODUCT;
	source: string;
	product: CrawledProduct; // Now includes 'id'
	timestamp: number;
}

export interface PageCompleteEvent {
	type: CrawlerEventType.PAGE_COMPLETE;
	source: string;
	pageNumber: number;
	productsFound: number;
	timestamp: number;
}

export interface CrawlerCompleteEvent {
	type: CrawlerEventType.CRAWLER_COMPLETE;
	source: string;
	totalProducts: number;
	timestamp: number;
}

export interface CrawlerErrorEvent {
	type: CrawlerEventType.CRAWLER_ERROR;
	source: string;
	error: string;
	timestamp: number;
}

export type CrawlerEvent =
	| ProductEvent
	| PageCompleteEvent
	| CrawlerCompleteEvent
	| CrawlerErrorEvent;

// SSE message format
export interface SearchStreamMessage {
	event: "product" | "stats" | "complete" | "error";
	data: unknown;
}
