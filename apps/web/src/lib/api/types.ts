export interface BoardItem {
	code: string;
	name: string;
	changePct: number;
}

export interface WatchItem {
	symbol: string;
	name: string;
	last: number;
	changePct: number;
}

export interface UniverseResponse {
	boards: BoardItem[];
	watchlist: WatchItem[];
	updatedAt: string;
}

export interface QuoteResponse {
	symbol: string;
	name: string;
	price: number;
	changePct: number;
	ts: string;
	protoBase64?: string;
}
