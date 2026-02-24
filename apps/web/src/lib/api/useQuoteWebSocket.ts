export type QuoteTick = {
	symbol: string;
	price: number;
	changePct: number;
	ts: string;
	source: string;
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
			data: QuoteTick;
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
};

export function useQuoteWebSocket(options: UseQuoteWebSocketOptions = {}) {
	const url = options.url ?? '/ws/quote';
	const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;

	let socket: WebSocket | null = null;
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	const subscribedSymbols = new Set<string>();
	const tickHandlers = new Set<(tick: QuoteTick) => void>();

	const send = (payload: QuoteSocketCommand) => {
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		socket.send(JSON.stringify(payload));
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

	const onMessage = (event: MessageEvent) => {
		if (typeof event.data !== 'string') return;

		if (event.data === 'ping') {
			socket?.send('pong');
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

		if (payload.type === 'tick' && 'data' in payload) {
			for (const handler of tickHandlers) {
				handler(payload.data);
			}
		}
	};

	const attachSocket = (ws: WebSocket) => {
		ws.addEventListener('open', () => {
			flushSubscriptions();
			startHeartbeat();
		});
		ws.addEventListener('message', onMessage);
		ws.addEventListener('close', stopHeartbeat);
		ws.addEventListener('error', stopHeartbeat);
	};

	const connect = () => {
		if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
			return socket;
		}

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
		stopHeartbeat();
		if (socket && socket.readyState < WebSocket.CLOSING) {
			socket.close(1000, 'client closed');
		}
		socket = null;
	};

	const onTick = (handler: (tick: QuoteTick) => void) => {
		tickHandlers.add(handler);
		return () => {
			tickHandlers.delete(handler);
		};
	};

	return {
		connect,
		subscribe,
		unsubscribe,
		close,
		onTick
	};
}
