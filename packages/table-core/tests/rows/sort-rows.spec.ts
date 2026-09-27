import { describe, expect, it } from 'vitest';

import { toColumnList } from '../../src/columns/column';
import { defineColumns } from '../../src/columns/define-columns';
import type { TableSort } from '../../src/columns/sort';
import { resolveSortedRows, sortRows } from '../../src/rows/sort-rows';

interface Row {
	id: string;
	price: number | null;
	sector: string;
}

const columns = defineColumns({
	id: { value: (row: Row) => row.id },
	price: { value: (row: Row) => row.price },
	sector: { value: (row: Row) => row.sector },
	length: { value: (row: Row) => row.id, compare: (a: string, b: string) => a.length - b.length },
});

const list = toColumnList(columns);

const row = (id: string, price: number | null, sector = 'tech'): Row => ({ id, price, sector });

const ids = (rows: readonly Row[]) => rows.map(item => item.id);

const byPrice = (direction: TableSort['direction']): TableSort[] => [{ name: 'price', direction }];

describe('sortRows', () => {
	const rows = [row('a', 3), row('b', 1), row('c', 2)];

	it('without a sort returns the rows as the same array', () => {
		expect(sortRows(rows, [], columns)).toBe(rows);
	});

	it('ascending and descending', () => {
		expect(ids(sortRows(rows, byPrice('asc'), columns))).toEqual(['b', 'c', 'a']);
		expect(ids(sortRows(rows, byPrice('desc'), columns))).toEqual(['a', 'c', 'b']);
	});

	it('empty values go last in either direction', () => {
		const withEmpty = [row('a', null), row('b', 1), row('c', 2)];

		expect(ids(sortRows(withEmpty, byPrice('asc'), columns))).toEqual(['b', 'c', 'a']);
		expect(ids(sortRows(withEmpty, byPrice('desc'), columns))).toEqual(['c', 'b', 'a']);
	});

	it('the column `compare` replaces the default comparison', () => {
		const words = [row('ccc', 0), row('a', 0), row('bb', 0)];

		expect(ids(sortRows(words, [{ name: 'length', direction: 'asc' }], columns))).toEqual(['a', 'bb', 'ccc']);
	});

	it('the second column decides only where the first one gave a tie', () => {
		const rowsBySector = [row('a', 1, 'tech'), row('b', 2, 'energy'), row('c', 3, 'tech')];
		const sort: TableSort[] = [{ name: 'sector', direction: 'asc' }, { name: 'price', direction: 'desc' }];

		expect(ids(sortRows(rowsBySector, sort, columns))).toEqual(['b', 'c', 'a']);
	});

	it('equal rows keep their input order', () => {
		const equal = [row('a', 1), row('b', 1), row('c', 1)];

		expect(ids(sortRows(equal, byPrice('desc'), columns))).toEqual(['a', 'b', 'c']);
	});

	it('an unknown column in the sort is skipped', () => {
		expect(sortRows(rows, [{ name: 'missing', direction: 'asc' }], columns)).toBe(rows);
	});

	it('the input is not modified', () => {
		const snapshot = [...rows];

		sortRows(rows, byPrice('asc'), columns);

		expect(rows).toEqual(snapshot);
	});
});

describe('resolveSortedRows — incremental re-sort', () => {
	const initial = Array.from({ length: 20 }, (_, index) => row(`r${index}`, index));

	it('the same input and the same keys give the same frame', () => {
		const frame = resolveSortedRows(null, initial, byPrice('desc'), list, true);

		expect(resolveSortedRows(frame, initial, byPrice('desc'), list, true)).toBe(frame);
	});

	it('a new array of the same objects keeps the order as the same array', () => {
		const frame = resolveSortedRows(null, initial, byPrice('desc'), list, true);
		const next = resolveSortedRows(frame, [...initial], byPrice('desc'), list, true);

		expect(next.rows).toBe(frame.rows);
	});

	it('a changed row moves to its place, the others stay', () => {
		const frame = resolveSortedRows(null, initial, byPrice('desc'), list, true);
		const changed = initial.map(item => (item.id === 'r3' ? { ...item, price: 100 } : item));
		const next = resolveSortedRows(frame, changed, byPrice('desc'), list, true);

		expect(next.rows[0]).toMatchObject({ id: 'r3', price: 100 });
		expect(next.rows).toEqual(sortRows(changed, byPrice('desc'), columns));
	});

	it('added and removed rows come out as with a full sort', () => {
		const frame = resolveSortedRows(null, initial, byPrice('asc'), list, true);
		const changed = [...initial.filter(item => item.id !== 'r5'), row('x', 4.5), row('y', null), row('z', -1)];
		const next = resolveSortedRows(frame, changed, byPrice('asc'), list, true);

		expect(ids(next.rows)).toEqual(ids(sortRows(changed, byPrice('asc'), columns)));
	});

	it('a row that comes back as the same object after removal is in the list again', () => {
		const frame = resolveSortedRows(null, initial, byPrice('asc'), list, true);
		const without = resolveSortedRows(frame, initial.slice(1), byPrice('asc'), list, true);
		const back = resolveSortedRows(without, initial, byPrice('asc'), list, true);

		expect(ids(back.rows)).toEqual(ids(initial));
	});

	it('a direction change sorts from scratch', () => {
		const frame = resolveSortedRows(null, initial, byPrice('asc'), list, true);
		const next = resolveSortedRows(frame, initial, byPrice('desc'), list, true);

		expect(next.rows[0].id).toBe('r19');
	});

	it('without `delta` a row mutated in place is still re-sorted', () => {
		const rows = initial.map(item => ({ ...item }));
		const frame = resolveSortedRows(null, rows, byPrice('desc'), list, false);

		rows[3].price = 100;

		const next = resolveSortedRows(frame, [...rows], byPrice('desc'), list, false);

		expect(next.rows[0].id).toBe('r3');
	});
});
