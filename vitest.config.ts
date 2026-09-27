import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: ['packages/*', 'packages/vue-data-grid/vitest.browser.config.ts', 'docs'],
	},
});
