import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User extends Document {
	@Prop({
		required: true,
		unique: true,
		index: true,
		trim: true,
		minLength: 3,
		maxLength: 30,
	})
	username: string;

	@Prop({
		required: true,
		unique: true,
		index: true,
		lowercase: true,
		trim: true,
		match: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
	})
	email: string;

	@Prop({
		required: true,
		select: false,
		minLength: 6,
	})
	password: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set("toJSON", {
	transform: (_doc, ret: any, _options?: any) => {
		delete ret.passwordHash;
		return ret;
	},
});
