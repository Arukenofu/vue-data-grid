import { defineConfig } from 'vitest/config';

export default defineConfig({
	build: {
		lib: {
			entry: { index: 'src/index.ts' },
			formats: ['es'],
		},
		minify: false,
		sourcemap: true,
		rolldownOptions: {
			output: {
				preserveModules: true,
				preserveModulesRoot: 'src',
			},
		},
	},
	test: {
		name: 'flip',
		environment: 'happy-dom',
		include: ['tests/**/*.spec.ts'],
	},
});
