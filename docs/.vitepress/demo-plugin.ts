import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { MarkdownRenderer } from 'vitepress';

type StateCore = Parameters<Parameters<MarkdownRenderer['core']['ruler']['push']>[1]>[0];
type Token = StateCore['tokens'][number];

const DEMOS = fileURLToPath(new URL('../demos/', import.meta.url));

const DEMO_TAG = /^<Demo\s([^>]*?)\/>$/;

const NAME_ATTRIBUTE = /\bname="([\w-]+)"/;

const SOURCE_EXTENSION = /\.(vue|ts|css)$/;

const LANGUAGES: Readonly<Record<string, string>> = { vue: 'vue', ts: 'ts', css: 'css' };

function toComponentName(name: string) {
	return `Demo${name.replace(/(^|-)(\w)/g, (_match, _dash, letter: string) => letter.toUpperCase())}`;
}

/** The files of a demo, its `index.vue` first: what the Code tab shows. */
function readFiles(name: string) {
	const files = readdirSync(`${DEMOS}${name}`).filter(file => SOURCE_EXTENSION.test(file));

	return files.sort((first, second) => {
		if (first === 'index.vue') {
			return -1;
		}

		return second === 'index.vue' ? 1 : first.localeCompare(second);
	});
}

function html(state: StateCore, content: string) {
	const token = new state.Token('html_block', '', 0);

	token.content = content;

	return token;
}

function fence(state: StateCore, name: string, file: string) {
	const token = new state.Token('fence', 'code', 0);

	token.info = LANGUAGES[file.split('.').pop() ?? ''] ?? 'txt';
	// VitePress reads a fence with `meta.src` as a snippet, from the file, and watches the file.
	token.meta = { src: `${DEMOS}${name}/${file}` };

	return token;
}

function expandDemo(state: StateCore, attributes: string, name: string) {
	const files = readFiles(name);
	const tokens: Token[] = [
		html(state, `<Demo ${attributes} :files='${JSON.stringify(files)}'>\n<template #preview><${toComponentName(name)} /></template>\n`),
	];

	files.forEach((file, index) => {
		tokens.push(html(state, `<template #file-${index}>\n`), fence(state, name, file), html(state, '</template>\n'));
	});

	tokens.push(html(state, '</Demo>\n'));

	return tokens;
}

function addImports(state: StateCore, names: ReadonlySet<string>) {
	const imports = [...names].map(name => `import ${toComponentName(name)} from '@/demos/${name}/index.vue';`).join('\n');
	const script = state.tokens.find(token => token.type === 'html_block' && token.content.trimStart().startsWith('<script setup'));

	if (script) {
		script.content = script.content.replace('</script>', `${imports}\n</script>`);
	} else {
		state.tokens.unshift(html(state, `<script setup>\n${imports}\n</script>\n`));
	}
}

/**
 * `<Demo name="quick-start" />` on a line of its own: the live demo of `demos/quick-start` and the
 * highlighted source of each of its files, for the Preview and the Code of the `Demo` component.
 */
export function demoPlugin(md: MarkdownRenderer) {
	md.core.ruler.after('inline', 'vue-data-grid-demo', (state) => {
		const names = new Set<string>();

		state.tokens = state.tokens.flatMap((token) => {
			// A component alone on its line is an `html_inline` token of the block level in VitePress.
			const isHtml = token.type === 'html_block' || token.type === 'html_inline';
			const match = isHtml ? DEMO_TAG.exec(token.content.trim()) : null;
			const name = match ? NAME_ATTRIBUTE.exec(match[1])?.[1] : undefined;

			if (!match || !name) {
				return [token];
			}

			names.add(name);

			return expandDemo(state, match[1].trim(), name);
		});

		if (names.size > 0) {
			addImports(state, names);
		}
	});
}
