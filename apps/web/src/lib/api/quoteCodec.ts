export type QuoteTransport = 'ws-binary' | 'ws-protobuf' | 'ws-json-fallback';

export type QuoteTick = {
	symbol: string;
	price: number;
	changePct: number;
	ts: string;
	source: string;
	transport: QuoteTransport;
};

const EXPECTED_SYMBOL_TYPE = 'string';
const EXPECTED_NUMBER_TYPE = 'number';

export const EXPECTED_QUOTE_TICK_TYPE_SIGNATURE =
	`${EXPECTED_NUMBER_TYPE}/${EXPECTED_NUMBER_TYPE}/${EXPECTED_SYMBOL_TYPE}` as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function decodeQuote(value: unknown, transport: QuoteTransport): QuoteTick | null {
	if (!isRecord(value)) return null;

	const symbol = value.symbol;
	const price = value.price;
	const changePct = value.changePct;
	const ts = value.ts;
	const source = value.source;

	if (
		typeof symbol !== 'string' ||
		typeof ts !== 'string' ||
		typeof source !== 'string' ||
		typeof price !== 'number' ||
		!Number.isFinite(price) ||
		typeof changePct !== 'number' ||
		!Number.isFinite(changePct)
	) {
		return null;
	}

	return {
		symbol,
		price,
		changePct,
		ts,
		source,
		transport
	};
}

export function getQuoteTickTypeSignature(tick: QuoteTick): string {
	return `${typeof tick.price}/${typeof tick.changePct}/${typeof tick.symbol}`;
}

export function isQuoteTickViewConsistent(tick: QuoteTick): boolean {
	return getQuoteTickTypeSignature(tick) === EXPECTED_QUOTE_TICK_TYPE_SIGNATURE;
}
