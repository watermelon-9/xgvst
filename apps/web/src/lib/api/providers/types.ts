import type { ApiProviderName } from '../config';
import type { QuoteResponse, UniverseResponse } from '../types';

export interface ApiProvider {
	name: ApiProviderName;
	fetchUniverse: () => Promise<UniverseResponse>;
	fetchQuote: () => Promise<QuoteResponse>;
}
