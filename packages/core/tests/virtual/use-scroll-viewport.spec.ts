import { defineComponent, shallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ScrollViewport, useScrollViewport } from '../../src/virtual/use-scroll-viewport';
import { createScroller, FakeResizeObserver, stubResizeObserver } from '../support/dom';

function setup() {
	const root = shallowRef<HTMLElement | null>(null);
	let viewport: ScrollViewport | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			viewport = useScrollViewport(root);

			return () => null;
		},
	}));

	return { root, viewport: viewport as unknown as ScrollViewport, unmount: () => wrapper.unmount() };
}

beforeEach(stubResizeObserver);

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('useScrollViewport', () => {
	it('reads the scroll position and the visible size as soon as the root appears', () => {
		const { root, viewport, unmount } = setup();
		const scroller = createScroller({ width: 800, height: 400 });

		scroller.scrollTop = 120;
		scroller.scrollLeft = 30;
		root.value = scroller;

		expect(viewport.element.value).toBe(scroller);
		expect([viewport.scrollTop.value, viewport.scrollInline.value]).toEqual([120, 30]);
		expect([viewport.width.value, viewport.height.value]).toEqual([800, 400]);
		unmount();
	});

	it('follows scrolling on both axes', () => {
		const { root, viewport, unmount } = setup();
		const scroller = createScroller({ width: 800, height: 400 });

		root.value = scroller;
		scroller.scrollToPosition({ top: 500, left: 70 });

		expect([viewport.scrollTop.value, viewport.scrollInline.value]).toEqual([500, 70]);
		unmount();
	});

	it('follows the size of the root through a `ResizeObserver`', () => {
		const { root, viewport, unmount } = setup();
		const scroller = createScroller({ width: 800, height: 400 });

		root.value = scroller;
		scroller.resize({ width: 600, height: 300 });
		FakeResizeObserver.notifyAll();

		expect([viewport.width.value, viewport.height.value]).toEqual([600, 300]);
		unmount();
	});

	it('stops listening to a root that was replaced', () => {
		const { root, viewport, unmount } = setup();
		const first = createScroller({ height: 400 });
		const second = createScroller({ height: 400 });

		root.value = first;
		root.value = second;
		first.scrollToPosition({ top: 900 });

		expect(viewport.scrollTop.value).toBe(0);
		expect(FakeResizeObserver.instances[0].observed.size).toBe(0);
		unmount();
	});

	it('stops listening on unmount', () => {
		const { root, viewport, unmount } = setup();
		const scroller = createScroller({ height: 400 });

		root.value = scroller;
		unmount();
		scroller.scrollToPosition({ top: 900 });

		expect(viewport.scrollTop.value).toBe(0);
	});

	it('does not expose a root assigned before mount until the component is mounted', () => {
		const root = shallowRef<HTMLElement | null>(createScroller({ height: 400 }));
		const seen: (HTMLElement | null)[] = [];

		const wrapper = mount(defineComponent({
			setup() {
				const viewport = useScrollViewport(root);

				seen.push(viewport.element.value);

				return () => null;
			},
		}));

		expect(seen).toEqual([null]);
		wrapper.unmount();
	});
});

describe('useScrollViewport — right to left', () => {
	it('`scrollInline` is the distance from the inline start, even where `scrollLeft` is negative', () => {
		const { root, viewport, unmount } = setup();
		const scroller = createScroller({ width: 300, height: 200 });

		root.value = scroller;
		scroller.scrollToPosition({ left: -120 });

		expect(viewport.scrollInline.value).toBe(120);
		unmount();
	});
});
