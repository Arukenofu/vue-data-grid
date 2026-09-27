import { describe, expect, it } from 'vitest';

import {
	collectIndexes,
	createItemMetrics,
	expandRange,
	isSameRange,
	resolvePageStep,
	resolveVirtualItems,
	resolveVisibleRange,
} from '../../src/virtual/item-metrics';

describe('createItemMetrics', () => {
	it('resolves a single size arithmetically', () => {
		const metrics = createItemMetrics(1000, 36);

		expect(metrics.total).toBe(36_000);
		expect(metrics.startOf(0)).toBe(0);
		expect(metrics.startOf(10)).toBe(360);
		expect(metrics.startOf(1000)).toBe(36_000);
		expect(metrics.sizeOf(999)).toBe(36);
	});

	it('reads a size function once per item into prefix sums', () => {
		const calls: number[] = [];
		const metrics = createItemMetrics(4, (index) => {
			calls.push(index);

			return (index + 1) * 10;
		});

		expect(calls).toEqual([0, 1, 2, 3]);
		expect([0, 1, 2, 3, 4].map(metrics.startOf)).toEqual([0, 10, 30, 60, 100]);
		expect([0, 1, 2, 3].map(metrics.sizeOf)).toEqual([10, 20, 30, 40]);
		expect(metrics.total).toBe(100);
	});

	it('an empty list has no size', () => {
		expect(createItemMetrics(0, 36).total).toBe(0);
		expect(createItemMetrics(0, () => 36).total).toBe(0);
	});
});

describe('resolveVisibleRange', () => {
	const uniform = createItemMetrics(100, 36);

	it('covers the items that intersect the viewport', () => {
		expect(resolveVisibleRange(uniform, 0, 100)).toEqual({ start: 0, end: 3 });
	});

	it('an item that ends exactly at the viewport edge is not visible', () => {
		expect(resolveVisibleRange(uniform, 36, 72)).toEqual({ start: 1, end: 3 });
	});

	it('an item that starts exactly at the far edge is not visible', () => {
		expect(resolveVisibleRange(uniform, 0, 72)).toEqual({ start: 0, end: 2 });
	});

	it('a partly visible item at either edge is visible', () => {
		expect(resolveVisibleRange(uniform, 35, 2)).toEqual({ start: 0, end: 2 });
	});

	it('a viewport above the list starts at the first item', () => {
		expect(resolveVisibleRange(uniform, -50, 100)).toEqual({ start: 0, end: 2 });
	});

	it('a viewport past the end keeps the last item', () => {
		expect(resolveVisibleRange(uniform, 10_000, 100)).toEqual({ start: 99, end: 100 });
	});

	it('a viewport of zero size keeps the item under it', () => {
		expect(resolveVisibleRange(uniform, 40, 0)).toEqual({ start: 1, end: 2 });
	});

	it('an empty list gives an empty range', () => {
		expect(resolveVisibleRange(createItemMetrics(0, 36), 0, 100)).toEqual({ start: 0, end: 0 });
	});

	it('works on different sizes', () => {
		const metrics = createItemMetrics(5, index => [10, 100, 10, 10, 10][index]);

		expect(resolveVisibleRange(metrics, 20, 50)).toEqual({ start: 1, end: 2 });
		expect(resolveVisibleRange(metrics, 105, 20)).toEqual({ start: 1, end: 4 });
	});

	it('gives the same range for a size function and a single size', () => {
		const measured = createItemMetrics(100, () => 36);

		for (const offset of [0, 17, 36, 1000, 3564]) {
			expect(resolveVisibleRange(measured, offset, 400)).toEqual(resolveVisibleRange(uniform, offset, 400));
		}
	});
});

describe('expandRange', () => {
	it('widens the range on both sides within the list', () => {
		expect(expandRange({ start: 10, end: 20 }, 5, 100)).toEqual({ start: 5, end: 25 });
		expect(expandRange({ start: 2, end: 98 }, 5, 100)).toEqual({ start: 0, end: 100 });
	});

	it('returns the same range without overscan', () => {
		const range = { start: 1, end: 2 };

		expect(expandRange(range, 0, 100)).toBe(range);
	});
});

