import { OAS3Options } from "swagger-jsdoc";

const port = process.env.PORT || 8080;

const baseUrl =
	process.env.NODE_ENV === "production"
		? process.env.API_BASE_URL || "https://comparex-server.onrender.com"
		: `http://localhost:${port}`;

const options: OAS3Options = {
	definition: {
		openapi: "3.0.3",
		info: {
			title: "CompareX - Product Comparison API",
			version: "1.0.0",
			description: `
# Real-Time Product Comparison Platform API

A powerful API for real-time product comparison across multiple e-commerce platforms (Amazon, Walmart, eBay).

## Features
- **Real-Time Streaming** via Server-Sent Events (SSE)
- **Parallel Crawling** across multiple platforms
- **AI-Powered Ranking** using GPT-4
- **Session Tracking** for historical retrieval
- **JWT Authentication**

## Architecture
- NestJS
- MongoDB (Mongoose)
- RxJS
- Puppeteer
- OpenAI GPT-4
- JWT Authentication

## Data Flow
1. Search request initiated
2. Crawl session created
3. Parallel crawling (Amazon, Walmart, eBay)
4. AI ranking in batches
5. Results streamed in real time
6. Results stored for historical access

## Rate Limiting
- Global: 10 requests/minute per IP
- Headers:
  - \`X-RateLimit-Limit\`
  - \`X-RateLimit-Remaining\`
  - \`X-RateLimit-Reset\`

All responses use consistent JSON structures and HTTP status codes.
`.trim(),
			contact: {
				name: "Development Team",
				url: "https://github.com/kongnyuroger/compareX-server",
			},
			license: {
				name: "MIT",
				url: "https://opensource.org/licenses/MIT",
			},
		},

		servers: [
			{
				url: baseUrl,
				description:
					process.env.NODE_ENV === "production"
						? "Production Server"
						: "Local Development Server",
			},
		],

		tags: [
			{
				name: "Health",
				description: "Health check and system status endpoints",
			},
			{
				name: "Authentication",
				description: "User authentication and token management",
			},
			{
				name: "Search",
				description: "Real-time product search with streaming results via SSE",
			},
			{
				name: "Search History",
				description: "Retrieve historical search sessions and results",
			},
			{
				name: "Users",
				description: "User profile and account management",
			},
		],

		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
					description: "Enter JWT token",
				},
			},

			responses: {
				BadRequest: {
					description: "Invalid request parameters",
				},
				Unauthorized: {
					description: "Missing or invalid authentication token",
				},
				NotFound: {
					description: "Resource not found",
				},
				RateLimited: {
					description: "Too many requests (rate limit exceeded)",
				},
				ServerError: {
					description: "Internal server error",
				},
			},
		},

		security: [
			{
				bearerAuth: [],
			},
		],
	},

	apis: ["src/**/*.controller.ts", "src/**/*.ts"],
};

export default options;
