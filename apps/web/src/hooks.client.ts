export async function init() {
	if (!import.meta.env.DEV) return;
	const { worker } = await import('$lib/mocks/browser');
	await worker.start({ onUnhandledRequest: 'bypass' });
}
