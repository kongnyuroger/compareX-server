import {
	IsEmail,
	IsNotEmpty,
	IsString,
	MaxLength,
	MinLength,
} from "class-validator";

export class AuthDto {
	@IsEmail({}, { message: "Email is not valid" })
	@IsNotEmpty({ message: "Email is required" })
	email: string;

	@IsString()
	@IsNotEmpty({ message: "Username is required" })
	username: string;

	@IsString()
	@IsNotEmpty({ message: "Password is required" })
	@MinLength(6, { message: "Password must be at least 6 characters long" })
	@MaxLength(32, { message: "Password must be at most 32 characters long" })
	password: string;
}
