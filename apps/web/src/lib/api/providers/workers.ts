import { apiConfig } from '../config';
import type { QuoteResponse, UniverseResponse } from '../types';
import { fetchJson } from './http';
import type { ApiProvider } from './types';

function resolveBaseUrl(): string {
	const baseUrl = apiConfig.workerApiUrl || apiConfig.legacyApiUrl;
	if (!baseUrl) {
		throw new Error('PUBLIC_WORKER_API_URL / PUBLIC_API_URL is not configured');
	}
	return baseUrl;
}

export const workersProvider: ApiProvider = {
	name: 'workers',
	fetchUniverse: async () => fetchJson<UniverseResponse>(`${resolveBaseUrl()}/v3/universe`),
	fetchQuote: async () => fetchJson<QuoteResponse>(`${resolveBaseUrl()}/api/quote/mock`)
};
