import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

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

	/**
	 * RANKED PRODUCTS (AI-selected)
	 */
	@Prop({
		type: [
			{
				title: String,
				price: Number,
				currency: String,
				imageUrl: String,
				productUrl: String,
				source: String,
				rating: Number,
				reviewCount: Number,
				isSponsored: Boolean,
				badge: String,
				basePrice: Number,
				supplier: String,
				moq: String,
				hasTradeAssurance: Boolean,
				hasFreeShipping: Boolean,
				hasWalmartPlus: Boolean,
				condition: String,
				shipping: String,
				seller: String,
				watchCount: String,
				isBuyItNow: Boolean,
				relevanceScore: Number,
				aiScore: Number,
				createdAt: Date,
			},
		],
		default: [],
	})
	rankedProducts: Array<{
		title: string;
		price?: number;
		currency?: string;
		imageUrl?: string;
		productUrl?: string;
		source: string;
		rating?: number;
		reviewCount?: number;
		isSponsored?: boolean;
		badge?: string;
		basePrice?: number;
		supplier?: string;
		moq?: string;
		hasTradeAssurance?: boolean;
		hasFreeShipping?: boolean;
		hasWalmartPlus?: boolean;
		condition?: string;
		shipping?: string;
		seller?: string;
		watchCount?: string;
		isBuyItNow?: boolean;
		relevanceScore?: number;
		aiScore?: number;
		createdAt?: Date;
	}>;

	/**
	 * OTHER PRODUCTS (lower-ranked)
	 */
	@Prop({
		type: [
			{
				title: String,
				price: Number,
				currency: String,
				imageUrl: String,
				productUrl: String,
				source: String,
				rating: Number,
				reviewCount: Number,
				isSponsored: Boolean,
				badge: String,
				basePrice: Number,
				supplier: String,
				moq: String,
				hasTradeAssurance: Boolean,
				hasFreeShipping: Boolean,
				hasWalmartPlus: Boolean,
				condition: String,
				shipping: String,
				seller: String,
				watchCount: String,
				isBuyItNow: Boolean,
				relevanceScore: Number,
				aiScore: Number,
				createdAt: Date,
			},
		],
		default: [],
	})
	otherProducts: Array<{
		title: string;
		price?: number;
		currency?: string;
		imageUrl?: string;
		productUrl?: string;
		source: string;
		rating?: number;
		reviewCount?: number;
		isSponsored?: boolean;
		badge?: string;
		basePrice?: number;
		supplier?: string;
		moq?: string;
		hasTradeAssurance?: boolean;
		hasFreeShipping?: boolean;
		hasWalmartPlus?: boolean;
		condition?: string;
		shipping?: string;
		seller?: string;
		watchCount?: string;
		isBuyItNow?: boolean;
		relevanceScore?: number;
		aiScore?: number;
		createdAt?: Date;
	}>;
}

export const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory);

// Indexes for efficient querying
SearchHistorySchema.index({ userId: 1, createdAt: -1 });
SearchHistorySchema.index({ searchId: 1 });
