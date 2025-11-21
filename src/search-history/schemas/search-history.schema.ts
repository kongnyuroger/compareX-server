import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ timestamps: true })
export class SearchHistory extends Document {
	@Prop({
		type: Types.ObjectId,
		ref: "User",
		required: true,
		index: true,
	})
	userId: Types.ObjectId;

	@Prop({
		required: true,
		trim: true,
		minlength: 3,
		maxlength: 100,
	})
	query: string;

	@Prop({
		type: Date,
		required: true,
		index: true,
		default: Date.now,
	})
	timestamp: Date;
}

export const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory);

SearchHistorySchema.index({ userId: 1, timestamp: -1 });
SearchHistorySchema.set("toJSON", {
	transform: (_doc, ret: any, options: any) => {
		ret.id = ret._id;
		delete ret._id;
		delete ret.__v;
		return ret;
	},
});
