import { Injectable, InternalServerErrorException } from "@nestjs/common";
import OpenAI from "openai";
import { CrawledProduct } from "src/crawler/types/crawler.types";
import { ProductLimiter } from "./utils/product-limiter.util";
import { ProductScorer } from "./utils/product-scorer.util";

@Injectable()
export class AiService {
	private client: OpenAI;

	constructor() {
		this.client = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		});
	}
	async expandQuery(query: string): Promise<string[]> {
		try {
			const response = await this.client.chat.completions.create({
				model: "gpt-4o-mini", // Fixed: was "gpt-5"
				messages: [
					{
						role: "system",
						content:
							"Expand the product search query into 3–5 alternative variations. Return ONLY a list with no bullet points. No explanations.",
					},
					{ role: "user", content: query },
				],
			});

			const choice = response.choices[0];
			if (!choice?.message?.content) {
				return [query];
			}
			const content = choice.message.content;
			return content
				.split("\n")
				.map((item) => item.replace(/^\d+\.\s*/, "").trim())
				.filter((item) => item.length > 0);
		} catch (error) {
			console.error("OpenAI Error:", error);
			throw new InternalServerErrorException("AI query expansion failed");
		}
	}

	// Your existing rankProducts method
	async rankProducts(query: string, products: any[]): Promise<any> {
		try {
			const response = await this.client.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content: `
              You MUST return ONLY valid JSON.
              No markdown. No code fences. No explanations.

              Rank products by relevance and price.
              Return format:
              {
                "ranked": [
                  { 
                    ...original product,
                    "score": 0.95
                  }
                ]
              }
          `,
					},
					{
						role: "user",
						content: JSON.stringify({ query, products }),
					},
				],
			});

			let content = response.choices[0].message.content || "{}";
			content = content
				.replace(/```json/gi, "")
				.replace(/```/g, "")
				.trim();

			return JSON.parse(content);
		} catch (error) {
			console.error("AI ranking error:", error);
			throw new InternalServerErrorException("AI ranking failed");
		}
	}

	// Intelligent ranking with limiting
	async rankAndLimitProducts(
		query: string,
		products: CrawledProduct[],
		options?: {
			resultsPerPlatform?: number;
			globalLimit?: number;
			minRelevanceScore?: number;
			sortBy?: "relevance" | "price_low" | "price_high" | "rating";
		},
	): Promise<any> {
		const {
			resultsPerPlatform = 30,
			globalLimit = 90,
			minRelevanceScore = 0.5,
			sortBy = "relevance",
		} = options || {};

		// Step 1: Apply local scoring and limiting
		const limited = ProductLimiter.limitAndScore(products, query, {
			resultsPerPlatform,
			globalLimit,
			minRelevanceScore,
		});

		// Step 2: Sort results
		const sortedHigh = ProductScorer.sortProducts(
			limited.highRelevance,
			sortBy,
		);

		// Step 3: Use OpenAI to re-rank ONLY the top results
		const aiRanked = await this.rankProductsWithAI(query, sortedHigh);

		return {
			query,
			totalFound: products.length,
			totalAfterFiltering:
				limited.highRelevance.length + limited.otherResults.length,
			platformStats: limited.stats,
			rankedProducts: aiRanked.ranked || sortedHigh,
			otherProducts: limited.otherResults,
			filters: {
				resultsPerPlatform,
				globalLimit,
				minRelevanceScore,
				sortBy,
			},
		};
	}

	// AI ranking
	private async rankProductsWithAI(
		query: string,
		products: CrawledProduct[],
	): Promise<any> {
		// If too many products, only send top 90 to OpenAI to save costs
		const productsToRank = products.slice(0, 90);

		try {
			const response = await this.client.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content: `
              You MUST return ONLY valid JSON. No markdown, code fences, or explanations.

              Rank the products based on:
              1. Relevance to the user's query
              2. Price (lower is better for similar products)
              3. Quality indicators (rating, reviews)
              
              Return format:
              {
                "ranked": [
                  { 
                    ...original product fields,
                    "aiScore": 0.95
                  }
                ]
              }
            `,
					},
					{
						role: "user",
						content: JSON.stringify({
							query,
							products: productsToRank.map((p) => ({
								title: p.title,
								price: p.price,
								rating: p.rating,
								reviewCount: p.reviewCount,
								source: p.source,
								productUrl: p.productUrl,
								imageUrl: p.imageUrl,
								isSponsored: p.isSponsored,
								badge: p.badge,
								basePrice: p.basePrice,
								supplier: p.supplier,
								moq: p.moq,
								hasTradeAssurance: p.hasTradeAssurance,
								hasFreeShipping: p.hasFreeShipping,
								hasWalmartPlus: p.hasWalmartPlus,
								condition: p.condition,
								shipping: p.shipping,
								seller: p.seller,
								watchCount: p.watchCount,
								isBuyItNow: p.isBuyItNow,
							})),
						}),
					},
				],
			});

			const choice = response.choices[0];
			if (!choice?.message?.content) {
				console.warn("Empty AI response, falling back to local ranking");
				return { ranked: productsToRank };
			}
			let content = choice.message.content;
			content = content
				.replace(/```json/gi, "")
				.replace(/```/g, "")
				.trim();

			return JSON.parse(content);
		} catch (error) {
			console.error("AI ranking failed, falling back to local ranking:", error);
			return { ranked: productsToRank };
		}
	}
}
