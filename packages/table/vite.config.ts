import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vitest/config';

import pkg from './package.json' with { type: 'json' };

const manifest: { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> } = pkg;
const external = [...Object.keys(manifest.peerDependencies ?? {}), ...Object.keys(manifest.dependencies ?? {})];

// The structural styles ship as `dist/style.css`, imported by the app on its own: the modules never
// import CSS, so the package stays free of side effects for scripts.
const styles: Plugin = {
	name: 'vue-stack-table-styles',
	apply: 'build',
	generateBundle() {
		this.emitFile({
			type: 'asset',
			fileName: 'style.css',
			source: readFileSync(new URL('src/style.css', import.meta.url), 'utf8'),
		});
	},
};

export default defineConfig(({ command }) => ({
	// Development-only code checks `__DEV__`: on in tests, which also run the sources of the core, and
	// left to the consumer's bundler in the build, as in the core.
	define: { __DEV__: command === 'serve' ? 'true' : 'process.env.NODE_ENV !== \'production\'' },
	plugins: [styles],
	resolve: {
		alias: command === 'serve'
			? [
				{
					find: /^@vue-stack\/table-core$/,
					replacement: fileURLToPath(new URL('../table-core/src/index.ts', import.meta.url)),
				},
				{
					find: /^@vue-stack\/flip$/,
					replacement: fileURLToPath(new URL('../flip/src/index.ts', import.meta.url)),
				},
				{
					find: /^@vue-stack\/drag-and-drop$/,
					replacement: fileURLToPath(new URL('../drag-and-drop/src/index.ts', import.meta.url)),
				},
			]
			: [],
	},
	build: {
		lib: {
			entry: { index: 'src/index.ts', 'drag-and-drop': 'src/drag-and-drop.ts' },
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
		name: 'table',
		environment: 'happy-dom',
		include: ['tests/**/*.spec.ts'],
		// They need layout: `vitest.browser.config.ts` runs them in Chromium.
		exclude: ['tests/**/*.browser.spec.ts'],
	},
}));
