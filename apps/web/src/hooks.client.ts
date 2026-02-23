export function init() {
	if (!import.meta.env.DEV) return;
	if (import.meta.env.PUBLIC_ENABLE_MSW !== 'true') return;

	queueMicrotask(async () => {
		const { worker } = await import('$lib/mocks/browser');
		await worker.start({ onUnhandledRequest: 'bypass' });
	});
}
