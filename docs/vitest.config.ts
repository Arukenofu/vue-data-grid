import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

import { aliases, devFlag, icons } from './.vitepress/aliases.ts';

export default defineConfig({
	plugins: [vue(), icons(), devFlag()],
	resolve: { alias: aliases },
	test: {
		name: 'docs',
		environment: 'happy-dom',
		include: ['tests/**/*.spec.ts'],
	},
});
