import { defineComponent, nextTick, type ShallowRef, shallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScrollViewport } from '../../src/virtual/use-scroll-viewport';
import { useVirtualRows, type VirtualRowsOptions } from '../../src/virtual/use-virtual-rows';
import { createScroller, FakeResizeObserver, type Scroller, stubResizeObserver } from '../support/dom';

type RowWindow = ReturnType<typeof useVirtualRows>;

interface Setup {
	window: RowWindow;
	keys: ShallowRef<string[]>;
	scroller: Scroller;
	attach: () => void;
	unmount: () => void;
}

function range(count: number, prefix = 'r') {
	return Array.from({ length: count }, (_, index) => `${prefix}${index}`);
}

function setup(options: Partial<Omit<VirtualRowsOptions, 'viewport'>> = {}, count = 1000): Setup {
	const root = shallowRef<HTMLElement | null>(null);
	const keys = shallowRef(range(count));
	const scroller = createScroller({ width: 800, height: 360 });
	let window: RowWindow | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			window = useVirtualRows({
				viewport: useScrollViewport(root),
				count: () => keys.value.length,
				enabled: () => true,
				overscan: () => 0,
				scrollMargin: () => 0,
				scrollMarginEnd: () => 0,
				estimateSize: () => 36,
				uniformSize: () => 36,
				measured: () => false,
				getItemKey: index => keys.value[index] ?? String(index),
				keep: () => [],
				ssrCount: () => 5,
				indexAttribute: 'data-dg-index',
				...options,
			});

			return () => null;
		},
	}));

	return {
		window: window as unknown as RowWindow,
		keys,
		scroller,
		attach: () => {
			root.value = scroller;
		},
		unmount: () => wrapper.unmount(),
	};
}

function indexes(window: RowWindow) {
	return window.items.value.map(item => item.index);
}

let current: Setup | null = null;

beforeEach(stubResizeObserver);

afterEach(() => {
	current?.unmount();
	current = null;
	vi.unstubAllGlobals();
});

describe('useVirtualRows — before the root is mounted', () => {
	it('renders the first `ssrCount` rows', () => {
		current = setup();

		expect(indexes(current.window)).toEqual([0, 1, 2, 3, 4]);
	});

	it('already knows the full height', () => {
		current = setup();

		expect(current.window.totalSize.value).toBe(36_000);
	});
});

