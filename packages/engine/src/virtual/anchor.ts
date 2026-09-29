import { type ItemMetrics, resolveVisibleRange } from './item-metrics';

/** The items of a list at one moment, for `resolveAnchorShift`. */
export interface AnchorSnapshot {
	/** Sizes and positions of the items, px. */
	metrics: ItemMetrics;
	/** The key of the item at an index; `undefined` for one it does not know, such as one not rendered. */
	getKey: (index: number) => string | undefined;
}

/** The items of a list after the change: a snapshot that also finds an item by its key. */
export interface AnchorTarget extends AnchorSnapshot {
	/** The index of the item with a key; `-1` for none. */
	getIndex: (key: string) => number;
}

/**
 * How far to scroll so that the items in view keep their place on the screen after items were
 * inserted or removed above them, as a page loaded at the top: the offset the first item in view moved
 * by, px. `offset` and `size` are the part in view in list coordinates before the change.
 *
 * The first item in view is found by key, and only when every item in view moved by as many places as
 * it did, so the change was all above them, is the list scrolled: rows added below, a sort, or a filter
 * scroll nothing, and a page added at the top while one is dropped at the bottom does. Reads the keys
 * of the items in view only, and looks the first one up by key only when it is no longer in its place.
 */
export function resolveAnchorShift(previous: AnchorSnapshot, next: AnchorTarget, offset: number, size: number) {
	const visible = resolveVisibleRange(previous.metrics, offset, size);

	if (visible.end <= visible.start || next.metrics.count === 0) {
		return 0;
	}

	const first = previous.getKey(visible.start);

	// Most changes, rows added below or measured anew, leave the first row in view where it was: no lookup.
	if (first === undefined || next.getKey(visible.start) === first) {
		return 0;
	}

	const moved = next.getIndex(first);
	const delta = moved - visible.start;

	if (moved < 0) {
		return 0;
	}

	for (let index = visible.start + 1; index < visible.end; index += 1) {
		const key = previous.getKey(index);
		const target = index + delta;

		if (key === undefined || target >= next.metrics.count || next.getKey(target) !== key) {
			return 0;
		}
	}

	return next.metrics.startOf(moved) - previous.metrics.startOf(visible.start);
}
