import { Inject, Injectable } from "@nestjs/common";
import { Model } from "mongoose";
import { nanoid } from "nanoid";
import {
	SearchHistory,
	SearchHistoryDocument,
} from "./schemas/search-history.schema";

@Injectable()
export class SearchHistoryService {
	constructor(
		@Inject("SEARCH_HISTORY_MODEL")
		private searchHistoryModel: Model<SearchHistoryDocument>,
	) {}

	async saveSearch(
		query: string,
		userId: string | null,
		searchParams?: any,
		resultsSummary?: any,
		rankedProducts?: any[],
		otherProducts?: any[],
	): Promise<string> {
		const searchId = nanoid(12);

		const searchHistory = new this.searchHistoryModel({
			searchId,
			query,
			userId: userId || null,
			searchParams: searchParams || null,
			resultsSummary: resultsSummary || null,
			rankedProducts: rankedProducts || [],
			otherProducts: otherProducts || [],
		});

		await searchHistory.save();
		return searchId;
	}

	async getUserHistory(userId: string, limit = 50, skip = 0) {
		const histories = await this.searchHistoryModel
			.find({ userId })
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(skip)
			.select("-__v")
			.lean();

		const total = await this.searchHistoryModel.countDocuments({ userId });

		return {
			data: histories,
			total,
			limit,
			skip,
			hasMore: total > skip + limit,
		};
	}

	async getSearchById(searchId: string, userId: string | null) {
		const search = await this.searchHistoryModel
			.findOne({ searchId })
			.select("-__v")
			.lean();

		if (!search) {
			return null;
		}

		if (search.userId && search.userId !== userId) {
			return null;
		}

		return search;
	}

	async getTotalSearchCount(): Promise<number> {
		return this.searchHistoryModel.countDocuments();
	}

	async getSearchStats() {
		const total = await this.searchHistoryModel.countDocuments().exec();
		const withUsers = await this.searchHistoryModel
			.countDocuments({ userId: { $ne: null } })
			.exec();
		const anonymous = total - withUsers;

		return {
			total,
			authenticated: withUsers,
			anonymous,
		};
	}
}
