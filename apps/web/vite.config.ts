import { sveltekit } from '@sveltejs/kit/vite';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { FINANCE_THEME } from './src/lib/theme/tokens';

export default defineConfig({
	base: '/',
	plugins: [
		UnoCSS({ inspector: false }),
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			injectRegister: null,
			manifest: {
				id: '/',
				name: '西瓜说股 v3.0',
				short_name: '西瓜说股',
				description: '西瓜说股 v3.0：市场总览与个股详情原型',
				start_url: '/market',
				scope: '/',
				display: 'standalone',
				theme_color: FINANCE_THEME.accent.indigo,
				background_color: FINANCE_THEME.dark.bgBase,
				icons: [
					{
						src: '/favicon.svg',
						type: 'image/svg+xml',
						sizes: 'any',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				cleanupOutdatedCaches: true,
				clientsClaim: true,
				skipWaiting: true,
				globPatterns: ['**/*.{js,css,svg,png,jpg,jpeg,webp,woff2,json,txt}'],
				additionalManifestEntries: [
					{ url: '/market', revision: 'p1.4-b-route-market' },
					{ url: '/detail', revision: 'p1.4-b-route-detail' }
				],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'ext-fonts',
							expiration: {
								maxEntries: 8,
								maxAgeSeconds: 60 * 60 * 24 * 30
							}
						}
					},
					{
						urlPattern: ({ sameOrigin, url }) =>
							sameOrigin && /^\/theme-(light|dark)\.css$/.test(url.pathname),
						handler: 'CacheFirst',
						options: {
							cacheName: 'theme-style-v1',
							matchOptions: {
								ignoreSearch: true
							},
							expiration: {
								maxEntries: 4,
								maxAgeSeconds: 60 * 60 * 24 * 30
							}
						}
					},
					{
						urlPattern: ({ request, sameOrigin }) =>
							sameOrigin && ['style', 'script', 'worker'].includes(request.destination),
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'app-static-assets',
							expiration: {
								maxEntries: 80,
								maxAgeSeconds: 60 * 60 * 24 * 7
							}
						}
					},
					{
						urlPattern: ({ request, sameOrigin }) =>
							sameOrigin && ['image', 'font'].includes(request.destination),
						handler: 'CacheFirst',
						options: {
							cacheName: 'app-static-media',
							expiration: {
								maxEntries: 60,
								maxAgeSeconds: 60 * 60 * 24 * 30
							}
						}
					},
					{
						urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname === '/v3/universe',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'mock-universe',
							networkTimeoutSeconds: 2,
							expiration: {
								maxEntries: 1,
								maxAgeSeconds: 60 * 30
							}
						}
					},
					{
						urlPattern: ({ sameOrigin, url }) =>
							sameOrigin && /\/v3\/(quote|realtime|ws)/.test(url.pathname),
						handler: 'NetworkOnly'
					},
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'app-shell-pages',
							networkTimeoutSeconds: 2,
							expiration: {
								maxEntries: 12,
								maxAgeSeconds: 60 * 60 * 12
							}
						}
					}
				]
			}
		})
	],
	optimizeDeps: {
		noDiscovery: true,
		include: [],
		holdUntilCrawlEnd: false
	}
});
