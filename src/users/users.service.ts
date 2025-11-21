import {
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import * as bcrypt from "bcrypt";
import type { Model } from "mongoose";
import type { AuthDto } from "../users/dto/auth.dto";
import type { LoginDto } from "../users/dto/login.dto";
import { User, type UserDocument } from "./schemas/user.schema";

@Injectable()
export class UsersService {
	constructor(
		@InjectModel(User.name) private readonly _userModel: Model<UserDocument>,
		private readonly jwtService: JwtService,
	) {}

	private async hashPassword(password: string): Promise<string> {
		const saltRounds = 10;
		return bcrypt.hash(password, saltRounds);
	}

	private getJwtToken(userId: string, email: string, username: string): string {
		const payload = { sub: userId, email, username };
		return this.jwtService.sign(payload);
	}

	async register(dto: AuthDto) {
		const existingUser = await this._userModel.findOne({
			$or: [{ email: dto.email }, { username: dto.username }],
		});

		if (existingUser) {
			throw new ForbiddenException(
				"User with this email or username already exists.",
			);
		}

		const hashedPassword = await this.hashPassword(dto.password);

		const newUser = new this._userModel({
			email: dto.email,
			username: dto.username,
			password: hashedPassword,
		});

		await newUser.save();

		const token = this.getJwtToken(
			newUser._id.toString(),
			newUser.email,
			newUser.username,
		);

		return {
			email: newUser.email,
			username: newUser.username,
			token,
		};
	}

	async login(dto: LoginDto) {
		const { emailOrUsername, password } = dto;

		if (!emailOrUsername || !password) {
			throw new UnauthorizedException(
				"Email/username and password are required",
			);
		}

		const user = await this._userModel
			.findOne({
				$or: [{ email: emailOrUsername }, { username: emailOrUsername }],
			})
			.select("+password");

		if (!user) {
			throw new UnauthorizedException("Invalid credentials");
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			throw new UnauthorizedException("Invalid credentials");
		}

		const token = this.getJwtToken(
			user._id.toString(),
			user.email,
			user.username,
		);

		const { password: _removedPassword, ...userWithoutPassword } =
			user.toObject();

		return {
			...userWithoutPassword,
			token,
		};
	}

	logout(userId: string) {
		console.log(`User ${userId} requested logout.`);
		return { message: "Successfully logged out." };
	}
}
