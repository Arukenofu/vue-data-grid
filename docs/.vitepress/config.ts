import { defineConfig, postcssIsolateStyles } from 'vitepress';

import { aliases, devFlag, icons } from './aliases.ts';
import { demoPlugin } from './demo-plugin.ts';
import { nav, sidebar } from './sidebar.ts';

export default defineConfig({
	title: 'Vue Data Grid',
	titleTemplate: ':title · Vue Data Grid',
	description: 'Headless, accessible and fast tables for Vue 3, assembled from small parts.',
	srcDir: 'content',
	cleanUrls: true,
	lastUpdated: false,
	head: [
		['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
		['meta', { name: 'theme-color', content: '#10b981' }],
		// Before the first paint: the home page hides what its entrance animates only when scripts run.
		['script', {}, 'document.documentElement.classList.add("js")'],
	],
	markdown: {
		theme: 'vitesse-dark',
		config: (md) => {
			md.use(demoPlugin);
		},
	},
	themeConfig: {
		logo: '/logo.svg',
		siteTitle: 'Vue Data Grid',
		nav,
		sidebar,
		outline: { level: [2, 3], label: 'On this page' },
		search: { provider: 'local' },
		docFooter: { prev: 'Previous', next: 'Next' },
		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Headless tables for Vue 3.',
		},
	},
	vite: {
		plugins: [icons(), devFlag()],
		resolve: { alias: aliases },
		css: { postcss: { plugins: [postcssIsolateStyles()] } },
		// The one chunk above the default limit is the index of the local search, loaded when the search opens.
		build: { chunkSizeWarningLimit: 800 },
	},
});
