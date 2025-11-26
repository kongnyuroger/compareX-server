import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);
	app.enableCors({
		origin: configService.get<string>("CORS_ORIGIN"),
		methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
		credentials: true,
	});

	await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
