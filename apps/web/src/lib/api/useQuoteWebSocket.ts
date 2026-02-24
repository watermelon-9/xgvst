export type QuoteTick = {
	symbol: string;
	price: number;
	changePct: number;
	ts: string;
	source: string;
	transport: 'ws-binary' | 'ws-protobuf' | 'ws-json-fallback';
};

export type WsConnectionStatus =
	| 'idle'
	| 'connecting'
	| 'open'
	| 'reconnecting'
	| 'closed'
	| 'error';

export type QuoteSocketStats = {
	status: WsConnectionStatus;
	reconnectCount: number;
	lastReconnectDurationMs: number | null;
};

type QuoteSocketCommand =
	| {
			type: 'subscribe';
			symbols: string[];
	  }
	| {
			type: 'unsubscribe';
			symbols: string[];
	  }
	| {
			type: 'ping';
	  };

type QuoteSocketMessage =
	| {
			type: 'connected';
	  }
	| {
			type: 'tick';
			data: unknown;
	  }
	| {
			type: 'ping' | 'pong';
	  }
	| {
			ok: boolean;
			type?: string;
			error?: string;
	  };

export type UseQuoteWebSocketOptions = {
	url?: string;
	heartbeatIntervalMs?: number;
	allowJsonTickFallback?: boolean;
	reconnectDelayMs?: number;
};

