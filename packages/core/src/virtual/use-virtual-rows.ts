import { type ComponentPublicInstance, computed, onScopeDispose, shallowRef, triggerRef } from 'vue';

import { stableComputed } from '../shared/stable-computed';
import {
	collectIndexes,
	createItemMetrics,
	expandRange,
	isSameRange,
	type ItemMetrics,
	type ItemRange,
	type PageDirection,
	resolvePageStep,
	resolveVirtualItems,
	resolveVisibleRange,
	type VirtualItem,
} from './item-metrics';
import { resolveScrollPosition, type ScrollAlign } from './scroll';
import type { ScrollViewport } from './use-scroll-viewport';

export interface VirtualRowsOptions {
	viewport: ScrollViewport;
	count: () => number;
	enabled: () => boolean;
	/** Rows rendered past each edge of the viewport. */
	overscan: () => number;
	/** Height of the sticky top: the body starts below it, and scrolling to a row keeps it uncovered. */
	scrollMargin: () => number;
	/** Height of the sticky bottom (a footer, rows pinned there): scrolling to a row keeps it uncovered. */
	scrollMarginEnd: () => number;
	/** Height of the row, or its estimate until the row is measured. */
	estimateSize: (index: number) => number;
	/** One height for every row: positions are then arithmetic and the list is never walked. */
	uniformSize: () => number | null;
	/** Rows are measured in the DOM through `measureElement`. */
	measured: () => boolean;
	getItemKey: (index: number) => string;
	/** Keys of every item, shared with whoever else needs them; built from `getItemKey` without it. */
	getItemKeys?: () => readonly string[];
	/** Rows that must stay rendered: under a gesture, under focus. */
	keep: () => readonly number[];
	/** Rows rendered before the root is mounted: on the server and in the hydration frame. */
	ssrCount: () => number;
	/** Attribute with the row index that the markup puts on each row element. */
	indexAttribute: string;
}

const MAX_SCROLL_CORRECTIONS = 10;

const NO_ITEMS: readonly VirtualItem[] = [];

const NO_RANGE: ItemRange = Object.freeze({ start: 0, end: 0 });

type MeasureTarget = Element | ComponentPublicInstance | null;

function toElement(target: MeasureTarget) {
	const element: unknown = target instanceof Element ? target : target?.$el;

	return element instanceof HTMLElement ? element : null;
}

