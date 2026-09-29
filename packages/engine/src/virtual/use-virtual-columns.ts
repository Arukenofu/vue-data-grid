import { computed } from 'vue';

import type { RenderedColumn } from '../columns/column';
import { stableComputed } from '../shared/stable-computed';
import type { ColumnRange } from './column-window';
import { createItemMetrics, isSameRange, resolveVisibleRange } from './item-metrics';
import type { ScrollViewport } from './use-scroll-viewport';

const NO_RANGE: ColumnRange = Object.freeze({ start: 0, end: 0 });

export interface VirtualColumnsOptions {
	viewport: ScrollViewport;
	/** Shown columns in display order, pinned ones included. */
	columns: () => readonly RenderedColumn[];
	enabled: () => boolean;
	getWidth: (name: string) => number;
	/** Width of the service columns at the start edge: the scrolling part begins after them. */
	inset: () => number;
	/** Extra width rendered past each edge of the viewport, in pixels rather than columns: widths differ. */
	bufferPx: () => number;
	/** Columns that must stay rendered: under a gesture, under focus. */
	keep: () => readonly string[];
}

/**
 * The column window over the scrolling part of the row. Pinned columns are never windowed: their
 * width, together with the start inset, is where the scrolling part begins. The window is always a
 * contiguous slice, so a kept column stretches it rather than being rendered on its own.
 * `visibleRange` is the scrolling columns in view between the pinned ones, at least partly, whether
 * the window is on or not; `scrollingRange` is all the scrolling columns.
 */
export function useVirtualColumns(options: VirtualColumnsOptions) {
	const { viewport } = options;

	const scrolling = computed(() => {
		const columns = options.columns();
		let start = 0;
		let end = columns.length;

		while (start < columns.length && columns[start].pin === 'start') {
			start += 1;
		}

		while (end > start && columns[end - 1].pin === 'end') {
			end -= 1;
		}

		return { start, end, items: columns.slice(start, end) };
	});

	function sumWidths(columns: readonly RenderedColumn[]) {
		let result = 0;

		for (const column of columns) {
			result += options.getWidth(column.column?.name ?? '');
		}

		return result;
	}

	const scrollingRange = stableComputed<ColumnRange>(NO_RANGE, (previous) => {
		const next = { start: scrolling.value.start, end: scrolling.value.end };

		return isSameRange(previous, next) ? previous : next;
	});

	const margin = computed(() => options.inset() + sumWidths(options.columns().slice(0, scrolling.value.start)));

	// The pinned columns at the end cover the viewport from its end edge.
	const marginEnd = computed(() => sumWidths(options.columns().slice(scrolling.value.end)));

	const metrics = computed(() => {
		const { items } = scrolling.value;

		return createItemMetrics(items.length, index => options.getWidth(items[index].column?.name ?? ''));
	});

	const range = stableComputed<ColumnRange | null>(null, (previous) => {
		if (!options.enabled() || !viewport.element.value || scrolling.value.items.length === 0) {
			return null;
		}

		const buffer = options.bufferPx();
		const visible = resolveVisibleRange(
			metrics.value,
			viewport.scrollInline.value - margin.value - buffer,
			viewport.width.value + buffer * 2,
		);
		let { start, end } = visible;

		for (const name of options.keep()) {
			const index = scrolling.value.items.findIndex(item => item.column?.name === name);

			if (index !== -1) {
				start = Math.min(start, index);
				end = Math.max(end, index + 1);
			}
		}

		const offset = scrolling.value.start;
		const next = { start: offset + start, end: offset + end };

		return isSameRange(previous, next) ? previous : next;
	});

	// Scrolling columns start after the start margin, so in their coordinates the uncovered part starts
	// at the scroll position, as rows do below the sticky top.
	const visibleRange = stableComputed<ColumnRange>(NO_RANGE, (previous) => {
		const width = Math.max(viewport.width.value - margin.value - marginEnd.value, 0);

		if (!viewport.element.value || width === 0 || scrolling.value.items.length === 0) {
			return NO_RANGE;
		}

		const visible = resolveVisibleRange(metrics.value, viewport.scrollInline.value, width);
		const offset = scrolling.value.start;
		const next = { start: offset + visible.start, end: offset + visible.end };

		return isSameRange(previous, next) ? previous : next;
	});

	return { range, visibleRange, scrollingRange };
}
