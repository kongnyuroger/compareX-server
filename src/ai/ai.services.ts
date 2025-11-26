import { Injectable, InternalServerErrorException } from "@nestjs/common";
import OpenAI from "openai";

@Injectable()
export class AiService {
	private client: OpenAI;

	constructor() {
		this.client = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		});
	}

	// Expands the user search query using OpenAI

	async expandQuery(query: string): Promise<string[]> {
		try {
			const response = await this.client.chat.completions.create({
				model: "gpt-5",
				messages: [
					{
						role: "system",
						content:
							"Expand the product search query into 3–5 alternative variations. Return ONLY a list with no bullet points . No explanations.",
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

	//SAFE JSON RANKING — never breaks JSON.parse()
	async rankProducts(query: string, products: any[]): Promise<any> {
		try {
			const response = await this.client.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content: `
              You MUST return ONLY valid JSON.
              No markdown.
              No code fences.
              No explanations.

              Your task is to rank the provided 'products' based on two criteria:
              1. **Relevance**: How well the product name/category matches the user's 'query'.
              2. **Price**: Products with lower prices should generally rank higher than equally relevant, more expensive items.
              
              Return an array named 'ranked' containing the FULL product objects from the input,
              but sorted in descending order according to the blended ranking score (highest score first).
              The resulting product objects MUST be identical to the input objects, plus an added 'score' field.

              JSON format:
              {
                "ranked": [
                  { 
                    "id": 12,
                    "name": "Xbox Series X Console",
                    "price": 499.99,
                    "tag": "Limited Stock",
                    "tagColor": "bg-orange-100 text-orange-700",
                    "image": "...", 
                    "stores": ["ebay", "jumia"],
                    "score": 0.95 // <-- REQUIRED: A blended ranking score (0.0 to 1.0)
                  },
                  // ... other ranked products
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

			// Remove accidental markdown
			content = content
				.replace(/```json/gi, "")
				.replace(/```/g, "")
				.trim();

			// Parse safely
			return JSON.parse(content);
		} catch (error) {
			if (error instanceof SyntaxError) {
				console.error("JSON Parse Error:", error.message);
			} else {
				console.error("OpenAI API Error:", error.message);
			}
			throw new InternalServerErrorException("AI ranking failed");
		}
	}
}
