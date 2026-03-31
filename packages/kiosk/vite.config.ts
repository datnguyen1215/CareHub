import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 9393,
		proxy: {
			'/api': 'http://localhost:9391',
			'/ws': {
				target: 'ws://localhost:9391',
				ws: true
			}
		}
	},
	optimizeDeps: {
		include: ['@carehub/shared']
	},
	ssr: {
		noExternal: ['@carehub/shared']
	}
});
