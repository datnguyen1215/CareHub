import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 9390,
		proxy: {
			'/api': 'http://localhost:9391'
		}
	}
});
