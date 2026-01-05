// src/crawler/types/crawler.types.ts

export interface CrawledProduct {
	id: string; // ← NEW: Unique identifier
	title: string;
	price?: number;
	currency?: string;
	imageUrl?: string;
	productUrl?: string;
	source: string;

	// Platform-specific fields
	rating?: number;
	reviewCount?: number;
	isSponsored?: boolean;
	badge?: string;
	basePrice?: number;
	supplier?: string;
	moq?: string;
	hasTradeAssurance?: boolean;
	hasFreeShipping?: boolean;
	hasWalmartPlus?: boolean;
	condition?: string;
	shipping?: string;
	seller?: string;
	watchCount?: string;
	isBuyItNow?: boolean;
}

// Product with metadata for AI ranking
export interface RankableProduct {
	id: string;
	title: string;
	price?: number;
	rating?: number;
	reviewCount?: number;
	source: string;
	isSponsored?: boolean;
}