function getBlockSize(entry: ResizeObserverEntry) {
	return entry.borderBoxSize?.[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight;
}

/**
 * The row window. Rows intersecting the viewport plus `overscan` on each side are rendered, and so
 * are the kept ones; before the root is mounted the first `ssrCount` rows are, so the server and
 * the hydration frame render the same set.
 *
 * With `measured`, row heights come from a `ResizeObserver` and are stored by row key, so they
 * survive sorting and streaming. Heights of rows that are gone are dropped once stored heights
 * outnumber the rows. A row that changes height above the viewport shifts the scroll by the same
 * amount, so the rows in view stay in place.
 */
export function useVirtualRows(options: VirtualRowsOptions) {
	const { viewport } = options;

	// Mutated in place and triggered once per batch of measurements.
	const sizes = shallowRef(new Map<string, number>());

	const keys = computed<readonly string[] | null>(() => {
		if (!options.measured()) {
			return null;
		}

		if (options.getItemKeys) {
			return options.getItemKeys();
		}

		const result: string[] = [];

		for (let index = 0; index < options.count(); index += 1) {
			result.push(options.getItemKey(index));
		}

		return result;
	});

	const metrics = computed<ItemMetrics>(() => {
		const count = options.count();
		const uniform = options.uniformSize();
		const measuredKeys = keys.value;

		if (uniform !== null && !measuredKeys) {
			return createItemMetrics(count, uniform);
		}

		if (!measuredKeys) {
			return createItemMetrics(count, options.estimateSize);
		}

		const measured = sizes.value;

		return createItemMetrics(count, index => measured.get(measuredKeys[index]) ?? options.estimateSize(index));
	});

	const range = stableComputed<ItemRange | null>(null, (previous) => {
		if (!options.enabled() || !viewport.element.value) {
			return null;
		}

		const visible = resolveVisibleRange(
			metrics.value,
			viewport.scrollTop.value - options.scrollMargin(),
			viewport.height.value,
		);
		const next = expandRange(visible, options.overscan(), metrics.value.count);

		return isSameRange(previous, next) ? previous : next;
	});

	// The same array while the rendered rows, their keys, positions and sizes hold, and the same item
	// for a row that stays rendered: a kept row moving inside the window re-renders nothing.
	const items = stableComputed<readonly VirtualItem[]>(NO_ITEMS, (previous) => {
		const current = metrics.value;
		const { count } = current;
		let indexes: readonly number[];

		if (!options.enabled()) {
			indexes = collectIndexes({ start: 0, end: count }, [], count);
		} else if (!viewport.element.value) {
			indexes = collectIndexes({ start: 0, end: Math.min(count, options.ssrCount()) }, [], count);
		} else {
			indexes = collectIndexes(range.value ?? { start: 0, end: 0 }, options.keep(), count);
		}

		return resolveVirtualItems(indexes, current, options.getItemKey, options.scrollMargin(), previous);
	});

	const totalSize = computed(() => metrics.value.total);

	// The part of the viewport between the sticky top and bottom, where rows are in view.
	function getPageHeight() {
		return Math.max(viewport.height.value - options.scrollMargin() - options.scrollMarginEnd(), 0);
	}

	// Rows start below the sticky top, so in list coordinates the uncovered part starts at `scrollTop`.
	const visibleRange = stableComputed<ItemRange>(NO_RANGE, (previous) => {
		const height = getPageHeight();

		// `resolveVisibleRange` gives the nearest row to an empty page, for the window; none is in view.
		if (!viewport.element.value || height === 0) {
			return NO_RANGE;
		}

		const next = resolveVisibleRange(metrics.value, viewport.scrollTop.value, height);

		return isSameRange(previous, next) ? previous : next;
	});

	/** How many rows a page move from `index` passes, by their heights; at least one. */
	function getPageStep(index: number, direction: PageDirection) {
		return resolvePageStep(metrics.value, index, direction, viewport.element.value ? getPageHeight() : 0);
	}

	/** Offset of the row's top edge from the top of the first row; `getOffset(count)` is the total height. */
	function getOffset(index: number) {
		const current = metrics.value;

		return current.startOf(Math.min(Math.max(index, 0), current.count));
	}

	let observer: ResizeObserver | null = null;
	const observed = new WeakSet<Element>();

	function forgetGoneRows(count: number) {
		const present = new Set(keys.value ?? Array.from({ length: count }, (_, index) => options.getItemKey(index)));

		for (const key of sizes.value.keys()) {
			if (!present.has(key)) {
				sizes.value.delete(key);
			}
		}
	}

	function handleResize(entries: readonly ResizeObserverEntry[]) {
		const root = viewport.element.value;
		const current = metrics.value;
		const margin = options.scrollMargin();
		let changed = false;
		let shift = 0;

		for (const entry of entries) {
			const element = entry.target;

			if (!element.isConnected) {
				observer?.unobserve(element);
				observed.delete(element);
				continue;
			}

			const index = Number(element.getAttribute(options.indexAttribute));
			const size = getBlockSize(entry);

			// A row measured at zero is hidden along with the table, not empty: keep its height.
			if (!Number.isInteger(index) || index < 0 || index >= current.count || !(size > 0)) {
				continue;
			}

			const before = current.sizeOf(index);

			sizes.value.set(keys.value?.[index] ?? options.getItemKey(index), size);

			if (size === before) {
				continue;
			}

			if (root && margin + current.startOf(index) < root.scrollTop) {
				shift += size - before;
			}

			changed = true;
		}

		// Keys of rows that are gone, or a stream of new keys would grow the map forever.
		if (sizes.value.size > current.count) {
			forgetGoneRows(current.count);
		}

		if (changed) {
			triggerRef(sizes);
		}

		if (root && shift !== 0) {
			root.scrollTop += shift;
		}
	}

	/** Ref callback for a row element: `:ref="measureElement"`. Does nothing without `measured`. */
	function measureElement(target: MeasureTarget) {
		const element = toElement(target);

		if (!element || observed.has(element) || !options.measured() || typeof ResizeObserver === 'undefined') {
			return;
		}

		observer ??= new ResizeObserver(handleResize);
		observed.add(element);
		observer.observe(element);
	}

	let correction: number | null = null;

	function cancelCorrection() {
		if (correction !== null) {
			cancelAnimationFrame(correction);
			correction = null;
		}
	}

	/**
	 * Scroll so that the row lands at `align` between the sticky top and bottom. With measured rows the
	 * neighbours of the target are measured only once rendered, so the position is settled over a few
	 * frames.
	 */
	function scrollToIndex(index: number, align: ScrollAlign = 'start') {
		cancelCorrection();

		if (!viewport.element.value || index < 0 || index >= metrics.value.count) {
			return;
		}

		const root = viewport.element.value;

		let attempts = 0;

		function step() {
			correction = null;

			const current = metrics.value;
			const margin = options.scrollMargin();
			const start = margin + current.startOf(index);
			const position = resolveScrollPosition({
				start,
				end: start + current.sizeOf(index),
				insetStart: margin,
				insetEnd: options.scrollMarginEnd(),
				viewport: root.clientHeight,
				scroll: root.scrollTop,
				max: root.scrollHeight - root.clientHeight,
				align,
			});

			if (position === null) {
				return;
			}

			root.scrollTop = position;
			attempts += 1;

			if (options.measured() && attempts < MAX_SCROLL_CORRECTIONS && typeof requestAnimationFrame === 'function') {
				correction = requestAnimationFrame(step);
			}
		}

		step();
	}

	onScopeDispose(() => {
		cancelCorrection();
		observer?.disconnect();
	});

	return { items, totalSize, range, visibleRange, getPageStep, getOffset, measureElement, scrollToIndex };
}
