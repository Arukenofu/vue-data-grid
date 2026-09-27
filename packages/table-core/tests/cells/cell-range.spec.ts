import { describe, expect, it } from 'vitest';

import {
	containsRangeBounds,
	getRangeBounds,
	getRangeCells,
	isInRangeBounds,
	type RangeBounds,
	subtractRangeBounds,
} from '../../src/cells/cell-range';

const columns = ['a', 'b', 'c', 'd'];

describe('getRangeBounds', () => {
	it('corners in any order give one rectangle', () => {
		const bounds = { rowStart: 2, rowEnd: 6, columnStart: 1, columnEnd: 4 };

		expect(getRangeBounds({ anchor: { index: 2, column: 'b' }, focus: { index: 5, column: 'd' } }, columns, 10))
			.toEqual(bounds);
		expect(getRangeBounds({ anchor: { index: 5, column: 'd' }, focus: { index: 2, column: 'b' } }, columns, 10))
			.toEqual(bounds);
	});

	it('columns are counted in the current display order', () => {
		const range = { anchor: { index: 0, column: 'a' }, focus: { index: 0, column: 'b' } };

		expect(getRangeBounds(range, ['b', 'c', 'a'], 1)).toMatchObject({ columnStart: 0, columnEnd: 3 });
	});

	it('rows past the end of the list are clipped', () => {
		const range = { anchor: { index: 3, column: 'a' }, focus: { index: 20, column: 'a' } };

		expect(getRangeBounds(range, columns, 5)).toMatchObject({ rowStart: 3, rowEnd: 5 });
	});

	it('a hidden corner column or a range past the last row gives `null`', () => {
		expect(getRangeBounds({ anchor: { index: 0, column: 'x' }, focus: { index: 0, column: 'a' } }, columns, 5))
			.toBeNull();
		expect(getRangeBounds({ anchor: { index: 7, column: 'a' }, focus: { index: 9, column: 'a' } }, columns, 5))
			.toBeNull();
	});
});

describe('getRangeBounds — row keys', () => {
	const keys = ['k0', 'k1', 'k2', 'k3'];
	const getRowIndex = (key: string) => keys.indexOf(key);

	it('a key corner stands on the row with that key, and keys mix with indexes', () => {
		expect(getRangeBounds({ anchor: { key: 'k3', column: 'a' }, focus: { index: 1, column: 'b' } }, columns, 4, getRowIndex))
			.toMatchObject({ rowStart: 1, rowEnd: 4 });
	});

	it('a key that is gone gives `null`', () => {
		expect(getRangeBounds({ anchor: { key: 'k9', column: 'a' }, focus: { key: 'k1', column: 'a' } }, columns, 4, getRowIndex))
			.toBeNull();
	});
});

describe('isInRangeBounds', () => {
	it('half-open intervals: the end is not included', () => {
		const bounds = { rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 2 };

		expect(isInRangeBounds(bounds, 1, 0)).toBe(true);
		expect(isInRangeBounds(bounds, 2, 1)).toBe(true);
		expect(isInRangeBounds(bounds, 3, 1)).toBe(false);
		expect(isInRangeBounds(bounds, 1, 2)).toBe(false);
	});
});

describe('containsRangeBounds', () => {
	it('holds when every cell of the inner bounds is in the outer ones', () => {
		const outer = { rowStart: 1, rowEnd: 4, columnStart: 0, columnEnd: 3 };

		expect(containsRangeBounds(outer, outer)).toBe(true);
		expect(containsRangeBounds(outer, { rowStart: 2, rowEnd: 3, columnStart: 1, columnEnd: 2 })).toBe(true);
		expect(containsRangeBounds(outer, { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 1 })).toBe(false);
	});
});

describe('subtractRangeBounds', () => {
	const bounds = { rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 4 };

	function cells(list: readonly RangeBounds[]) {
		const result: string[] = [];

		for (const item of list) {
			for (let row = item.rowStart; row < item.rowEnd; row += 1) {
				for (let column = item.columnStart; column < item.columnEnd; column += 1) {
					result.push(`${row}:${column}`);
				}
			}
		}

		return result.sort();
	}

	it('a cut in the middle leaves four rectangles: above, before, after, below', () => {
		expect(subtractRangeBounds(bounds, { rowStart: 1, rowEnd: 3, columnStart: 1, columnEnd: 3 })).toEqual([
			{ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 4 },
			{ rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 1 },
			{ rowStart: 1, rowEnd: 3, columnStart: 3, columnEnd: 4 },
			{ rowStart: 3, rowEnd: 4, columnStart: 0, columnEnd: 4 },
		]);
	});

	it('a cut over an edge leaves the rest on the other side', () => {
		expect(subtractRangeBounds(bounds, { rowStart: 2, rowEnd: 9, columnStart: 0, columnEnd: 9 }))
			.toEqual([{ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 4 }]);
	});

	it('bounds that the cut does not meet come back as they are; a cut over all of them leaves nothing', () => {
		expect(subtractRangeBounds(bounds, { rowStart: 4, rowEnd: 5, columnStart: 0, columnEnd: 1 })[0]).toBe(bounds);
		expect(subtractRangeBounds(bounds, { rowStart: 0, rowEnd: 9, columnStart: 0, columnEnd: 9 })).toEqual([]);
	});

	it('the pieces hold exactly the cells outside the cut, each once', () => {
		for (let rowStart = 0; rowStart < 5; rowStart += 1) {
			for (let columnStart = 0; columnStart < 5; columnStart += 1) {
				const cut = { rowStart, rowEnd: rowStart + 2, columnStart, columnEnd: columnStart + 1 };
				const expected = cells([bounds]).filter((cell) => {
					const [row, column] = cell.split(':').map(Number);

					return !isInRangeBounds(cut, row, column);
				});

				expect(cells(subtractRangeBounds(bounds, cut))).toEqual(expected);
			}
		}
	});
});

describe('getRangeCells', () => {
	const grid = { keys: ['k0', 'k1', 'k2'], columns: ['a', 'b', 'c'] };

	it('gives the cells of bounds row by row, by row key and column name', () => {
		expect(getRangeCells([{ rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 2 }], grid)).toEqual([
			{ key: 'k1', column: 'a' },
			{ key: 'k1', column: 'b' },
			{ key: 'k2', column: 'a' },
			{ key: 'k2', column: 'b' },
		]);
	});

	it('gives a cell of overlapping bounds once', () => {
		const cells = getRangeCells([
			{ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 },
			{ rowStart: 1, rowEnd: 3, columnStart: 1, columnEnd: 3 },
		], grid);

		expect(cells).toHaveLength(7);
		expect(new Set(cells.map(cell => `${cell.key}:${cell.column}`)).size).toBe(7);
	});
});
