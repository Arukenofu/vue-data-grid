import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';

const demos = import.meta.glob<{ default: Component }>('../demos/*/index.vue', { eager: true });

const CONTENT = resolve(import.meta.dirname, '../content');

const DEMO_TAG = /<Demo\s[^>]*\bname="([\w-]+)"/g;

function getName(path: string) {
	return path.split('/').at(-2) ?? path;
}

/** The names of the demos the pages of the site show. */
function readShownDemos() {
	const pages = readdirSync(CONTENT, { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.md'));

	return new Set(pages.flatMap(page => [...readFileSync(resolve(CONTENT, page), 'utf8').matchAll(DEMO_TAG)].map(match => match[1])));
}

describe('demos', () => {
	const warnings: string[] = [];

	beforeEach(() => {
		warnings.length = 0;
		vi.useFakeTimers();
		vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
			warnings.push(args.map(String).join(' '));
		});
		vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
			warnings.push(args.map(String).join(' '));
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	for (const [path, module] of Object.entries(demos)) {
		it(`mounts ${getName(path)} without a warning`, async () => {
			const wrapper = mount(module.default, {
				attachTo: document.body,
				global: { config: { warnHandler: message => warnings.push(message) } },
			});

			await flushPromises();
			vi.advanceTimersByTime(2000);
			await flushPromises();

			expect(wrapper.html()).not.toBe('');
			expect(warnings).toEqual([]);

			wrapper.unmount();
		});
	}

	it('shows every demo on a page of the site', () => {
		const shown = readShownDemos();
		const unused = Object.keys(demos).map(getName).filter(name => !shown.has(name));

		expect(unused).toEqual([]);
	});
});
