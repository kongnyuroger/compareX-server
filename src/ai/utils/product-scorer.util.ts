import { CrawledProduct } from "../../crawler/types/crawler.types";

export class ProductScorer {
	/**
	 * Calculate relevance score based on query match
	 */
	static calculateRelevanceScore(
		product: CrawledProduct,
		query: string,
	): number {
		const text = `${product.title} ${product.supplier || ""}`.toLowerCase();
		const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

		let score = 0;

		// Exact phrase match (highest priority)
		if (text.includes(query.toLowerCase())) {
			score += 5;
		}

		// Individual token matches
		for (const token of tokens) {
			if (text.includes(token)) {
				score += 2;

				// Bonus for multiple occurrences
				const occurrences = text.split(token).length - 1;
				if (occurrences > 1) {
					score += occurrences * 0.3;
				}

				// Bonus if token appears early
				if (text.substring(0, 50).includes(token)) {
					score += 0.5;
				}
			}
		}

		// Quality signals
		if (product.rating && product.rating >= 4) {
			score += 0.5;
		}

		if (product.reviewCount && product.reviewCount > 100) {
			score += 0.3;
		}

		// Penalize sponsored slightly
		if (product.isSponsored) {
			score -= 0.2;
		}

		return Math.min(30, Math.max(0, score));
	}

	/**
	 * Sort products by criteria
	 */
	static sortProducts(
		products: CrawledProduct[],
		sortBy: "relevance" | "price_low" | "price_high" | "rating",
	): CrawledProduct[] {
		const sorted = [...products];

		switch (sortBy) {
			case "price_low":
				return sorted.sort(
					(a, b) => (a.price || Infinity) - (b.price || Infinity),
				);

			case "price_high":
				return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));

			case "rating":
				return sorted.sort((a, b) => {
					const ratingA = a.rating || 0;
					const ratingB = b.rating || 0;
					if (ratingB !== ratingA) return ratingB - ratingA;
					return (b.reviewCount || 0) - (a.reviewCount || 0);
				});

			case "relevance":
			default:
				return sorted.sort((a, b) => {
					const scoreA = (a as any).relevanceScore || 0;
					const scoreB = (b as any).relevanceScore || 0;
					return scoreB - scoreA;
				});
		}
	}
}
