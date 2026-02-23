export type ApiProviderName = 'workers' | 'alltick' | 'sina' | 'tencent' | 'mock';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined) return defaultValue;
	const normalized = value.trim().toLowerCase();
	if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
	if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
	return defaultValue;
}

function resolveProvider(rawProvider: string | undefined): ApiProviderName {
	const normalized = rawProvider?.trim().toLowerCase();
	switch (normalized) {
		case 'workers':
		case 'alltick':
		case 'sina':
		case 'tencent':
		case 'mock':
			return normalized;
		default:
			return 'workers';
	}
}

export const apiConfig = {
	provider: resolveProvider(import.meta.env.PUBLIC_API_PROVIDER),
	workerApiUrl: import.meta.env.PUBLIC_WORKER_API_URL?.trim() ?? '',
	legacyApiUrl: import.meta.env.PUBLIC_API_URL?.trim() ?? '',
	fallbackToMock: parseBoolean(import.meta.env.PUBLIC_API_FALLBACK_MOCK, true)
};
