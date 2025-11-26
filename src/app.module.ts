import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AiModule } from "./ai/ai.module";
import { AiService } from "./ai/ai.services.";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		MongooseModule.forRoot(
			process.env.MONGO_URI || "mongodb://localhost:27017/compare_db",
		),
		UsersModule,
		AiModule,
	],
	controllers: [AppController],
	providers: [AppService, AiService],
})
export class AppModule {}
