import { defineConfig } from 'vitest/config';

import pkg from './package.json' with { type: 'json' };

const manifest: { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> } = pkg;
const external = [...Object.keys(manifest.peerDependencies ?? {}), ...Object.keys(manifest.dependencies ?? {})];

export default defineConfig({
	define: {
		__DEV__: 'process.env.NODE_ENV !== \'production\'',
	},
	build: {
		lib: {
			entry: {
				index: 'src/index.ts',
				internals: 'src/internals.ts',
			},
			formats: ['es'],
		},
		minify: false,
		sourcemap: true,
		rolldownOptions: {
			external: id => external.some(name => id === name || id.startsWith(`${name}/`)),
			output: {
				preserveModules: true,
				preserveModulesRoot: 'src',
			},
		},
	},
	test: {
		name: 'engine',
		environment: 'happy-dom',
		include: ['tests/**/*.spec.ts'],
	},
});