describe('collectIndexes', () => {
	it('lists the range', () => {
		expect(collectIndexes({ start: 3, end: 6 }, [], 10)).toEqual([3, 4, 5]);
	});

	it('adds kept indexes outside the range in order', () => {
		expect(collectIndexes({ start: 3, end: 5 }, [9, 0], 10)).toEqual([0, 3, 4, 9]);
	});

	it('ignores kept indexes inside the range, outside the list and not integers', () => {
		expect(collectIndexes({ start: 3, end: 5 }, [4, -1, 10, 1.5, 7, 7], 10)).toEqual([3, 4, 7]);
	});
});

describe('isSameRange', () => {
	it('compares by bounds', () => {
		expect(isSameRange({ start: 1, end: 2 }, { start: 1, end: 2 })).toBe(true);
		expect(isSameRange({ start: 1, end: 2 }, { start: 1, end: 3 })).toBe(false);
		expect(isSameRange(null, null)).toBe(true);
		expect(isSameRange(null, { start: 0, end: 0 })).toBe(false);
	});
});

describe('resolvePageStep', () => {
	const uniform = createItemMetrics(100, 36);

	it('passes as many items as fit into the page', () => {
		expect(resolvePageStep(uniform, 0, 'down', 324)).toBe(9);
		expect(resolvePageStep(uniform, 0, 'down', 340)).toBe(9);
		expect(resolvePageStep(uniform, 20, 'up', 324)).toBe(9);
	});

	it('counts items of different sizes as they are', () => {
		const mixed = createItemMetrics(10, index => (index % 2 === 0 ? 20 : 40));

		expect(resolvePageStep(mixed, 0, 'down', 100)).toBe(3);
		expect(resolvePageStep(mixed, 4, 'up', 100)).toBe(3);
	});

	it('stops at the ends of the list', () => {
		expect(resolvePageStep(uniform, 95, 'down', 324)).toBe(4);
		expect(resolvePageStep(uniform, 3, 'up', 324)).toBe(3);
	});

	it('moves at least one item', () => {
		expect(resolvePageStep(uniform, 10, 'down', 0)).toBe(1);
		expect(resolvePageStep(uniform, 99, 'down', 324)).toBe(1);
		expect(resolvePageStep(createItemMetrics(0, 36), 0, 'down', 324)).toBe(1);
	});
});

describe('resolveVirtualItems', () => {
	const metrics = createItemMetrics(100, 10);

	function key(index: number) {
		return `r${index}`;
	}

	it('builds an item per index, with the margin in its position', () => {
		expect(resolveVirtualItems([0, 7], metrics, key, 40)).toEqual([
			{ key: 'r0', index: 0, start: 40, end: 50, size: 10 },
			{ key: 'r7', index: 7, start: 110, end: 120, size: 10 },
		]);
	});

	it('returns the previous list when nothing in it changed', () => {
		const previous = resolveVirtualItems([3, 4, 5], metrics, key);

		expect(resolveVirtualItems([3, 4, 5], metrics, key, 0, previous)).toBe(previous);
	});

	it('keeps the item of a row that stays rendered while the window moves', () => {
		const previous = resolveVirtualItems([3, 4, 5], metrics, key);
		const next = resolveVirtualItems([4, 5, 6], metrics, key, 0, previous);

		expect(next).not.toBe(previous);
		expect(next[0]).toBe(previous[1]);
		expect(next[1]).toBe(previous[2]);
		expect(next[2]).toEqual({ key: 'r6', index: 6, start: 60, end: 70, size: 10 });
	});

	it('gives a new item to a row under another key, at another index or of another size', () => {
		const previous = resolveVirtualItems([3, 4, 5], metrics, key);
		const renamed = resolveVirtualItems([3, 4, 5], metrics, index => (index === 3 ? 'other' : key(index)), 0, previous);
		const moved = resolveVirtualItems([3, 4, 5], metrics, index => ['r4', 'r3', 'r5'][index - 3], 0, previous);
		const resized = resolveVirtualItems([3, 4, 5], createItemMetrics(100, 12), key, 0, previous);

		expect(renamed[0]).toMatchObject({ key: 'other', index: 3 });
		expect(renamed.slice(1)).toEqual(previous.slice(1));
		expect(renamed[1]).toBe(previous[1]);
		expect(moved[0]).toMatchObject({ key: 'r4', index: 3 });
		expect(moved[0]).not.toBe(previous[1]);
		expect(moved[2]).toBe(previous[2]);
		expect(resized.every((item, position) => item !== previous[position])).toBe(true);
	});

	it('an empty window after an empty one is the same list', () => {
		const previous = resolveVirtualItems([], metrics, key);

		expect(resolveVirtualItems([], metrics, key, 0, previous)).toBe(previous);
	});
});
