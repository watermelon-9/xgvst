import type { ApiProviderName } from '../config';
import { alltickProvider } from './alltick';
import { mockProvider } from './mock';
import { sinaProvider } from './sina';
import { tencentProvider } from './tencent';
import { workersProvider } from './workers';
import type { ApiProvider } from './types';

export const providers: Record<ApiProviderName, ApiProvider> = {
	workers: workersProvider,
	alltick: alltickProvider,
	sina: sinaProvider,
	tencent: tencentProvider,
	mock: mockProvider
};
