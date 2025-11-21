import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "../users/strategy/jwt.strategy";
import { User, UserSchema } from "./schemas/user.schema";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
	imports: [
		MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),

		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				secret: configService.get<string>("JWT_SECRET"),
				signOptions: {
					expiresIn:
						(configService.get<string>("JWT_EXPIRES_IN") as any) || "7d",
				},
			}),
			inject: [ConfigService],
		}),

		PassportModule,
	],
	controllers: [UsersController],
	providers: [UsersService, JwtStrategy],
})
export class UsersModule {}
