let initialized = false;

export function initPwa() {
	if (initialized || typeof window === 'undefined' || import.meta.env.DEV) return;
	initialized = true;

	const registerWhenIdle = () => {
		void import('virtual:pwa-register').then(({ registerSW }) => {
			registerSW({
				immediate: false,
				onRegisterError(error) {
					console.error('[pwa] service worker register failed', error);
				}
			});
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
