/** A rendered item of the row window. */
export interface VirtualItem {
	key: string;
	/** Position in the list, which is the index into `rows`. */
	index: number;
	/**
	 * Edges along the scroll axis, px: the offset in the body plus `scrollMargin`. A `bodyOffset` is left
	 * out: it moves the whole body, and items keep their objects while it changes.
	 */
	start: number;
	end: number;
	size: number;
}

/** Half-open range of item indexes `[start, end)`. */
export interface ItemRange {
	start: number;
	end: number;
}

/** Item positions along one axis, measured from the start of the list. */
export interface ItemMetrics {
	readonly count: number;
	/** Sum of all item sizes. */
	readonly total: number;
	/** Start of the item at `index`; `startOf(count)` is `total`. */
	startOf: (index: number) => number;
	sizeOf: (index: number) => number;
}

/**
 * Metrics for `count` items. A single size is resolved arithmetically without touching the list; a
 * function is read once per item into prefix sums, so positions are O(1) and lookups O(log n).
 */
export function createItemMetrics(count: number, size: number | ((index: number) => number)): ItemMetrics {
	if (typeof size === 'number') {
		return {
			count,
			total: count * size,
			startOf: index => index * size,
			sizeOf: () => size,
		};
	}

	const starts = new Float64Array(count + 1);

	for (let index = 0; index < count; index += 1) {
		starts[index + 1] = starts[index] + size(index);
	}

	return {
		count,
		total: starts[count],
		startOf: index => starts[index],
		sizeOf: index => starts[index + 1] - starts[index],
	};
}

function findStartAfter(metrics: ItemMetrics, position: number) {
	let low = 0;
	let high = metrics.count;

	while (low < high) {
		const middle = (low + high) >>> 1;

		if (metrics.startOf(middle) > position) {
			high = middle;
		} else {
			low = middle + 1;
		}
	}

	return low;
}

function findStartFrom(metrics: ItemMetrics, position: number) {
	let low = 0;
	let high = metrics.count;

	while (low < high) {
		const middle = (low + high) >>> 1;

		if (metrics.startOf(middle) >= position) {
			high = middle;
		} else {
			low = middle + 1;
		}
	}

	return low;
}

const EMPTY_RANGE: ItemRange = Object.freeze({ start: 0, end: 0 });

/**
 * Items that intersect `[offset, offset + size)`, in list coordinates. A viewport past either end of
 * the list or of zero size still yields the nearest item, so a window never renders empty while the
 * list is not.
 */
export function resolveVisibleRange(metrics: ItemMetrics, offset: number, size: number): ItemRange {
	const { count } = metrics;

	if (count === 0) {
		return EMPTY_RANGE;
	}

	const first = Math.min(Math.max(findStartAfter(metrics, offset) - 1, 0), count - 1);
	const last = Math.min(Math.max(findStartFrom(metrics, offset + size) - 1, first), count - 1);

	return { start: first, end: last + 1 };
}

/** The item whose span holds `position`; past either end of the list, the item at that end. */
function findItemAt(metrics: ItemMetrics, position: number) {
	return Math.min(Math.max(findStartAfter(metrics, position) - 1, 0), metrics.count - 1);
}

/** Which way a page move goes: PageUp or PageDown. */
export type PageDirection = 'up' | 'down';

/**
 * How many items a page move from `index` passes: the move lands on the item that stands `page` px
 * from the start of `index` in `direction`, so items of different sizes count as they are. At least
 * one, so a page smaller than an item still moves.
 */
export function resolvePageStep(metrics: ItemMetrics, index: number, direction: PageDirection, page: number) {
	if (metrics.count === 0) {
		return 1;
	}

	const from = Math.min(Math.max(index, 0), metrics.count - 1);
	const start = metrics.startOf(from);
	const target = findItemAt(metrics, direction === 'down' ? start + page : start - page);

	return Math.max(Math.abs(target - from), 1);
}

/** The range widened by `overscan` items on each side, within `[0, count)`. */
export function expandRange(range: ItemRange, overscan: number, count: number): ItemRange {
	if (overscan <= 0) {
		return range;
	}

	return { start: Math.max(range.start - overscan, 0), end: Math.min(range.end + overscan, count) };
}

/** Indexes of the range plus the kept ones inside `[0, count)`, ascending and without repeats. */
export function collectIndexes(range: ItemRange, keep: readonly number[], count: number) {
	const indexes: number[] = [];

	for (let index = range.start; index < range.end; index += 1) {
		indexes.push(index);
	}

	const extra = keep.filter(index => Number.isInteger(index)
		&& index >= 0
		&& index < count
		&& (index < range.start || index >= range.end));

	if (extra.length === 0) {
		return indexes;
	}

	return [...new Set([...indexes, ...extra])].sort((first, second) => first - second);
}

export function isSameRange(current: ItemRange | null, next: ItemRange | null) {
	return current === next
		|| (current !== null && next !== null && current.start === next.start && current.end === next.end);
}

function isSameItem(
	item: VirtualItem | undefined,
	key: string,
	index: number,
	start: number,
	size: number,
): item is VirtualItem {
	return item !== undefined && item.key === key && item.index === index && item.start === start && item.size === size;
}

/**
 * Items for `indexes`, with `margin` added to their positions. An item whose key, index, start and
 * size did not change is the object from `previous`, and an unchanged list is `previous` itself: row
 * caches compare these references, so a kept row that moves inside the window, or new row objects
 * under the same keys, invalidate nothing.
 */
export function resolveVirtualItems(
	indexes: readonly number[],
	metrics: ItemMetrics,
	getKey: (index: number) => string,
	margin = 0,
	previous: readonly VirtualItem[] = [],
): readonly VirtualItem[] {
	// Built on the first item that moved: a window scrolled by a few rows finds the rest by key.
	let known: Map<string, VirtualItem> | null = null;
	let same = indexes.length === previous.length;

	const items = indexes.map((index, position) => {
		const key = getKey(index);
		const start = margin + metrics.startOf(index);
		const size = metrics.sizeOf(index);
		let item: VirtualItem | undefined = previous[position];

		if (!isSameItem(item, key, index, start, size)) {
			known ??= new Map(previous.map(entry => [entry.key, entry]));
			item = known.get(key);

			if (!isSameItem(item, key, index, start, size)) {
				item = { key, index, start, end: start + size, size };
			}
		}

		same &&= item === previous[position];

		return item;
	});

	return same ? previous : items;
}
