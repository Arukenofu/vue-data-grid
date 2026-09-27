import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import pkg from './package.json' with { type: 'json' };

const manifest: { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> } = pkg;
const external = [...Object.keys(manifest.peerDependencies ?? {}), ...Object.keys(manifest.dependencies ?? {})];

export default defineConfig(({ command }) => ({
	// Tests run the sources of the packages it depends on; the build leaves them external.
	resolve: {
		alias: command === 'serve'
			? [{ find: /^@vue-stack\/flip$/, replacement: fileURLToPath(new URL('../flip/src/index.ts', import.meta.url)) }]
			: [],
	},
	build: {
		lib: {
			entry: { index: 'src/index.ts', vapor: 'src/vapor.ts' },
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
		name: 'drag-and-drop',
		environment: 'happy-dom',
		include: ['tests/**/*.spec.ts'],
	},
}));
