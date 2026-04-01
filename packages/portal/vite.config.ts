import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 9390,
		proxy: {
			'/api': 'http://localhost:9391',
			'/ws': {
				target: 'ws://localhost:9391',
				ws: true
			}
		}
	},
	ssr: {
		// Externalize @carehub/shared to avoid issues with commonjs re-exports
		noExternal: ['@carehub/shared']
	}
});
