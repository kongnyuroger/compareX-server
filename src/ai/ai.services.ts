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

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import OpenAI from "openai";
import {
	CrawledProduct,
	RankableProduct,
} from "src/crawler/types/crawler.types";

@Injectable()
export class AiService {
	private client: OpenAI;

	constructor() {
		this.client = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		});
	}

	/**
	 * Rank products and return only their IDs in ranked order
	 *
	 * @param query - User's search query
	 * @param products - Products with IDs to rank
	 * @returns Array of product IDs in ranked order
	 */
	async rankProductsByIds(
		query: string,
		products: CrawledProduct[],
	): Promise<string[]> {
		if (products.length === 0) return [];

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
              1. Title relevance (most important)
              2. Price (lower is better for similar products)
              3. Rating and reviews (quality indicators)
              4. De-prioritize sponsored products slightly

              Return format:
              {
                "rankedIds": ["id1", "id2", "id3", ...]
              }

              The rankedIds array MUST contain ALL product IDs in ranked order.
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
				temperature: 0.3, // Lower temperature for more consistent rankings
			});

			const choice = response.choices[0];
			if (!choice?.message?.content) {
				console.warn("Empty AI response, falling back to original order");
				return products.map((p) => p.id);
			}

			const content = choice.message.content
				.replace(/```json/gi, "")
				.replace(/```/g, "")
				.trim();

			const result = JSON.parse(content);

			if (!result.rankedIds || !Array.isArray(result.rankedIds)) {
				console.warn("Invalid AI response format, falling back");
				return products.map((p) => p.id);
			}

			// Validate all IDs are present
			const inputIds = new Set(products.map((p) => p.id));
			const outputIds = result.rankedIds.filter((id: string) =>
				inputIds.has(id),
			);

			if (outputIds.length !== products.length) {
				console.warn(
					`AI ranking incomplete: ${outputIds.length}/${products.length} IDs`,
				);
				// Add missing IDs at the end
				const missingIds = products
					.map((p) => p.id)
					.filter((id) => !outputIds.includes(id));
				return [...outputIds, ...missingIds];
			}

			return outputIds;
		} catch (error) {
			console.error("AI ranking failed:", error);
			// Fallback: return original order
			return products.map((p) => p.id);
		}
	}
}
