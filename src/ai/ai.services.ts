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
							"Expand the product search query into 3–5 alternative variations. Return ONLY a list. No explanations.",
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
              JSON format:
              {
                "ranked": [
                  { "title": "...", "score": 0.0 }
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
