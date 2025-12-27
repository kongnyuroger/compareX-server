// src/search/services/crawl-session.service.ts

import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { nanoid } from "nanoid";
import { CrawledProduct } from "src/crawler/types/crawler.types";
import {
	CrawlSession,
	CrawlSessionDocument,
} from "../schemas/crawl-session.schema";

@Injectable()
export class CrawlSessionService {
	constructor(
		@InjectModel(CrawlSession.name)
		private crawlSessionModel: Model<CrawlSessionDocument>,
	) {}

	/**
	 * Create a new crawl session
	 */
	async createSession(query: string, userId: string | null): Promise<string> {
		const searchId = nanoid(12);

		const session = new this.crawlSessionModel({
			searchId,
			query,
			userId,
			rankedProductIds: [],
			products: {},
			platformStats: {},
			status: "in_progress",
		});

		await session.save();

		console.log(`✅ Created crawl session: ${searchId}`);
		return searchId;
	}

	/**
	 * Add products to session (atomic operation)
	 * Stores full product objects in a Map keyed by ID
	 */
	async addProducts(
		searchId: string,
		products: CrawledProduct[],
	): Promise<void> {
		if (products.length === 0) return;

		// Build update object for MongoDB
		const productUpdates: Record<string, CrawledProduct> = {};
		products.forEach((product) => {
			productUpdates[`products.${product.id}`] = product;
		});

		await this.crawlSessionModel.updateOne(
			{ searchId },
			{
				$set: productUpdates,
			},
		);

		console.log(`💾 Stored ${products.length} products in session ${searchId}`);
	}

	/**
	 * Append ranked product IDs (atomic, maintains order, no duplicates)
	 */
	async appendRankedProductIds(
		searchId: string,
		productIds: string[],
	): Promise<void> {
		if (productIds.length === 0) return;

		// Use $push with $each to maintain order and avoid duplicates
		// Note: We rely on application logic to prevent duplicates
		await this.crawlSessionModel.updateOne(
			{ searchId },
			{
				$push: { rankedProductIds: { $each: productIds } },
			},
		);

		console.log(
			`📝 Appended ${productIds.length} ranked product IDs to session ${searchId}`,
		);
	}

	/**
	 * Update platform statistics
	 */
	async updatePlatformStats(
		searchId: string,
		platform: string,
		count: number,
	): Promise<void> {
		await this.crawlSessionModel.updateOne(
			{ searchId },
			{
				$set: { [`platformStats.${platform}`]: count },
			},
		);
	}

	/**
	 * Mark session as completed
	 */
	async completeSession(
		searchId: string,
		metadata?: {
			totalProducts?: number;
			crawlDurationMs?: number;
			failedCrawlers?: string[];
		},
	): Promise<void> {
		await this.crawlSessionModel.updateOne(
			{ searchId },
			{
				$set: {
					status: "completed",
					completedAt: new Date(),
					metadata,
				},
			},
		);

		console.log(`✅ Completed crawl session: ${searchId}`);
	}

	/**
	 * Mark session as failed
	 */
	async failSession(searchId: string, error: string): Promise<void> {
		await this.crawlSessionModel.updateOne(
			{ searchId },
			{
				$set: {
					status: "failed",
					"metadata.error": error,
				},
			},
		);

		console.log(`❌ Failed crawl session: ${searchId} - ${error}`);
	}

	/**
	 * Get session by ID (includes full products)
	 */
	async getSession(searchId: string): Promise<CrawlSessionDocument | null> {
		return this.crawlSessionModel.findOne({ searchId }).exec();
	}

	/**
	 * Get ranked products for a session (in correct order)
	 */
	async getRankedProducts(searchId: string): Promise<CrawledProduct[]> {
		const session = await this.crawlSessionModel
			.findOne({ searchId })
			.select("rankedProductIds products")
			.lean()
			.exec();

		if (!session) return [];

		// Reconstruct products in ranked order
		const products = session.products as Record<string, CrawledProduct>;
		const rankedProducts: CrawledProduct[] = [];

		for (const productId of session.rankedProductIds) {
			const product = products[productId];
			if (product) {
				rankedProducts.push(product);
			}
		}

		return rankedProducts;
	}

	/**
	 * Get user's crawl history (only metadata, no products)
	 */
	async getUserSessions(
		userId: string,
		limit = 50,
		skip = 0,
	): Promise<CrawlSessionDocument[]> {
		return this.crawlSessionModel
			.find({ userId })
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(skip)
			.select(
				"searchId query status createdAt platformStats metadata.totalProducts completedAt",
			)
			.exec();
	}

	/**
	 * Get product count for a session
	 */
	async getProductCount(searchId: string): Promise<number> {
		const session = await this.crawlSessionModel
			.findOne({ searchId })
			.select("products")
			.lean()
			.exec();

		if (!session?.products) return 0;

		return Object.keys(session.products).length;
	}

	/**
	 * Delete old sessions (cleanup job)
	 */
	async deleteOldSessions(daysOld: number = 30): Promise<number> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysOld);

		const result = await this.crawlSessionModel.deleteMany({
			createdAt: { $lt: cutoffDate },
		});

		console.log(`🗑️  Deleted ${result.deletedCount} old sessions`);
		return result.deletedCount;
	}
}
