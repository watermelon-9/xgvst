import { mockQuote, mockUniverse } from '../mock';
import type { ApiProvider } from './types';

export const mockProvider: ApiProvider = {
	name: 'mock',
	fetchUniverse: async () => mockUniverse,
	fetchQuote: async () => mockQuote
};
