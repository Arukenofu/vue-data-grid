import { describe, expect, it } from 'vitest';

import type { CellPosition } from '../../src/cells/cell-address';
import { getFillTarget, resolveFill } from '../../src/cells/fill';

const source = { rowStart: 2, rowEnd: 4, columnStart: 1, columnEnd: 2 };

describe('getFillTarget', () => {
	it('stretches the source to the row or the column the pointer is farther out on', () => {
		expect(getFillTarget(source, 7, 1)).toEqual({ ...source, rowEnd: 8 });
		expect(getFillTarget(source, 0, 2)).toEqual({ ...source, rowStart: 0 });
		expect(getFillTarget(source, 3, 5)).toEqual({ ...source, columnEnd: 6 });
		expect(getFillTarget(source, 5, 4)).toEqual({ ...source, columnEnd: 5 });
	});

	it('a cell inside the source leaves it as it is', () => {
		expect(getFillTarget(source, 3, 1)).toBe(source);
	});
});

const cells = {
	keys: ['r0', 'r1', 'r2', 'r3'],
	columns: ['c0', 'c1', 'c2', 'c3'],
};

function column(name: string) {
	return cells.columns.indexOf(name);
}

describe('resolveFill', () => {
	const values = [
		[1, 'a', 5],
		[2, 'b', 5],
		[0, 0, 0],
		[0, 0, 0],
	];
	const getValue = (cell: CellPosition) => values[cell.index][column(cell.column)];

	it('numbers go on as a linear series down each column; text repeats', () => {
		const writes = resolveFill(
			{ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 3 },
			{ rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 3 },
			cells,
			getValue,
		);

		expect(writes.map(write => write.value)).toEqual([3, 4, 'a', 'b', 5, 5]);
		expect(writes[0]).toEqual({ key: 'r2', column: 'c0', value: 3 });
	});

	it('without `series` numbers repeat too, and a single number always does', () => {
		const target = { rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 1 };

		expect(resolveFill({ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 1 }, target, cells, getValue, { series: false })
			.map(write => write.value)).toEqual([1, 2]);
		expect(resolveFill({ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 }, target, cells, getValue)
			.map(write => write.value)).toEqual([1, 1, 1]);
	});

	it('a fill up or left continues backwards', () => {
		const line = [10, 20];
		const writes = resolveFill(
			{ rowStart: 0, rowEnd: 1, columnStart: 2, columnEnd: 4 },
			{ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 4 },
			cells,
			cell => line[column(cell.column) - 2],
		);

		expect(writes).toEqual([{ key: 'r0', column: 'c0', value: -10 }, { key: 'r0', column: 'c1', value: 0 }]);
	});

	it('a trend of uneven numbers is the least-squares line, without float noise', () => {
		const line = [0.1, 0.2, 0.4];
		const writes = resolveFill(
			{ rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 1 },
			{ rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 1 },
			cells,
			cell => line[cell.index],
		);

		expect(writes[0].value).toBe(0.533333333333333);
	});

	it('keeps integers of 13 and more digits exact, as timestamps and ids are', () => {
		const target = { rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 1 };
		const series = [1_700_000_000_001, 1_700_000_000_002];
		const same = [123_456_789_012_345, 123_456_789_012_345];

		expect(resolveFill({ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 1 }, target, cells, cell => series[cell.index])
			.map(write => write.value)).toEqual([1_700_000_000_003, 1_700_000_000_004]);
		expect(resolveFill({ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 1 }, target, cells, cell => same[cell.index])
			.map(write => write.value)).toEqual([123_456_789_012_345, 123_456_789_012_345]);
	});
});