const textDecoder = new TextDecoder();

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function normalizeTick(value: unknown, transport: QuoteTick['transport']): QuoteTick | null {
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

function readProtoVarint(bytes: Uint8Array, start: number): { value: number; next: number } | null {
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

function decodeQuoteProto(bytes: Uint8Array): QuoteTick | null {
	let offset = 0;
	const draft: Partial<QuoteTick> = {
		source: 'ws-protobuf',
		transport: 'ws-protobuf'
	};

	while (offset < bytes.length) {
		const tag = readProtoVarint(bytes, offset);
		if (!tag) return null;
		offset = tag.next;

		const field = tag.value >>> 3;
		const wireType = tag.value & 0x07;

		if (wireType === 2) {
			const length = readProtoVarint(bytes, offset);
			if (!length) return null;
			offset = length.next;
			const end = offset + length.value;
			if (end > bytes.length) return null;
			const text = textDecoder.decode(bytes.slice(offset, end));

			if (field === 1) {
				draft.symbol = text;
			} else if (field === 4) {
				draft.ts = text;
			}

			offset = end;
			continue;
		}

		if (wireType === 1) {
			const end = offset + 8;
			if (end > bytes.length) return null;
			const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
			const value = view.getFloat64(0, true);

			if (field === 2) {
				draft.price = value;
			} else if (field === 3) {
				draft.changePct = value;
			}

			offset = end;
			continue;
		}

		if (wireType === 0) {
			const varint = readProtoVarint(bytes, offset);
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

	if (!draft.symbol || !draft.ts) return null;
	if (typeof draft.price !== 'number' || typeof draft.changePct !== 'number') return null;

	return {
		symbol: draft.symbol,
		price: draft.price,
		changePct: draft.changePct,
		ts: draft.ts,
		source: draft.source ?? 'ws-protobuf',
		transport: draft.transport ?? 'ws-protobuf'
	};
}

function decodeCustomBinaryFrame(bytes: Uint8Array): QuoteTick | null {
	if (bytes.length < 4) return null;
	if (bytes[0] !== 0x51 || bytes[1] !== 0x54 || bytes[2] !== 0x31) return null; // "QT1"

	let offset = 3;
	const symbolLength = bytes[offset];
	offset += 1;

	if (offset + symbolLength > bytes.length) return null;
	const symbol = textDecoder.decode(bytes.slice(offset, offset + symbolLength));
	offset += symbolLength;

	if (offset + 16 > bytes.length) return null;
	const valuesView = new DataView(bytes.buffer, bytes.byteOffset + offset, 16);
	const price = valuesView.getFloat64(0, true);
	const changePct = valuesView.getFloat64(8, true);
	offset += 16;

	if (offset + 2 > bytes.length) return null;
	const tsLength = new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
	offset += 2;
	if (offset + tsLength > bytes.length) return null;
	const ts = textDecoder.decode(bytes.slice(offset, offset + tsLength));
	offset += tsLength;

	if (offset >= bytes.length) return null;
	const sourceLength = bytes[offset];
	offset += 1;
	if (offset + sourceLength > bytes.length) return null;
	const source = textDecoder.decode(bytes.slice(offset, offset + sourceLength));

	return normalizeTick({ symbol, price, changePct, ts, source }, 'ws-binary');
}

async function decodeBinaryTick(data: ArrayBuffer | Blob): Promise<QuoteTick | null> {
	const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
	const bytes = new Uint8Array(buffer);

	return decodeCustomBinaryFrame(bytes) ?? decodeQuoteProto(bytes);
}

export function useQuoteWebSocket(options: UseQuoteWebSocketOptions = {}) {
	const url = options.url ?? '/ws/quote';
	const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;
	const allowJsonTickFallback = options.allowJsonTickFallback ?? false;
	const reconnectDelayMs = options.reconnectDelayMs ?? 1200;

	let socket: WebSocket | null = null;
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectStartedAt: number | null = null;
	let manualClose = false;

	const subscribedSymbols = new Set<string>();
	const tickHandlers = new Set<(tick: QuoteTick) => void>();
	const statsHandlers = new Set<(stats: QuoteSocketStats) => void>();

	const stats: QuoteSocketStats = {
		status: 'idle',
		reconnectCount: 0,
		lastReconnectDurationMs: null
	};

	const emitStats = () => {
		const snapshot: QuoteSocketStats = {
			status: stats.status,
			reconnectCount: stats.reconnectCount,
			lastReconnectDurationMs: stats.lastReconnectDurationMs
		};
		for (const handler of statsHandlers) {
			handler(snapshot);
		}
	};

	const updateStatus = (next: WsConnectionStatus) => {
		if (stats.status === next) return;
		stats.status = next;
		emitStats();
	};

	const send = (payload: QuoteSocketCommand) => {
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		socket.send(JSON.stringify(payload));
	};

	const emitTick = (tick: QuoteTick) => {
		for (const handler of tickHandlers) {
			handler(tick);
		}
	};

	const flushSubscriptions = () => {
		if (!subscribedSymbols.size) return;
		send({ type: 'subscribe', symbols: [...subscribedSymbols] });
	};

	const startHeartbeat = () => {
		if (heartbeatTimer) clearInterval(heartbeatTimer);
		heartbeatTimer = setInterval(() => {
			send({ type: 'ping' });
		}, heartbeatIntervalMs);
	};

	const stopHeartbeat = () => {
		if (!heartbeatTimer) return;
		clearInterval(heartbeatTimer);
		heartbeatTimer = null;
	};

	const clearReconnectTimer = () => {
		if (!reconnectTimer) return;
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	};

	const scheduleReconnect = () => {
		if (manualClose) return;
		if (reconnectTimer) return;
		if (reconnectStartedAt === null) {
			reconnectStartedAt = Date.now();
		}
		updateStatus('reconnecting');
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connect();
		}, reconnectDelayMs);
	};

	const onMessage = async (event: MessageEvent) => {
		if (typeof event.data === 'string') {
			if (event.data === 'ping') {
				socket?.send('pong');
				return;
			}

			if (!event.data.trim().startsWith('{')) {
				return;
			}

			let payload: QuoteSocketMessage;
			try {
				payload = JSON.parse(event.data) as QuoteSocketMessage;
			} catch {
				return;
			}

			if (payload.type === 'ping') {
				socket?.send('pong');
				return;
			}

			if (payload.type === 'tick' && allowJsonTickFallback && 'data' in payload) {
				const tick = normalizeTick(payload.data, 'ws-json-fallback');
				if (tick) emitTick(tick);
			}
			return;
		}

		if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
			const tick = await decodeBinaryTick(event.data);
			if (tick) emitTick(tick);
		}
	};

	const attachSocket = (ws: WebSocket) => {
		ws.binaryType = 'arraybuffer';
		ws.addEventListener('open', () => {
			clearReconnectTimer();
			if (reconnectStartedAt !== null) {
				stats.reconnectCount += 1;
				stats.lastReconnectDurationMs = Date.now() - reconnectStartedAt;
				reconnectStartedAt = null;
				emitStats();
			}
			updateStatus('open');
			flushSubscriptions();
			startHeartbeat();
		});
		ws.addEventListener('message', (event) => {
			void onMessage(event);
		});
		ws.addEventListener('error', () => {
			stopHeartbeat();
			updateStatus('error');
			scheduleReconnect();
		});
		ws.addEventListener('close', () => {
			stopHeartbeat();
			socket = null;
			if (manualClose) {
				updateStatus('closed');
				return;
			}
			scheduleReconnect();
		});
	};

	const connect = () => {
		if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
			return socket;
		}

		manualClose = false;
		updateStatus(reconnectStartedAt === null ? 'connecting' : 'reconnecting');
		socket = new WebSocket(url);
		attachSocket(socket);
		return socket;
	};

	const subscribe = (symbols: string[]) => {
		for (const symbol of symbols) {
			subscribedSymbols.add(symbol);
		}
		flushSubscriptions();
	};

	const unsubscribe = (symbols: string[]) => {
		for (const symbol of symbols) {
			subscribedSymbols.delete(symbol);
		}
		send({ type: 'unsubscribe', symbols });
	};

	const close = () => {
		manualClose = true;
		stopHeartbeat();
		clearReconnectTimer();
		reconnectStartedAt = null;
		if (socket && socket.readyState < WebSocket.CLOSING) {
			socket.close(1000, 'client closed');
		}
		socket = null;
		updateStatus('closed');
	};

	const onTick = (handler: (tick: QuoteTick) => void) => {
		tickHandlers.add(handler);
		return () => {
			tickHandlers.delete(handler);
		};
	};

	const onStats = (handler: (snapshot: QuoteSocketStats) => void) => {
		statsHandlers.add(handler);
		handler({ ...stats });
		return () => {
			statsHandlers.delete(handler);
		};
	};

	const getStats = (): QuoteSocketStats => ({ ...stats });

	return {
		connect,
		subscribe,
		unsubscribe,
		close,
		onTick,
		onStats,
		getStats
	};
}
