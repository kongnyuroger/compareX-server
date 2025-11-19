import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ timestamps: true })
export class User extends Document {
	@Prop({
		required: true,
		unique: true,
		index: true,
		trim: true,
		minlength: 3,
		maxlength: 30,
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

	@Prop({ required: true, select: false })
	passwordHash: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });

UserSchema.set("toJSON", {
	transform: (_doc, ret: Record<string, unknown>) => {
		delete ret.passwordHash;
		return ret;
	},
});
