import type { QuoteResponse, UniverseResponse } from './types';

export const mockUniverse: UniverseResponse = {
	boards: [
		{ code: 'BK001', name: 'AI算力', changePct: 2.31 },
		{ code: 'BK002', name: '半导体', changePct: -0.84 },
		{ code: 'BK003', name: '机器人', changePct: 1.46 }
	],
	watchlist: [
		{ symbol: '000001', name: '平安银行', last: 10.88, changePct: 0.56 },
		{ symbol: '600519', name: '贵州茅台', last: 1688.0, changePct: -0.21 },
		{ symbol: '300750', name: '宁德时代', last: 205.5, changePct: 1.12 }
	],
	updatedAt: new Date().toISOString()
};

export const mockQuote: QuoteResponse = {
	symbol: '000001',
	name: '平安银行',
	price: 10.88,
	changePct: 0.56,
	ts: new Date().toISOString(),
	protoBase64: 'CgYwMDAwMDE='
};
