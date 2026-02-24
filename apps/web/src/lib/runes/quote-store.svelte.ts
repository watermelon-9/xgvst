import { useQuoteWebSocket, type QuoteSocketStats, type QuoteTick } from '$lib/api';
import {
	EXPECTED_QUOTE_TICK_TYPE_SIGNATURE,
	getQuoteTickTypeSignature,
	isQuoteTickViewConsistent
} from '$lib/api/quoteCodec';

type SubscriptionScope = {
	activeSymbol: string;
	watchlistSymbols: string[];
};

const QUOTE_JSON_FALLBACK_DEBUG_KEY = 'xgvst.debug.quoteJsonFallback';
const QUOTE_WS_URL_DEBUG_KEY = 'xgvst.debug.quoteWsUrl';

function parseBooleanish(raw: string | null | undefined): boolean | null {
	if (raw == null) return null;
	const normalized = raw.trim().toLowerCase();
	if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
		return true;
	}
	if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
		return false;
	}
	return null;
}

function resolveJsonTickFallbackEnabled(): boolean {
	if (typeof window === 'undefined') return false;

	const queryValue = parseBooleanish(new URLSearchParams(window.location.search).get('quoteJsonFallback'));
	if (queryValue !== null) return queryValue;

	try {
		const stored = parseBooleanish(window.localStorage.getItem(QUOTE_JSON_FALLBACK_DEBUG_KEY));
		return stored ?? false;
	} catch {
		return false;
	}
}

function resolveQuoteWsUrl(): string | undefined {
	if (typeof window === 'undefined') return undefined;

	const queryUrl = new URLSearchParams(window.location.search).get('quoteWsUrl')?.trim();
	if (queryUrl) return queryUrl;

	try {
		const stored = window.localStorage.getItem(QUOTE_WS_URL_DEBUG_KEY)?.trim();
		return stored || undefined;
	} catch {
		return undefined;
	}
}

const jsonTickFallbackEnabled = resolveJsonTickFallbackEnabled();
const quoteWsUrl = resolveQuoteWsUrl();
const quoteSocket = useQuoteWebSocket({
	url: quoteWsUrl,
	allowJsonTickFallback: jsonTickFallbackEnabled
});

export const quoteStore = $state({
	latestTick: null as QuoteTick | null,
	latestSource: '—',
	latestTickBySymbol: {} as Record<string, QuoteTick | undefined>,
	tickTransportCounter: {
		'ws-binary': 0,
		'ws-protobuf': 0,
		'ws-json-fallback': 0
	} as Record<QuoteTick['transport'], number>,
	latestTickDataType: 'none',
	latestTickTypeExpected: EXPECTED_QUOTE_TICK_TYPE_SIGNATURE,
	latestTickTypeConsistent: true,
	jsonTickFallbackEnabled,
	quoteWsUrl: quoteWsUrl ?? '/ws/quote',
	socketStats: {
		status: 'idle',
		reconnectCount: 0,
		lastReconnectDurationMs: null,
		binaryFrames: 0,
		fallbackFrames: 0,
		protobufDecodeSuccess: 0,
		recovering: false,
		pendingRecoverySymbols: []
	} as QuoteSocketStats,
	subscribedSymbols: [] as string[],
	resubscribeCount: 0
});

let attached = false;
let consumers = 0;
let detachTick: (() => void) | null = null;
let detachStats: (() => void) | null = null;

function normalizeSymbols(symbols: string[]): string[] {
	const seen = new Set<string>();
	for (const raw of symbols) {
		const symbol = raw.trim();
		if (!symbol || seen.has(symbol)) continue;
		seen.add(symbol);
	}
	return [...seen];
}

function symbolsChanged(nextSymbols: string[]): boolean {
	if (nextSymbols.length !== quoteStore.subscribedSymbols.length) return true;
	for (let i = 0; i < nextSymbols.length; i += 1) {
		if (quoteStore.subscribedSymbols[i] !== nextSymbols[i]) return true;
	}
	return false;
}

function ensureAttached() {
	if (attached) return;
	attached = true;

	detachTick = quoteSocket.onTick((tick) => {
		if (!isQuoteTickViewConsistent(tick)) return;
		if (!quoteStore.subscribedSymbols.includes(tick.symbol)) return;

		quoteStore.latestTick = tick;
		quoteStore.latestSource = tick.source;
		quoteStore.latestTickBySymbol[tick.symbol] = tick;
		quoteStore.tickTransportCounter[tick.transport] += 1;
		quoteStore.latestTickDataType = getQuoteTickTypeSignature(tick);
		quoteStore.latestTickTypeConsistent =
			quoteStore.latestTickDataType === quoteStore.latestTickTypeExpected;
	});

	detachStats = quoteSocket.onStats((stats) => {
		quoteStore.socketStats = stats;
	});
}

export function mountQuoteStore() {
	consumers += 1;
	ensureAttached();
	quoteSocket.connect();

	return () => {
		consumers = Math.max(consumers - 1, 0);
		if (consumers > 0) return;

		quoteSocket.close();
		if (detachTick) {
			detachTick();
			detachTick = null;
		}
		if (detachStats) {
			detachStats();
			detachStats = null;
		}
		attached = false;
	};
}

export function setQuoteSubscriptionScope(scope: SubscriptionScope) {
	const activeSymbol = scope.activeSymbol.trim();
	const nextSymbols = normalizeSymbols([activeSymbol, ...scope.watchlistSymbols]);
	if (!symbolsChanged(nextSymbols)) return;

	quoteStore.subscribedSymbols = nextSymbols;
	quoteStore.resubscribeCount += 1;
	quoteSocket.subscribe(nextSymbols);
}
