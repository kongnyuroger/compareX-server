import { Transform, Type } from "class-transformer";
import {
	IsBoolean,
	IsIn,
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
	@IsIn(["relevance", "price_low", "price_high", "rating"])
	sortBy?: "relevance" | "price_low" | "price_high" | "rating";

	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => {
		if (value === "true" || value === true) return true;
		if (value === "false" || value === false) return false;
		return undefined; // preserves Optional behavior
	})
	balance?: boolean;
}
