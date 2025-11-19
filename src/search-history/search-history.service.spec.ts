import { Test, type TestingModule } from "@nestjs/testing";
import { SearchHistoryService } from "./search-history.service";

describe("SearchHistoryService", () => {
	let service: SearchHistoryService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [SearchHistoryService],
		}).compile();

		service = module.get<SearchHistoryService>(SearchHistoryService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
