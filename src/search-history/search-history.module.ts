import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
	SearchHistory,
	SearchHistorySchema,
} from "./schemas/search-history.schema";
import { SearchHistoryController } from "./search-history.controller";
import { SearchHistoryService } from "./search-history.service";

@Module({
	imports: [
		MongooseModule.forFeature([
			{
				name: SearchHistory.name,
				schema: SearchHistorySchema,
			},
		]),
	],
	controllers: [SearchHistoryController],
	providers: [SearchHistoryService],
	exports: [SearchHistoryService],
})
export class SearchHistoryModule {}
