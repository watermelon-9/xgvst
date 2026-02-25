let initialized = false;

const resolveSwConfig = () => ({
	script: '/sw.js',
	scope: '/'
});

export function initPwa() {
	if (initialized || typeof window === 'undefined' || import.meta.env.DEV) return;
	initialized = true;

	const registerWhenIdle = () => {
		if (!('serviceWorker' in navigator)) return;
		const sw = resolveSwConfig();
		void navigator.serviceWorker.register(sw.script, { scope: sw.scope }).catch((error: unknown) => {
			console.error('[pwa] service worker register failed', error);
		});
	};

	if (document.readyState === 'complete') {
		(window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(cb, 1)))(registerWhenIdle);
		return;
	}

	window.addEventListener(
		'load',
		() => {
			(window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(cb, 1)))(
				registerWhenIdle
			);
		},
		{ once: true }
	);
}
