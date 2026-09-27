import { defineComponent, type ShallowRef, shallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ColumnPinSide, RenderedColumn } from '../../src/columns/column';
import { useScrollViewport } from '../../src/virtual/use-scroll-viewport';
import { useVirtualColumns, type VirtualColumnsOptions } from '../../src/virtual/use-virtual-columns';
import { createScroller, type Scroller, stubResizeObserver } from '../support/dom';

type ColumnWindow = ReturnType<typeof useVirtualColumns>;

interface Setup {
	window: ColumnWindow;
	columns: ShallowRef<readonly RenderedColumn[]>;
	scroller: Scroller;
	unmount: () => void;
}

function column(name: string, index: number, pin?: ColumnPinSide): RenderedColumn {
	return {
		column: { name } as RenderedColumn['column'],
		key: name,
		index,
		pin,
		cellProps: {},
		headerProps: {},
	};
}

/** Twenty columns of 100px; the first two pinned to the start and the last one to the end. */
function createColumns() {
	return Array.from({ length: 20 }, (_, index) => {
		const pin = index < 2 ? 'start' : index === 19 ? 'end' : undefined;

		return column(`c${index}`, index, pin);
	});
}

function setup(options: Partial<Omit<VirtualColumnsOptions, 'viewport' | 'columns'>> = {}): Setup {
	const root = shallowRef<HTMLElement | null>(null);
	const columns = shallowRef<readonly RenderedColumn[]>(createColumns());
	const scroller = createScroller({ width: 500, height: 400 });
	let window: ColumnWindow | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			window = useVirtualColumns({
				viewport: useScrollViewport(root),
				columns: () => columns.value,
				enabled: () => true,
				getWidth: () => 100,
				inset: () => 0,
				bufferPx: () => 0,
				keep: () => [],
				...options,
			});

			return () => null;
		},
	}));

	root.value = scroller;

	return { window: window as unknown as ColumnWindow, columns, scroller, unmount: () => wrapper.unmount() };
}

let current: Setup | null = null;

beforeEach(stubResizeObserver);

afterEach(() => {
	current?.unmount();
	current = null;
	vi.unstubAllGlobals();
});

describe('useVirtualColumns', () => {
	it('covers the scrolling columns in the viewport, after the start-pinned ones', () => {
		current = setup();

		/** The scrolling part starts at 200px; a 500px viewport at scroll 0 reaches 300px into it. */
		expect(current.window.range.value).toEqual({ start: 2, end: 5 });
	});

	it('follows horizontal scrolling', () => {
		current = setup();
		current.scroller.scrollToPosition({ left: 1000 });

		expect(current.window.range.value).toEqual({ start: 10, end: 15 });
	});

	it('widens the window by `bufferPx` on each side', () => {
		current = setup({ bufferPx: () => 150 });
		current.scroller.scrollToPosition({ left: 1000 });

		expect(current.window.range.value).toEqual({ start: 8, end: 17 });
	});

	it('the start inset moves the scrolling part like pinned columns do', () => {
		current = setup({ inset: () => 100 });
		current.scroller.scrollToPosition({ left: 1000 });

		expect(current.window.range.value).toEqual({ start: 9, end: 14 });
	});

	it('stretches the window to a kept column rather than rendering it alone', () => {
		current = setup({ keep: () => ['c17'] });

		expect(current.window.range.value).toEqual({ start: 2, end: 18 });
	});

	it('ignores kept pinned columns: they are always rendered', () => {
		current = setup({ keep: () => ['c0', 'c19'] });

		expect(current.window.range.value).toEqual({ start: 2, end: 5 });
	});

	it('a scroll frame that keeps the same columns returns the same range', () => {
		current = setup();
		current.scroller.scrollToPosition({ left: 1050 });

		const before = current.window.range.value;

		current.scroller.scrollToPosition({ left: 1060 });
		expect(current.window.range.value).toEqual({ start: 10, end: 16 });
		expect(current.window.range.value).toBe(before);
	});

	it('vertical scrolling does not recompute the window', () => {
		current = setup();

		const before = current.window.range.value;

		current.scroller.scrollToPosition({ top: 5000 });
		expect(current.window.range.value).toBe(before);
	});

	it('gives no range when disabled or when every column is pinned', () => {
		current = setup({ enabled: () => false });
		expect(current.window.range.value).toBeNull();
		current.unmount();

		current = setup();
		current.columns.value = [column('a', 0, 'start'), column('b', 1, 'end')];
		expect(current.window.range.value).toBeNull();
	});
});
