import { defineConfig, presetUno } from 'unocss';

export default defineConfig({
	presets: [presetUno()],
	theme: {
		colors: {
			up: '#ef4444',
			down: '#22c55e',
			bgPurple: '#4f46e5'
		}
	}
});
