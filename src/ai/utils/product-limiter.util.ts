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

// Type for products with relevance score
type ScoredProduct = CrawledProduct & { relevanceScore: number };

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

		const platformResults = new Map<string, ScoredProduct[]>();
		const platformLeftovers = new Map<string, ScoredProduct[]>();
		const stats: any[] = [];

		// STEP 1: Process each platform independently
		for (const [platform, platformProducts] of byPlatform) {
			console.log(`\nProcessing ${platform}...`);

			// Calculate relevance scores for all products
			const scored = platformProducts.map((product) => ({
				...product,
				relevanceScore: ProductScorer.calculateRelevanceScore(product, query),
			}));

			// Sort by relevance score (highest first)
			const sortedByRelevance = scored.sort(
				(a, b) => b.relevanceScore - a.relevanceScore,
			);

			let selectedProducts: ScoredProduct[];
			let leftoverProducts: ScoredProduct[];

			// NEW LOGIC: If total products <= 30, skip all limiting
			if (platformProducts.length <= resultsPerPlatform) {
				selectedProducts = sortedByRelevance;
				leftoverProducts = [];
				console.log(
					`  Total products (${platformProducts.length}) <= ${resultsPerPlatform}, taking all without limiting`,
				);
			} else {
				// Total products > 30, apply limiting logic
				console.log(
					`  Total products (${platformProducts.length}) > ${resultsPerPlatform}, applying limiting...`,
				);

				// Filter products with score >= minRelevanceScore
				const highScoreProducts = sortedByRelevance.filter(
					(p) => p.relevanceScore >= minRelevanceScore,
				);

				console.log(
					`  High-score products (>= ${minRelevanceScore}): ${highScoreProducts.length}`,
				);

				if (highScoreProducts.length >= resultsPerPlatform) {
					// We have enough high-score products, take top resultsPerPlatform
					selectedProducts = highScoreProducts.slice(0, resultsPerPlatform);
					leftoverProducts = sortedByRelevance.slice(resultsPerPlatform);
					console.log(
						`  High-score products sufficient, taking top ${resultsPerPlatform}`,
					);
				} else {
					// Not enough high-score products, complete to resultsPerPlatform with next in line
					const needed = resultsPerPlatform - highScoreProducts.length;
					const lowScoreProducts = sortedByRelevance.filter(
						(p) => p.relevanceScore < minRelevanceScore,
					);
					const additionalProducts = lowScoreProducts.slice(0, needed);

					selectedProducts = [...highScoreProducts, ...additionalProducts];
					leftoverProducts = lowScoreProducts.slice(needed);

					console.log(
						`  High-score products: ${highScoreProducts.length}, completing with ${additionalProducts.length} lower-score products to reach ${resultsPerPlatform}`,
					);
				}
			}

			platformResults.set(platform, selectedProducts);
			platformLeftovers.set(platform, leftoverProducts);

			console.log(
				`  Final selection: ${selectedProducts.length} products for ${platform}`,
			);
			console.log(`  Leftover: ${leftoverProducts.length} products`);

			stats.push({
				platform,
				total: platformProducts.length,
				filtered: selectedProducts.filter(
					(p) => p.relevanceScore >= minRelevanceScore,
				).length,
				final: selectedProducts.length,
			});
		}

		// STEP 2: Combine all platform results
		const allSelected: ScoredProduct[] = [];
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
		const allLeftovers: ScoredProduct[] = [];
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
		platformResults: Map<string, ScoredProduct[]>,
		platformLeftovers: Map<string, ScoredProduct[]>,
		globalLimit: number,
		stats: any[],
	): LimitedResults {
		const platformCount = platformResults.size;
		if (platformCount === 0) {
			return { highRelevance: [], otherResults: [], stats };
		}
		const perPlatformLimit = Math.floor(globalLimit / platformCount);
		const remainder = globalLimit % platformCount;

		console.log(
			`Balanced distribution: ${perPlatformLimit} per platform, ${remainder} extra`,
		);

		const finalSelected: ScoredProduct[] = [];
		const allLeftovers: ScoredProduct[] = [];

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
		allSelected: ScoredProduct[],
		platformLeftovers: Map<string, ScoredProduct[]>,
		globalLimit: number,
		stats: any[],
	): LimitedResults {
		console.log("Score-based distribution (may favor certain platforms)");

		const globalSorted = [...allSelected].sort(
			(a, b) => b.relevanceScore - a.relevanceScore,
		);

		const finalTop = globalSorted.slice(0, globalLimit);
		const removed = globalSorted.slice(globalLimit);

		const allLeftovers: ScoredProduct[] = [];
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
