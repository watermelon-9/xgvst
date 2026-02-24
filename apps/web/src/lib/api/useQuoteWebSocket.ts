import { decodeQuotePayload } from './proto/quote';

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
	| 'error'
	| 'failed';

export type QuoteSocketStats = {
	status: WsConnectionStatus;
	reconnectCount: number;
	lastReconnectDurationMs: number | null;
	binaryFrames: number;
	fallbackFrames: number;
	protobufDecodeSuccess: number;
	recovering: boolean;
	pendingRecoverySymbols: string[];
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
			type: 'resync';
			symbols: string[];
			clientSentAtMs?: number;
	  }
	| {
			type: 'ping';
	  };

type QuoteSocketMessage =
	| {
			type: 'connected';
	  }
	| {
			type: 'resync_ack';
			pending?: boolean;
			symbols?: string[];
			immediateData?: unknown[];
	  }
	| {
			type: 'resynced' | 'subscribed' | 'unsubscribed';
			symbols?: string[];
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
	baseDelayMs?: number;
	maxDelayMs?: number;
	jitterFactor?: number;
	maxRetries?: number;
	initialJitterRangeMs?: number;
	reconnectFastLaneMs?: number;
};

const textDecoder = new TextDecoder();

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isResyncAckMessage(
	value: QuoteSocketMessage
): value is { type: 'resync_ack'; pending?: boolean; symbols?: string[]; immediateData?: unknown[] } {
	return value.type === 'resync_ack';
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

type DecodeBinaryResult = {
	tick: QuoteTick;
	decodedBy: 'protobuf' | 'legacy-binary';
};

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

function decodeBinaryTickFromBuffer(buffer: ArrayBuffer): DecodeBinaryResult | null {
	const bytes = new Uint8Array(buffer);

	const protoPayload = decodeQuotePayload(bytes);
	if (protoPayload) {
		return {
			tick: {
				symbol: protoPayload.symbol,
				price: protoPayload.price,
				changePct: protoPayload.changePct,
				ts: protoPayload.ts,
				source: 'ws-protobuf',
				transport: 'ws-protobuf'
			},
			decodedBy: 'protobuf'
		};
	}

	const legacy = decodeCustomBinaryFrame(bytes);
	if (!legacy) return null;

	return {
		tick: legacy,
		decodedBy: 'legacy-binary'
	};
}

async function decodeBinaryTick(data: ArrayBuffer | Blob): Promise<DecodeBinaryResult | null> {
	if (data instanceof ArrayBuffer) {
		return decodeBinaryTickFromBuffer(data);
	}

	const buffer = await data.arrayBuffer();
	return decodeBinaryTickFromBuffer(buffer);
}

function normalizeSymbols(symbols: string[]): string[] {
	const unique = new Set<string>();
	for (const raw of symbols) {
		const symbol = raw.trim();
		if (!symbol) continue;
		unique.add(symbol);
	}
	return [...unique];
}

export function useQuoteWebSocket(options: UseQuoteWebSocketOptions = {}) {
	const url = options.url ?? '/ws/quote';
	const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;
	const allowJsonTickFallback = options.allowJsonTickFallback ?? false;

	const BASE_DELAY_MS = options.baseDelayMs ?? 400;
	const MAX_DELAY_MS = options.maxDelayMs ?? 60_000;
	const JITTER_FACTOR = options.jitterFactor ?? 0.9;
	const MAX_RETRIES = options.maxRetries ?? 25;
	const INITIAL_JITTER_RANGE_MS = options.initialJitterRangeMs ?? 1200;
	const RECONNECT_FAST_LANE_MS = options.reconnectFastLaneMs ?? 40;
	const RECONNECT_SECOND_LANE_MS = 180;
	const RECONNECT_THIRD_LANE_MS = 420;
	const BACKOFF_MULTIPLIER = 2.4;
	const MIN_RECONNECT_GAP_MS = 200;

	let socket: WebSocket | null = null;
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectAttempt = 0;
	let reconnectStartedAt: number | null = null;
	let manualClose = false;
	let consecutiveErrors = 0;
	let lastReconnectTime = 0;

	const subscribedSymbols = new Set<string>();
	const tickHandlers = new Set<(tick: QuoteTick) => void>();
	const statsHandlers = new Set<(stats: QuoteSocketStats) => void>();

	const pendingRecoverySymbols = new Set<string>();
	let lastResyncRequestSymbols: string[] = [];

	const stats: QuoteSocketStats = {
		status: 'idle',
		reconnectCount: 0,
		lastReconnectDurationMs: null,
		binaryFrames: 0,
		fallbackFrames: 0,
		protobufDecodeSuccess: 0,
		recovering: false,
		pendingRecoverySymbols: []
	};

	const emitStats = () => {
		const snapshot: QuoteSocketStats = {
			status: stats.status,
			reconnectCount: stats.reconnectCount,
			lastReconnectDurationMs: stats.lastReconnectDurationMs,
			binaryFrames: stats.binaryFrames,
			fallbackFrames: stats.fallbackFrames,
			protobufDecodeSuccess: stats.protobufDecodeSuccess,
			recovering: stats.recovering,
			pendingRecoverySymbols: [...stats.pendingRecoverySymbols]
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

	const updateRecoveryState = (recoveringSymbols: Iterable<string>) => {
		pendingRecoverySymbols.clear();
		for (const symbol of recoveringSymbols) {
			pendingRecoverySymbols.add(symbol);
		}

		stats.pendingRecoverySymbols = [...pendingRecoverySymbols];
		stats.recovering = stats.pendingRecoverySymbols.length > 0;
		emitStats();
	};

	const markRecoveredBySymbol = (symbol: string) => {
		if (!pendingRecoverySymbols.has(symbol)) return;
		pendingRecoverySymbols.delete(symbol);
		stats.pendingRecoverySymbols = [...pendingRecoverySymbols];
		stats.recovering = stats.pendingRecoverySymbols.length > 0;
		emitStats();
	};

	const dispatchTickAndRecover = (tick: QuoteTick) => {
		markRecoveredBySymbol(tick.symbol);
		emitTick(tick);
	};

	const requestResync = (symbols: string[]) => {
		const next = normalizeSymbols(symbols);
		lastResyncRequestSymbols = next;
		if (!next.length) {
			updateRecoveryState([]);
			return;
		}

		send({ type: 'resync', symbols: next, clientSentAtMs: Date.now() });
	};

	const flushSubscriptions = () => {
		requestResync([...subscribedSymbols]);
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

	const getNextReconnectDelay = () => {
		if (reconnectAttempt >= MAX_RETRIES) {
			return Number.POSITIVE_INFINITY;
		}

		let delay = BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, reconnectAttempt);

		if (consecutiveErrors >= 2) {
			delay *= Math.pow(1.8, consecutiveErrors - 1);
		}

		delay = Math.min(delay, MAX_DELAY_MS);

		const jitter = delay * JITTER_FACTOR * (Math.random() * 2 - 1);
		delay += jitter;

		if (reconnectAttempt === 0) {
			delay += Math.random() * INITIAL_JITTER_RANGE_MS;
		}

		const now = Date.now();
		if (now - lastReconnectTime < MIN_RECONNECT_GAP_MS) {
			delay += MIN_RECONNECT_GAP_MS - (now - lastReconnectTime);
		}

		return Math.max(150, Math.round(delay));
	};

	const resetReconnectState = () => {
		if (reconnectStartedAt !== null) {
			stats.reconnectCount += 1;
			stats.lastReconnectDurationMs = Date.now() - reconnectStartedAt;
			emitStats();
		}

		reconnectAttempt = 0;
		reconnectStartedAt = null;
	};

	const scheduleReconnect = (closeCode?: number, isWsError = false) => {
		if (manualClose) return;
		if (reconnectTimer) return;

		reconnectAttempt += 1;

		if (isWsError) {
			consecutiveErrors += 1;
		} else {
			consecutiveErrors = 0;
		}

		let delay = getNextReconnectDelay();

		if (reconnectAttempt === 1) {
			delay = Math.min(delay, Math.max(0, RECONNECT_FAST_LANE_MS));
		} else if (reconnectAttempt === 2) {
			delay = Math.min(delay, RECONNECT_SECOND_LANE_MS);
		} else if (reconnectAttempt === 3) {
			delay = Math.min(delay, RECONNECT_THIRD_LANE_MS);
		}

		if (isWsError && reconnectAttempt === 1) {
			delay = Math.min(delay, Math.random() * 300);
		}

		if (!Number.isFinite(delay)) {
			updateStatus('failed');
			console.warn('[ws] max reconnect attempts reached');
			return;
		}

		if (reconnectStartedAt === null) {
			reconnectStartedAt = Date.now();
		}

		updateStatus('reconnecting');
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			lastReconnectTime = Date.now();
			connect();
		}, delay);
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

			if (isResyncAckMessage(payload)) {
				if (Array.isArray(payload.immediateData) && payload.immediateData.length > 0) {
					for (const rawTick of payload.immediateData) {
						const tick = normalizeTick(rawTick, 'ws-json-fallback');
						if (tick) {
							dispatchTickAndRecover(tick);
						}
					}
				}

				const ackSymbols = normalizeSymbols(payload.symbols ?? []);
				const recoveringSymbols = ackSymbols.length ? ackSymbols : lastResyncRequestSymbols;
				if (payload.pending === false && recoveringSymbols.length === 0) {
					updateRecoveryState([]);
				} else {
					updateRecoveryState(recoveringSymbols);
				}
				return;
			}

			if (payload.type === 'resynced' && !stats.recovering && lastResyncRequestSymbols.length) {
				// 兼容旧服务端：没有 ack 时，仍用最近一次 resync 请求进入 recovering
				updateRecoveryState(lastResyncRequestSymbols);
				return;
			}

			if (payload.type === 'tick' && 'data' in payload) {
				stats.fallbackFrames += 1;
				emitStats();

				if (allowJsonTickFallback) {
					const tick = normalizeTick(payload.data, 'ws-json-fallback');
					if (tick) {
						dispatchTickAndRecover(tick);
					}
				}
			}
			return;
		}

		if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
			stats.binaryFrames += 1;

			const decoded =
				stats.recovering && event.data instanceof ArrayBuffer
					? decodeBinaryTickFromBuffer(event.data)
					: await decodeBinaryTick(event.data);
			if (decoded?.decodedBy === 'protobuf') {
				stats.protobufDecodeSuccess += 1;
			}
			emitStats();
			if (decoded) {
				dispatchTickAndRecover(decoded.tick);
			}
		}
	};

	const attachSocket = (ws: WebSocket) => {
		ws.binaryType = 'arraybuffer';
		ws.addEventListener('open', () => {
			clearReconnectTimer();
			resetReconnectState();
			consecutiveErrors = 0;
			flushSubscriptions();
			updateStatus('open');
			startHeartbeat();
		});
		ws.addEventListener('message', (event) => {
			void onMessage(event);
		});
		ws.addEventListener('error', () => {
			stopHeartbeat();
			updateStatus('error');
			scheduleReconnect(undefined, true);
		});
		ws.addEventListener('close', (event) => {
			stopHeartbeat();
			socket = null;
			if (manualClose) {
				updateStatus('closed');
				return;
			}

			scheduleReconnect(event.code);
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
		const nextSymbols = normalizeSymbols(symbols);

		subscribedSymbols.clear();
		for (const symbol of nextSymbols) {
			subscribedSymbols.add(symbol);
		}

		requestResync(nextSymbols);
	};

	const unsubscribe = (symbols: string[]) => {
		const removed = normalizeSymbols(symbols);
		for (const symbol of removed) {
			subscribedSymbols.delete(symbol);
		}

		requestResync([...subscribedSymbols]);
	};

	const close = () => {
		manualClose = true;
		stopHeartbeat();
		clearReconnectTimer();
		reconnectAttempt = 0;
		reconnectStartedAt = null;
		updateRecoveryState([]);
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
