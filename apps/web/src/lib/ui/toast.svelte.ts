type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
	id: number;
	message: string;
	tone: ToastTone;
	durationMs: number;
};

const DEFAULT_DURATION_MS = 5000;

const toastState = $state({
	items: [] as ToastItem[]
});

function removeToast(id: number) {
	toastState.items = toastState.items.filter((item) => item.id !== id);
}

function pushToast(message: string, tone: ToastTone = 'info', _durationMs = DEFAULT_DURATION_MS) {
	const id = Date.now() + Math.floor(Math.random() * 1000);
	const durationMs = DEFAULT_DURATION_MS;
	toastState.items = [...toastState.items, { id, message, tone, durationMs }];

	if (typeof window !== 'undefined') {
		window.setTimeout(() => removeToast(id), durationMs);
	}
}

export function useToast() {
	return {
		state: toastState,
		push: pushToast,
		success: (message: string, durationMs?: number) => pushToast(message, 'success', durationMs),
		error: (message: string, durationMs?: number) => pushToast(message, 'error', durationMs),
		info: (message: string, durationMs?: number) => pushToast(message, 'info', durationMs),
		remove: removeToast
	};
}
