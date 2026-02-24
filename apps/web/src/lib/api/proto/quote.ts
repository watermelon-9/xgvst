export type QuotePayload = {
	symbol: string;
	price: number;
	changePct: number;
	ts: string;
};

const textDecoder = new TextDecoder();

function readVarint(bytes: Uint8Array, start: number): { value: number; next: number } | null {
	let value = 0;
	let shift = 0;
	let offset = start;

	while (offset < bytes.length && shift <= 28) {
		const byte = bytes[offset];
		value |= (byte & 0x7f) << shift;
		offset += 1;

		if ((byte & 0x80) === 0) {
			return { value, next: offset };
		}

		shift += 7;
	}

	return null;
}

/**
 * Minimal protobuf decoder for QuotePayload:
 * 1 -> symbol (string)
 * 2 -> price (double)
 * 3 -> changePct (double)
 * 4 -> ts (string)
 */
export function decodeQuotePayload(bytes: Uint8Array): QuotePayload | null {
	let offset = 0;
	const draft: Partial<QuotePayload> = {};

	while (offset < bytes.length) {
		const tag = readVarint(bytes, offset);
		if (!tag) return null;
		offset = tag.next;

		const field = tag.value >>> 3;
		const wireType = tag.value & 0x07;

		if (wireType === 2) {
			const length = readVarint(bytes, offset);
			if (!length) return null;
			offset = length.next;

			const end = offset + length.value;
			if (end > bytes.length) return null;
			const value = textDecoder.decode(bytes.slice(offset, end));

			if (field === 1) draft.symbol = value;
			if (field === 4) draft.ts = value;

			offset = end;
			continue;
		}

		if (wireType === 1) {
			const end = offset + 8;
			if (end > bytes.length) return null;

			const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
			const value = view.getFloat64(0, true);

			if (field === 2) draft.price = value;
			if (field === 3) draft.changePct = value;

			offset = end;
			continue;
		}

		if (wireType === 0) {
			const varint = readVarint(bytes, offset);
			if (!varint) return null;
			offset = varint.next;
			continue;
		}

		if (wireType === 5) {
			offset += 4;
			if (offset > bytes.length) return null;
			continue;
		}

		return null;
	}

	if (
		typeof draft.symbol !== 'string' ||
		typeof draft.ts !== 'string' ||
		typeof draft.price !== 'number' ||
		typeof draft.changePct !== 'number'
	) {
		return null;
	}

	if (!Number.isFinite(draft.price) || !Number.isFinite(draft.changePct)) {
		return null;
	}

	return {
		symbol: draft.symbol,
		price: draft.price,
		changePct: draft.changePct,
		ts: draft.ts
	};
}
