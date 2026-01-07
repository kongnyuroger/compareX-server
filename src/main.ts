import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { AppModule } from "./app.module";
import swaggerOptions from "./docs/swagger.config";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);
	app.enableCors({
		origin: configService.get<string>("CORS_ORIGIN"),
		methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
		credentials: true,
	});

	//  Generate OpenAPI spec
	const swaggerSpec = swaggerJSDoc(swaggerOptions);

	// Swagger UI
	app.use(
		"/api-docs",
		swaggerUi.serve,
		swaggerUi.setup(swaggerSpec, {
			persistAuthorization: true,
			explorer: true,
		}),
	);

	// expose raw OpenAPI JSON
	app.use("/api-docs-json", (_req, res) => {
		res.setHeader("Content-Type", "application/json");
		res.send(swaggerSpec);
	});

	await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
