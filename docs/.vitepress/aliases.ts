import { fileURLToPath } from 'node:url';

import Icons from 'unplugin-icons/vite';
import type { Alias, Plugin } from 'vite';

function resolvePath(path: string) {
	return fileURLToPath(new URL(path, import.meta.url));
}

/**
 * The demos import the packages by their public names, as an app does, and get their sources: the
 * site and its tests need no build of the packages.
 */
export const aliases: Alias[] = [
	{ find: /^@vue-stack\/table\/drag-and-drop$/, replacement: resolvePath('../../packages/table/src/drag-and-drop.ts') },
	{ find: /^@vue-stack\/table\/style\.css$/, replacement: resolvePath('../../packages/table/src/style.css') },
	{ find: /^@vue-stack\/table$/, replacement: resolvePath('../../packages/table/src/index.ts') },
	{ find: /^@vue-stack\/table-core$/, replacement: resolvePath('../../packages/table-core/src/index.ts') },
	{ find: /^@vue-stack\/drag-and-drop$/, replacement: resolvePath('../../packages/drag-and-drop/src/index.ts') },
	{ find: /^@vue-stack\/flip$/, replacement: resolvePath('../../packages/flip/src/index.ts') },
	{ find: /^@\//, replacement: resolvePath('../') },
];

/** The packages check `__DEV__`, which their own build replaces: on in development, off in the built site. */
export function devFlag(): Plugin {
	return {
		name: 'vue-stack-dev-flag',
		config: (_config, { command }) => ({ define: { __DEV__: JSON.stringify(command === 'serve') } }),
	};
}

/**
 * Icons as components, `~icons/lucide/check`. The icon sets are dependencies of the docs, so they
 * are looked up from here, whichever folder the site or its tests run from.
 */
export function icons() {
	return Icons({ compiler: 'vue3', collectionsNodeResolvePath: resolvePath('../') });
}
