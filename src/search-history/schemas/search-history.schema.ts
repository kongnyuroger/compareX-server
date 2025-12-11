import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { Product, ProductSchema } from "./product.schema";

export type SearchHistoryDocument = SearchHistory &
	Document & {
		createdAt: Date;
		updatedAt: Date;
	};

@Schema({ timestamps: true })
export class SearchHistory {
	@Prop({ required: true, unique: true })
	searchId: string;

	@Prop({ required: true })
	query: string;

	@Prop({ type: String, default: null })
	userId: string | null;

	@Prop({ type: Object, default: null })
	searchParams?: {
		resultsPerPlatform?: number;
		globalLimit?: number;
		minScore?: number;
		sortBy?: string;
		balance?: boolean;
	};

	@Prop({ type: Object, default: null })
	resultsSummary?: {
		totalFound?: number;
		totalAfterFiltering?: number;
		platforms?: string[];
		platformStats?: any[];
	};

	@Prop({ type: [ProductSchema], default: [] })
	rankedProducts: Product[];

	@Prop({ type: [ProductSchema], default: [] })
	otherProducts: Product[];
}

export const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory);

// Indexes for efficient querying
SearchHistorySchema.index({ userId: 1, createdAt: -1 });
SearchHistorySchema.index({ searchId: 1 });
