import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type SearchHistoryDocument = SearchHistory & Document;

@Schema({ timestamps: true })
export class SearchHistory {
	@Prop({ required: true, unique: true })
	searchId: string;

	@Prop({ required: true })
	query: string;

	@Prop({ type: String, default: null })
	userId?: string | null;

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
	};

	@Prop({ type: Array, default: [] })
	rankedProducts?: any[];

	@Prop({ type: Array, default: [] })
	otherProducts?: any[];
}

export const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory);

SearchHistorySchema.index({ userId: 1, createdAt: -1 });
SearchHistorySchema.index({ searchId: 1 });
