import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.enableCors({
		origin: ["http://localhost:3000", "http://192.168.1.53:3000"],
		credentials: true,
		methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
		allowedHeaders: "Content-Type, Authorization",
	});
	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
