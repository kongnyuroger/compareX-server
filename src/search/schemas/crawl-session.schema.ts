// src/search/schemas/crawl-session.schema.ts

import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { CrawledProduct } from "src/crawler/types/crawler.types";
import { ProductScore } from "src/crawler/types/crawler-events";

export interface ICrawlSession {
	searchId: string;
	query: string;
	userId: string | null;
	rankedProductIds: string[];
	productScores: ProductScore[]; // ← NEW
	products: Map<string, CrawledProduct>;
	platformStats: Map<string, number>;
	status: string;
	completedAt?: Date;
	metadata?: {
		totalProducts?: number;
		crawlDurationMs?: number;
		failedCrawlers?: string[];
	};
	createdAt?: Date;
	updatedAt?: Date;
}

export type CrawlSessionDocument = ICrawlSession & Document;

@Schema({ timestamps: true })
export class CrawlSession implements ICrawlSession {
	@Prop({ required: true, unique: true, index: true })
	searchId: string;

	@Prop({ required: true })
	query: string;

	@Prop({ index: true })
	userId: string;

	@Prop({ type: [String], default: [] })
	rankedProductIds: string[];

	@Prop({ type: [Object], default: [] }) // ← NEW
	productScores: ProductScore[];

	@Prop({ type: Map, of: Object, default: {} })
	products: Map<string, CrawledProduct>;

	@Prop({ type: Map, of: Number, default: {} })
	platformStats: Map<string, number>;

	@Prop({
		default: "in_progress",
		enum: ["in_progress", "completed", "failed"],
	})
	status: string;

	@Prop()
	completedAt?: Date;

	@Prop({ type: Object })
	metadata?: {
		totalProducts?: number;
		crawlDurationMs?: number;
		failedCrawlers?: string[];
	};

	createdAt?: Date;
	updatedAt?: Date;
}

export const CrawlSessionSchema = SchemaFactory.createForClass(CrawlSession);

// Indexes
CrawlSessionSchema.index({ userId: 1, createdAt: -1 });
CrawlSessionSchema.index({ searchId: 1 }, { unique: true });
CrawlSessionSchema.index({ "productScores.productId": 1 });
