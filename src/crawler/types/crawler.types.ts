// src/crawler/types/crawler.types.ts

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
	// Walmart-specific
	hasFreeShipping?: boolean;
	hasWalmartPlus?: boolean;

	// eBay-specific
	condition?: string; // New, Used, Refurbished, etc.
	shipping?: string; // Shipping cost or "Free shipping"
	seller?: string; // Seller name
	watchCount?: string; // How many people are watching
	isBuyItNow?: boolean; // Buy It Now vs Auction
}
