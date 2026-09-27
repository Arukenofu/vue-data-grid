import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: ['packages/*', 'packages/table/vitest.browser.config.ts', 'docs'],
	},
});
