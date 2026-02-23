import type { ApiProvider } from './types';

function placeholderError(providerName: string): Error {
	return new Error(`[api] ${providerName} provider is a placeholder in P1.3-B`);
}

export const sinaProvider: ApiProvider = {
	name: 'sina',
	fetchUniverse: async () => {
		throw placeholderError('sina');
	},
	fetchQuote: async () => {
		throw placeholderError('sina');
	}
};
