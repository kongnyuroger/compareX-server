import { Type } from "class-transformer";
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
} from "class-validator";

export class SearchParamsDto {
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	@Max(100)
	resultsPerPlatform?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	@Max(300)
	globalLimit?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	@Max(1)
	minScore?: number;

	@IsOptional()
	@IsString()
	sortBy?: "relevance" | "price_low" | "price_high" | "rating";

	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	balance?: boolean;
}