describe('useVirtualRows — window', () => {
	it('renders the rows in the viewport once the root is attached', () => {
		current = setup();
		current.attach();

		expect(indexes(current.window)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it('follows scrolling', () => {
		current = setup();
		current.attach();
		current.scroller.scrollToPosition({ top: 3600 });

		expect(indexes(current.window)).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
	});

	it('adds `overscan` rows past each edge', () => {
		current = setup({ overscan: () => 3 });
		current.attach();
		current.scroller.scrollToPosition({ top: 3600 });

		expect(indexes(current.window)).toEqual([97, 98, 99, ...range(10).map((_, index) => 100 + index), 110, 111, 112]);
	});

	it('positions include `scrollMargin`, and the body starts below it', () => {
		current = setup({ scrollMargin: () => 40 });
		current.attach();

		expect(current.window.items.value[0]).toEqual({ key: 'r0', index: 0, start: 40, end: 76, size: 36 });

		current.scroller.scrollToPosition({ top: 40 + 3600 });
		expect(indexes(current.window)[0]).toBe(100);
	});

	it('a scroll frame that keeps the same rows returns the same items', () => {
		current = setup();
		current.attach();
		current.scroller.scrollToPosition({ top: 3600 });

		const before = current.window.items.value;

		current.scroller.scrollToPosition({ top: 3610 });
		expect(indexes(current.window)).toEqual(before.map(item => item.index).concat(110));

		current.scroller.scrollToPosition({ top: 3612 });
		const after = current.window.items.value;

		current.scroller.scrollToPosition({ top: 3614 });
		expect(current.window.items.value).toBe(after);
	});

	it('a kept row that moves inside the window leaves the items as they are', () => {
		const kept = shallowRef<readonly number[]>([3]);

		current = setup({ keep: () => kept.value });
		current.attach();

		const before = current.window.items.value;

		kept.value = [4];
		expect(current.window.items.value).toBe(before);

		kept.value = [500];
		expect(current.window.items.value.at(-1)?.index).toBe(500);
	});

	it('a new list with the same keys in the same places leaves the items as they are', () => {
		current = setup();
		current.attach();

		const before = current.window.items.value;

		current.keys.value = [...current.keys.value];
		expect(current.window.items.value).toBe(before);
	});

	it('a row that stays rendered through a scroll keeps its item', () => {
		current = setup();
		current.attach();

		const before = current.window.items.value;

		current.scroller.scrollToPosition({ top: 72 });

		const after = current.window.items.value;

		expect(after).not.toBe(before);
		expect(after[0]).toBe(before[2]);
		expect(after.at(-1)?.index).toBe(11);
	});

	it('keeps rows outside the window rendered', () => {
		current = setup({ keep: () => [500, 2] });
		current.attach();

		expect(indexes(current.window)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 500]);
		expect(current.window.items.value.at(-1)).toMatchObject({ index: 500, start: 18_000 });
	});

	it('renders every row with the window disabled', () => {
		current = setup({ enabled: () => false }, 50);
		current.attach();

		expect(indexes(current.window)).toHaveLength(50);
	});

	it('uses the height function when there is no single height', () => {
		current = setup({ uniformSize: () => null, estimateSize: index => (index % 2 === 0 ? 20 : 40) }, 10);
		current.attach();

		expect(current.window.totalSize.value).toBe(300);
		expect(current.window.items.value.slice(0, 3).map(item => item.start)).toEqual([0, 20, 60]);
	});
});

describe('useVirtualRows — rows in view', () => {
	it('are the rows between the sticky top and bottom, without overscan and kept rows', () => {
		current = setup({ overscan: () => 3, keep: () => [500], scrollMargin: () => 36, scrollMarginEnd: () => 36 });
		current.attach();
		current.scroller.scrollToPosition({ top: 3600 });

		expect(current.window.visibleRange.value).toEqual({ start: 100, end: 108 });
	});

	it('are none while the sticky blocks cover the whole viewport', () => {
		current = setup({ scrollMargin: () => 300, scrollMarginEnd: () => 300 });
		current.attach();
		current.scroller.scrollToPosition({ top: 3600 });

		expect(current.window.visibleRange.value).toEqual({ start: 0, end: 0 });
	});

	it('are none before mount, and keep their object while they hold', () => {
		current = setup();
		expect(current.window.visibleRange.value).toEqual({ start: 0, end: 0 });

		current.attach();
		current.scroller.scrollToPosition({ top: 3610 });

		const before = current.window.visibleRange.value;

		current.scroller.scrollToPosition({ top: 3612 });
		expect(current.window.visibleRange.value).toBe(before);
	});

	it('a page step is the rows that fit between the sticky edges', () => {
		current = setup({ scrollMargin: () => 36, scrollMarginEnd: () => 36 });
		expect(current.window.getPageStep(0, 'down')).toBe(1);

		current.attach();
		expect(current.window.getPageStep(0, 'down')).toBe(8);
		expect(current.window.getPageStep(50, 'up')).toBe(8);
	});
});

describe('useVirtualRows — measured rows', () => {
	function row(index: number) {
		const element = document.createElement('div');

		element.setAttribute('data-dg-index', String(index));
		document.body.append(element);

		return element;
	}

	afterEach(() => {
		document.body.innerHTML = '';
	});

	function observer() {
		return FakeResizeObserver.instances.at(-1) as FakeResizeObserver;
	}

	it('takes row heights from the DOM', async () => {
		current = setup({ measured: () => true, uniformSize: () => null });
		current.attach();

		const first = row(0);

		current.window.measureElement(first);
		observer().notify([[first, 100]]);
		await nextTick();

		expect(current.window.items.value[0].size).toBe(100);
		expect(current.window.items.value[1].start).toBe(100);
		expect(current.window.totalSize.value).toBe(36_000 - 36 + 100);
	});

	it('keeps a measured height with its row when rows are reordered', () => {
		current = setup({ measured: () => true, uniformSize: () => null }, 3);
		current.attach();

		const first = row(0);

		current.window.measureElement(first);
		observer().notify([[first, 100]]);
		current.keys.value = ['r1', 'r0', 'r2'];

		expect(current.window.items.value.map(item => item.size)).toEqual([36, 100, 36]);
	});

	it('forgets heights of rows that are gone once they outnumber the rows', () => {
		current = setup({ measured: () => true, uniformSize: () => null }, 3);
		current.attach();
		current.window.measureElement(row(0));
		observer().notify([[row(0), 100]]);
		current.keys.value = ['n0', 'n1', 'n2'];
		observer().notify([[row(0), 50], [row(1), 60], [row(2), 70]]);
		current.keys.value = ['r0', 'n1', 'n2'];

		expect(current.window.items.value.map(item => item.size)).toEqual([36, 60, 70]);
	});

	it('keeps heights of rows that are gone while they do not outnumber the rows', () => {
		current = setup({ measured: () => true, uniformSize: () => null }, 3);
		current.attach();
		current.window.measureElement(row(0));
		observer().notify([[row(0), 100]]);
		current.keys.value = ['n0', 'n1', 'n2'];
		observer().notify([[row(1), 60]]);
		current.keys.value = ['r0', 'n1', 'n2'];

		expect(current.window.items.value.map(item => item.size)).toEqual([100, 60, 36]);
	});

	it('a row measured at zero keeps its height: it is hidden, not empty', () => {
		current = setup({ measured: () => true, uniformSize: () => null });
		current.attach();

		const first = row(0);

		current.window.measureElement(first);
		observer().notify([[first, 100]]);
		observer().notify([[first, 0]]);

		expect(current.window.items.value[0].size).toBe(100);
	});

	it('a row above the viewport that changes height shifts the scroll by the same amount', () => {
		current = setup({ measured: () => true, uniformSize: () => null, keep: () => [2] });
		current.attach();
		current.scroller.scrollToPosition({ top: 3600 });

		const above = row(2);

		current.window.measureElement(above);
		observer().notify([[above, 136]]);

		expect(current.scroller.scrollTop).toBe(3700);
	});

	it('a row in view that changes height leaves the scroll alone', () => {
		current = setup({ measured: () => true, uniformSize: () => null });
		current.attach();
		current.scroller.scrollToPosition({ top: 3600 });

		const visible = row(101);

		current.window.measureElement(visible);
		observer().notify([[visible, 136]]);

		expect(current.scroller.scrollTop).toBe(3600);
	});

	it('stops observing a row that left the DOM', () => {
		current = setup({ measured: () => true, uniformSize: () => null });
		current.attach();

		const first = row(0);

		current.window.measureElement(first);
		first.remove();
		observer().notify([[first, 0]]);

		expect(observer().observed.has(first)).toBe(false);
	});

	it('observes nothing without `measured`', () => {
		current = setup();
		current.attach();
		current.window.measureElement(row(0));

		expect(FakeResizeObserver.instances.every(instance => ![...instance.observed].some(item => item.hasAttribute('data-dg-index'))))
			.toBe(true);
	});
});

describe('useVirtualRows — scrollToIndex', () => {
	it('puts the row at the start, below the sticky top', () => {
		current = setup({ scrollMargin: () => 40 });
		current.attach();
		current.window.scrollToIndex(100);

		expect(current.scroller.scrollTop).toBe(3600);
	});

	it('`auto` leaves a visible row alone and brings a far one to the bottom edge', () => {
		current = setup();
		current.attach();
		current.window.scrollToIndex(3, 'auto');
		expect(current.scroller.scrollTop).toBe(0);

		current.window.scrollToIndex(20, 'auto');
		expect(current.scroller.scrollTop).toBe(21 * 36 - 360);
	});

	it('keeps the row clear of the sticky bottom', () => {
		current = setup({ scrollMarginEnd: () => 50 });
		current.attach();

		current.window.scrollToIndex(20, 'auto');
		expect(current.scroller.scrollTop).toBe(21 * 36 - 360 + 50);

		current.window.scrollToIndex(100, 'end');
		expect(current.scroller.scrollTop).toBe(101 * 36 - 360 + 50);
	});

	it('`center` puts the row in the middle between the sticky top and bottom', () => {
		current = setup({ scrollMargin: () => 40, scrollMarginEnd: () => 60 });
		current.attach();
		current.window.scrollToIndex(100, 'center');

		const top = current.scroller.scrollTop + 40;
		const bottom = current.scroller.scrollTop + 360 - 60;

		expect((top + bottom) / 2).toBe(40 + 100 * 36 + 18);
	});

	it('does nothing before mount and for a row outside the list', () => {
		current = setup();
		current.window.scrollToIndex(10);
		current.attach();
		current.window.scrollToIndex(5000);

		expect(current.scroller.scrollTop).toBe(0);
	});

	it('with measured rows settles on the row once its neighbours are measured', () => {
		const frames: FrameRequestCallback[] = [];

		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
		vi.stubGlobal('cancelAnimationFrame', () => undefined);

		current = setup({ measured: () => true, uniformSize: () => null });
		current.attach();
		current.window.scrollToIndex(100);
		expect(current.scroller.scrollTop).toBe(3600);

		const element = document.createElement('div');

		element.setAttribute('data-dg-index', '10');
		document.body.append(element);
		current.window.measureElement(element);
		(FakeResizeObserver.instances.at(-1) as FakeResizeObserver).notify([[element, 136]]);
		frames.shift()?.(0);

		expect(current.scroller.scrollTop).toBe(3700);
		element.remove();
	});
});
