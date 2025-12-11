import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: false })
export class Product {
	@Prop() title: string;
	@Prop() price?: number;
	@Prop() currency?: string;
	@Prop() imageUrl?: string;
	@Prop() productUrl?: string;
	@Prop({ required: true }) source: string;
	@Prop() rating?: number;
	@Prop() reviewCount?: number;
	@Prop() isSponsored?: boolean;
	@Prop() badge?: string;
	@Prop() basePrice?: number;
	@Prop() supplier?: string;
	@Prop() moq?: string;
	@Prop() hasTradeAssurance?: boolean;
	@Prop() hasFreeShipping?: boolean;
	@Prop() hasWalmartPlus?: boolean;
	@Prop() condition?: string;
	@Prop() shipping?: string;
	@Prop() seller?: string;
	@Prop() watchCount?: string;
	@Prop() isBuyItNow?: boolean;
	@Prop() relevanceScore?: number;
	@Prop() aiScore?: number;
	@Prop() createdAt?: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
