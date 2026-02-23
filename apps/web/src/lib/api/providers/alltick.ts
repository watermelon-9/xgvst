import type { ApiProvider } from './types';

function placeholderError(providerName: string): Error {
	return new Error(`[api] ${providerName} provider is a placeholder in P1.3-B`);
}

export const alltickProvider: ApiProvider = {
	name: 'alltick',
	fetchUniverse: async () => {
		throw placeholderError('alltick');
	},
	fetchQuote: async () => {
		throw placeholderError('alltick');
	}
};
