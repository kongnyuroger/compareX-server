import { CrawledProduct } from "../../crawler/types/crawler.types";
import { ProductScorer } from "./product-scorer.util";

export interface LimitConfig {
	resultsPerPlatform?: number;
	globalLimit?: number;
	minRelevanceScore?: number;
	balanceAcrossPlatforms?: boolean;
}

export interface LimitedResults {
	highRelevance: CrawledProduct[];
	otherResults: CrawledProduct[];
	stats: {
		platform: string;
		total: number;
		filtered: number;
		final: number;
	}[];
}

export class ProductLimiter {
	/**
	 * Limit and score products from multiple platforms
	 */
	static limitAndScore(
		products: CrawledProduct[],
		query: string,
		config: LimitConfig = {},
	): LimitedResults {
		const {
			resultsPerPlatform = 30,
			globalLimit = 90,
			minRelevanceScore = 0.5,
			balanceAcrossPlatforms = true,
		} = config;

		console.log("\n🔍 === ProductLimiter Debug ===");
		console.log(`Total products received: ${products.length}`);
		console.log(
			`Config: ${resultsPerPlatform} per platform, ${globalLimit} global, min score ${minRelevanceScore}`,
		);

		// Group by platform
		const byPlatform = new Map<string, CrawledProduct[]>();

		for (const product of products) {
			if (!byPlatform.has(product.source)) {
				byPlatform.set(product.source, []);
			}
			byPlatform.get(product.source)!.push(product);
		}

		console.log(
			`\nPlatforms found: ${Array.from(byPlatform.keys()).join(", ")}`,
		);
		byPlatform.forEach((prods, platform) => {
			console.log(`  ${platform}: ${prods.length} products`);
		});

		const platformResults = new Map<string, CrawledProduct[]>();
		const platformLeftovers = new Map<string, CrawledProduct[]>();
		const stats: any[] = [];

		// STEP 1: Process each platform independently
		for (const [platform, platformProducts] of byPlatform) {
			console.log(`\nProcessing ${platform}...`);

			// Calculate relevance scores
			const scored = platformProducts.map((product) => ({
				...product,
				relevanceScore: ProductScorer.calculateRelevanceScore(product, query),
			}));

			// Filter by minimum score
			const filtered = scored.filter(
				(p) => p.relevanceScore >= minRelevanceScore,
			);
			console.log(
				`  After score filter (>=${minRelevanceScore}): ${filtered.length} products`,
			);

			// Sort by relevance
			const sortedByRelevance = filtered.sort(
				(a, b) => b.relevanceScore - a.relevanceScore,
			);

			// Take top N per platform
			const top = sortedByRelevance.slice(0, resultsPerPlatform);
			const leftover = sortedByRelevance.slice(resultsPerPlatform);

			platformResults.set(platform, top);
			platformLeftovers.set(platform, leftover);

			console.log(`  Taking top ${top.length} for ${platform}`);

			stats.push({
				platform,
				total: platformProducts.length,
				filtered: filtered.length,
				final: top.length,
			});
		}

		// STEP 2: Combine all platform results
		const allSelected: CrawledProduct[] = [];
		platformResults.forEach((products) => {
			allSelected.push(...products);
		});

		console.log(`\nTotal selected from all platforms: ${allSelected.length}`);

		// STEP 3: Apply global limit
		if (allSelected.length > globalLimit) {
			console.log(`Applying global limit (${globalLimit})...`);

			if (balanceAcrossPlatforms) {
				// BALANCED DISTRIBUTION: Take equally from each platform
				return ProductLimiter.applyBalancedGlobalLimit(
					platformResults,
					platformLeftovers,
					globalLimit,
					stats,
				);
			} else {
				// SCORE-BASED: Take top by score regardless of platform
				return ProductLimiter.applyScoreBasedGlobalLimit(
					allSelected,
					platformLeftovers,
					globalLimit,
					stats,
				);
			}
		}

		// No global limit needed
		const allLeftovers: CrawledProduct[] = [];
		platformLeftovers.forEach((products) => {
			allLeftovers.push(...products);
		});

		console.log("\nFinal distribution (no global limit applied):");
		stats.forEach((s) => {
			console.log(`  ${s.platform}: ${s.final} products`);
		});

		return {
			highRelevance: allSelected,
			otherResults: allLeftovers,
			stats,
		};
	}

	/**
	 * Apply global limit with balanced distribution across platforms
	 */
	private static applyBalancedGlobalLimit(
		platformResults: Map<string, CrawledProduct[]>,
		platformLeftovers: Map<string, CrawledProduct[]>,
		globalLimit: number,
		stats: any[],
	): LimitedResults {
		const platformCount = platformResults.size;
		const perPlatformLimit = Math.floor(globalLimit / platformCount);
		const remainder = globalLimit % platformCount;

		console.log(
			`Balanced distribution: ${perPlatformLimit} per platform, ${remainder} extra`,
		);

		const finalSelected: CrawledProduct[] = [];
		const allLeftovers: CrawledProduct[] = [];

		// First, add leftover products
		platformLeftovers.forEach((products) => {
			allLeftovers.push(...products);
		});

		const extraSlots = remainder;
		const platforms = Array.from(platformResults.keys());

		platforms.forEach((platform, index) => {
			const products = platformResults.get(platform)!;
			const limit = perPlatformLimit + (index < extraSlots ? 1 : 0);

			const selected = products.slice(0, limit);
			const removed = products.slice(limit);

			finalSelected.push(...selected);
			allLeftovers.push(...removed);

			console.log(
				`  ${platform}: ${selected.length} products (limit: ${limit})`,
			);
		});

		// Update stats
		const finalStats = stats.map((stat) => {
			const finalCount = finalSelected.filter(
				(p) => p.source === stat.platform,
			).length;
			return {
				...stat,
				final: finalCount,
			};
		});

		return {
			highRelevance: finalSelected,
			otherResults: allLeftovers,
			stats: finalStats,
		};
	}

	/**
	 * Apply global limit based on relevance score (may favor one platform)
	 */
	private static applyScoreBasedGlobalLimit(
		allSelected: CrawledProduct[],
		platformLeftovers: Map<string, CrawledProduct[]>,
		globalLimit: number,
		stats: any[],
	): LimitedResults {
		console.log("Score-based distribution (may favor certain platforms)");

		const globalSorted = allSelected.sort(
			(a, b) => (b as any).relevanceScore - (a as any).relevanceScore,
		);

		const finalTop = globalSorted.slice(0, globalLimit);
		const removed = globalSorted.slice(globalLimit);

		const allLeftovers: CrawledProduct[] = [];
		platformLeftovers.forEach((products) => {
			allLeftovers.push(...products);
		});
		allLeftovers.push(...removed);

		// Update stats
		const finalStats = stats.map((stat) => {
			const finalCount = finalTop.filter(
				(p) => p.source === stat.platform,
			).length;
			return {
				...stat,
				final: finalCount,
			};
		});

		console.log("\nFinal distribution:");
		finalStats.forEach((s) => {
			console.log(`  ${s.platform}: ${s.final} products`);
		});

		return {
			highRelevance: finalTop,
			otherResults: allLeftovers,
			stats: finalStats,
		};
	}
}
