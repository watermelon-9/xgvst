import { apiConfig } from './config';
import { providers } from './providers';
import type { QuoteResponse, UniverseResponse } from './types';

const primaryProvider = providers[apiConfig.provider] ?? providers.workers;

async function withFallback<T>(request: () => Promise<T>, mockRequest: () => Promise<T>): Promise<T> {
	try {
		return await request();
	} catch {
		if (!apiConfig.fallbackToMock || primaryProvider.name === 'mock') {
			throw new Error(`[api] ${primaryProvider.name} provider request failed`);
		}
		return mockRequest();
	}
}

export async function fetchUniverse(): Promise<UniverseResponse> {
	return withFallback(() => primaryProvider.fetchUniverse(), () => providers.mock.fetchUniverse());
}

export async function fetchQuote(): Promise<QuoteResponse> {
	return withFallback(() => primaryProvider.fetchQuote(), () => providers.mock.fetchQuote());
}

/** @deprecated use fetchQuote */
export async function fetchQuoteMock(): Promise<QuoteResponse> {
	return fetchQuote();
}
