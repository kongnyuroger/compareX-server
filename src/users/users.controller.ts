import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { AuthDto } from "../users/dto/auth.dto";
import { LoginDto } from "../users/dto/login.dto";
import { UsersService } from "./users.service";

interface UserRequest extends Request {
	user: {
		userId: string;
		email: string;
		username: string;
	};
}

@Controller("auth")
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Throttle({ default: { limit: 3, ttl: 60000 } })
	@Post("register")
	@HttpCode(HttpStatus.CREATED)
	register(@Body() _dto: AuthDto) {
		return this.usersService.register(_dto);
	}

	@Throttle({ default: { limit: 3, ttl: 60000 } })
	@Post("login")
	@HttpCode(HttpStatus.OK)
	login(@Body() _dto: LoginDto) {
		return this.usersService.login(_dto);
	}

	@UseGuards(AuthGuard("jwt"))
	@Get("profile")
	getProfile(@Req() _req: UserRequest) {
		return {
			message: "Access granted to protected route",
			user: _req.user,
		};
	}

	@UseGuards(AuthGuard("jwt"))
	@Post("logout")
	@HttpCode(HttpStatus.OK)
	logout(@Req() req: UserRequest) {
		return this.usersService.logout(req.user.userId);
	}
}
