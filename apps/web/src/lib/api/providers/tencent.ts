import type { ApiProvider } from './types';

function placeholderError(providerName: string): Error {
	return new Error(`[api] ${providerName} provider is a placeholder in P1.3-B`);
}

export const tencentProvider: ApiProvider = {
	name: 'tencent',
	fetchUniverse: async () => {
		throw placeholderError('tencent');
	},
	fetchQuote: async () => {
		throw placeholderError('tencent');
	}
};
