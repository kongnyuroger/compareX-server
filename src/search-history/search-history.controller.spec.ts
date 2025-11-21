import { Test, type TestingModule } from "@nestjs/testing";
import { SearchHistoryController } from "./search-history.controller";

describe("SearchHistoryController", () => {
	let controller: SearchHistoryController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SearchHistoryController],
		}).compile();

		controller = module.get<SearchHistoryController>(SearchHistoryController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
