//	async expandQuery(query: string): Promise<string[]> {
//		try {
//			const response = await this.client.chat.completions.create({
//				model: "gpt-4o-mini", // Fixed: was "gpt-5"
//				messages: [
//					{
//						role: "system",
//						content:
//							"Expand the product search query into 3–5 alternative variations. Return ONLY a list with no bullet points. No explanations.",
//					},
//					{ role: "user", content: query },
//				],
//			});
//
//			const choice = response.choices[0];
//			if (!choice?.message?.content) {
//				return [query];
//			}
//			const content = choice.message.content;
//			return content
//				.split("\n")
//				.map((item) => item.replace(/^\d+\.\s*/, "").trim())
//				.filter((item) => item.length > 0);
//		} catch (error) {
//			console.error("OpenAI Error:", error);
//			throw new InternalServerErrorException("AI query expansion failed");
//		}
//	}

// src/ai/ai.services.ts
// src/ai/ai.services.ts

// src/ai/ai.services.ts

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import OpenAI from "openai";
import {
	CrawledProduct,
	RankableProduct,
} from "src/crawler/types/crawler.types";
import { ProductScore } from "src/crawler/types/crawler-events";

@Injectable()
export class AiService {
	private client: OpenAI;

	constructor() {
		this.client = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		});
	}

	/**
	 * Rank products and return IDs with relevance scores
	 *
	 * @param query - User's search query
	 * @param products - Products with IDs to rank
	 * @returns Object with ranked IDs and scores
	 */
	async rankProductsWithScores(
		query: string,
		products: CrawledProduct[],
	): Promise<{ rankedIds: string[]; scores: ProductScore[] }> {
		if (products.length === 0) {
			return { rankedIds: [], scores: [] };
		}

		try {
			// Extract only necessary fields for AI ranking
			const rankableProducts: RankableProduct[] = products.map((p) => ({
				id: p.id,
				title: p.title,
				price: p.price,
				rating: p.rating,
				reviewCount: p.reviewCount,
				source: p.source,
				isSponsored: p.isSponsored,
			}));

			const response = await this.client.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content: `
              You MUST return ONLY valid JSON. No markdown, code fences, or explanations.

              Rank products by relevance to the query, considering:
              1. Title relevance (most important) - 40%
              2. Price (lower is better for similar products) - 20%
              3. Rating and reviews (quality indicators) - 30%
              4. Source reputation - 10%
              5. De-prioritize sponsored products slightly

              Assign a relevance score from 0-100 for each product:
              - 90-100: Perfect match
              - 80-89: Excellent match
              - 70-79: Good match
              - 60-69: Fair match
              - Below 60: Poor match

              Return format:
              {
                "rankings": [
                  { 
                    "productId": "id1", 
                    "relevanceScore": 95,
                    "reasoning": "Exact match, excellent price and ratings"
                  },
                  { 
                    "productId": "id2", 
                    "relevanceScore": 88,
                    "reasoning": "Good match, slightly higher price"
                  }
                ]
              }

              The rankings array MUST contain ALL product IDs in ranked order.
            `,
					},
					{
						role: "user",
						content: JSON.stringify({
							query,
							products: rankableProducts,
						}),
					},
				],
				temperature: 0.3,
			});

			const choice = response.choices[0];
			if (!choice?.message?.content) {
				console.warn("Empty AI response, falling back to original order");
				return this.createFallbackScores(products);
			}

			const content = choice.message.content
				.replace(/```json/gi, "")
				.replace(/```/g, "")
				.trim();

			const result = JSON.parse(content);

			if (!result.rankings || !Array.isArray(result.rankings)) {
				console.warn("Invalid AI response format, falling back");
				return this.createFallbackScores(products);
			}

			// Extract ranked IDs and scores
			const rankedIds: string[] = [];
			const scores: ProductScore[] = [];

			result.rankings.forEach((ranking: any) => {
				if (ranking.productId) {
					rankedIds.push(ranking.productId);
					scores.push({
						productId: ranking.productId,
						relevanceScore: ranking.relevanceScore || 50,
						aiReasoning: ranking.reasoning,
					});
				}
			});

			// Validate all IDs are present
			const inputIds = new Set(products.map((p) => p.id));
			const outputIds = rankedIds.filter((id) => inputIds.has(id));

			if (outputIds.length !== products.length) {
				console.warn(
					`AI ranking incomplete: ${outputIds.length}/${products.length} IDs`,
				);

				// Add missing IDs at the end with default score
				const missingIds = products
					.map((p) => p.id)
					.filter((id) => !outputIds.includes(id));

				missingIds.forEach((id) => {
					rankedIds.push(id);
					scores.push({
						productId: id,
						relevanceScore: 50,
						aiReasoning: "Not ranked by AI",
					});
				});
			}

			return { rankedIds, scores };
		} catch (error) {
			console.error("AI ranking failed:", error);
			return this.createFallbackScores(products);
		}
	}

	/**
	 * Create fallback scores when AI fails
	 */
	private createFallbackScores(products: CrawledProduct[]): {
		rankedIds: string[];
		scores: ProductScore[];
	} {
		const rankedIds = products.map((p) => p.id);
		const scores = products.map((p, index) => ({
			productId: p.id,
			relevanceScore: Math.max(50, 100 - index * 2), // Decreasing score
			aiReasoning: "Fallback ranking (AI unavailable)",
		}));

		return { rankedIds, scores };
	}

	/**
	 * Legacy method for backward compatibility
	 * Returns only IDs without scores
	 */
	async rankProductsByIds(
		query: string,
		products: CrawledProduct[],
	): Promise<string[]> {
		const { rankedIds } = await this.rankProductsWithScores(query, products);
		return rankedIds;
	}
}
