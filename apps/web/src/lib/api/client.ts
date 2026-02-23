import { mockQuote, mockUniverse } from './mock';
import type { QuoteResponse, UniverseResponse } from './types';

const API_BASE =
	import.meta.env.PUBLIC_WORKER_API_URL?.trim() ?? import.meta.env.PUBLIC_API_URL?.trim() ?? '';

async function fetchWithFallback<T>(path: string, fallback: T): Promise<T> {
	if (!API_BASE) return fallback;

	const res = await fetch(`${API_BASE}${path}`, {
		headers: { Accept: 'application/json' }
	});

	if (!res.ok) return fallback;
	return (await res.json()) as T;
}

export async function fetchUniverse(): Promise<UniverseResponse> {
	// 当前 workers 首轮仅保证 /api/quote/mock，universe 继续兼容旧接口 + mock 回退。
	return fetchWithFallback('/v3/universe', mockUniverse);
}

export async function fetchQuoteMock(): Promise<QuoteResponse> {
	return fetchWithFallback('/api/quote/mock', mockQuote);
}
