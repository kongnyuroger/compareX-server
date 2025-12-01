// src/crawler/types/crawler.types.ts

export interface CrawledProduct {
	title: string;
	price?: number;
	currency?: string;
	imageUrl?: string;
	productUrl?: string;
	source: string;
	rating?: number;
	reviewCount?: number;
	isSponsored?: boolean;
	badge?: string;
	basePrice?: number;
} // src/crawler/types/crawler.types.ts

export interface CrawledProduct {
	title: string;
	price?: number;
	currency?: string;
	imageUrl?: string;
	productUrl?: string;
	source: string;

	// Amazon-specific
	rating?: number;
	reviewCount?: number;
	isSponsored?: boolean;
	badge?: string;
	basePrice?: number;

	// Alibaba-specific
	supplier?: string;
	moq?: string; // Minimum Order Quantity
	hasTradeAssurance?: boolean;
}
