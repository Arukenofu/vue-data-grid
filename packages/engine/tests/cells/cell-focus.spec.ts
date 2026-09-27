import { describe, expect, it } from 'vitest';

import { resolveCellMove } from '../../src/cells/cell-focus';

const size = { rows: 10, columns: 4 };

const from = { row: 5, column: 2 };

describe('resolveCellMove', () => {
	it('arrows move by one cell', () => {
		expect(resolveCellMove(from, 'up', size)).toEqual({ row: 4, column: 2 });
		expect(resolveCellMove(from, 'down', size)).toEqual({ row: 6, column: 2 });
		expect(resolveCellMove(from, 'left', size)).toEqual({ row: 5, column: 1 });
		expect(resolveCellMove(from, 'right', size)).toEqual({ row: 5, column: 3 });
	});

	it('`step` is a page of rows, and it stops at the edge', () => {
		expect(resolveCellMove(from, 'down', size, 3)).toEqual({ row: 8, column: 2 });
		expect(resolveCellMove(from, 'down', size, 30)).toEqual({ row: 9, column: 2 });
		expect(resolveCellMove(from, 'up', size, 30)).toEqual({ row: 0, column: 2 });
	});

	it('does not wrap past the end of a row', () => {
		expect(resolveCellMove({ row: 5, column: 3 }, 'right', size)).toEqual({ row: 5, column: 3 });
		expect(resolveCellMove({ row: 5, column: 0 }, 'left', size)).toEqual({ row: 5, column: 0 });
	});

	it('row ends, column ends and grid corners', () => {
		expect(resolveCellMove(from, 'rowStart', size)).toEqual({ row: 5, column: 0 });
		expect(resolveCellMove(from, 'rowEnd', size)).toEqual({ row: 5, column: 3 });
		expect(resolveCellMove(from, 'columnStart', size)).toEqual({ row: 0, column: 2 });
		expect(resolveCellMove(from, 'columnEnd', size)).toEqual({ row: 9, column: 2 });
		expect(resolveCellMove(from, 'first', size)).toEqual({ row: 0, column: 0 });
		expect(resolveCellMove(from, 'last', size)).toEqual({ row: 9, column: 3 });
	});

	it('a position outside the grid is first clamped to it', () => {
		expect(resolveCellMove({ row: 40, column: 9 }, 'left', size)).toEqual({ row: 9, column: 2 });
	});

	it('an empty grid gives `null`', () => {
		expect(resolveCellMove(from, 'down', { rows: 0, columns: 4 })).toBeNull();
	});
});
