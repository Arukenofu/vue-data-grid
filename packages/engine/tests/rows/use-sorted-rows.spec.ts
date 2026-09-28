import { shallowRef } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { defineColumns } from '../../src/columns/define-columns';
import type { GridSort } from '../../src/columns/sort';
import { useSortedRows } from '../../src/rows/use-sorted-rows';

interface Row {
	id: string;
	price: number;
}

const read = vi.fn((row: Row) => row.price);

const columns = defineColumns({ price: { value: read } });

const createRows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `r${index}`, price: index }));

describe('useSortedRows', () => {
	it('sorts by the model and re-sorts when it changes', () => {
		const sort = shallowRef<GridSort[]>([{ name: 'price', direction: 'desc' }]);
		const sorted = useSortedRows({ rows: createRows(3), sort, columns });

		expect(sorted.value.map(row => row.id)).toEqual(['r2', 'r1', 'r0']);

		sort.value = [{ name: 'price', direction: 'asc' }];

		expect(sorted.value.map(row => row.id)).toEqual(['r0', 'r1', 'r2']);
	});

	it('without a sort returns the rows as the same array', () => {
		const rows = createRows(3);

		expect(useSortedRows({ rows, sort: [], columns }).value).toBe(rows);
	});

	it('with `delta` reads values only of rows that arrived as new objects', () => {
		const rows = shallowRef(createRows(1000));
		const sorted = useSortedRows({ rows, sort: [{ name: 'price', direction: 'desc' }], columns, delta: true });

		void sorted.value;
		read.mockClear();

		rows.value = rows.value.map(row => (row.id === 'r10' ? { ...row, price: 5000 } : row));

		expect(sorted.value[0].id).toBe('r10');
		expect(read).toHaveBeenCalledTimes(1);
	});

	it('with `delta` an unchanged set in a new array keeps the previous order', () => {
		const rows = shallowRef(createRows(10));
		const sorted = useSortedRows({ rows, sort: [{ name: 'price', direction: 'desc' }], columns, delta: true });
		const before = sorted.value;

		rows.value = [...rows.value];

		expect(sorted.value).toBe(before);
	});
});
