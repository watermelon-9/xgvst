import { sveltekit } from '@sveltejs/kit/vite';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	base: '/',
	plugins: [UnoCSS({ inspector: false }), sveltekit()],
	optimizeDeps: {
		noDiscovery: true,
		include: [],
		holdUntilCrawlEnd: false
	}
});
