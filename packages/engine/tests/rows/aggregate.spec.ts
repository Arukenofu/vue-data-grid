import { describe, expect, it } from 'vitest';

import { toColumnList } from '../../src/columns/column';
import { defineColumns } from '../../src/columns/define-columns';
import { aggregateColumn, aggregateRows } from '../../src/rows/aggregate';

interface Row {
	price: number | null;
	symbol: string;
}

const rows: Row[] = [
	{ price: 3, symbol: 'b' },
	{ price: null, symbol: 'a' },
	{ price: 1, symbol: 'c' },
];

const columns = defineColumns({
	sum: { value: (row: Row) => row.price, aggregate: 'sum' },
	avg: { value: (row: Row) => row.price, aggregate: 'avg' },
	min: { value: (row: Row) => row.price, aggregate: 'min' },
	max: { value: (row: Row) => row.symbol, aggregate: 'max' },
	count: { value: (row: Row) => row.price, aggregate: 'count' },
	custom: {
		value: (row: Row) => row.symbol,
		aggregate: (values: readonly string[]) => values.join(''),
	},
	plain: { value: (row: Row) => row.price },
});

describe('aggregateColumn', () => {
	it('built-in aggregates skip empty values', () => {
		expect(aggregateColumn(columns.sum, rows)).toBe(4);
		expect(aggregateColumn(columns.avg, rows)).toBe(2);
		expect(aggregateColumn(columns.min, rows)).toBe(1);
	});

	it('`min` and `max` compare more than numbers', () => {
		expect(aggregateColumn(columns.max, rows)).toBe('c');
	});

	it('`count` is the number of rows', () => {
		expect(aggregateColumn(columns.count, rows)).toBe(3);
	});

	it('without a single value gives `null`', () => {
		const empty = [{ price: null, symbol: '' }];

		expect(aggregateColumn(columns.sum, empty)).toBeNull();
		expect(aggregateColumn(columns.avg, empty)).toBeNull();
		expect(aggregateColumn(columns.min, empty)).toBeNull();
	});

	it('a function gets the values and the rows', () => {
		expect(aggregateColumn(columns.custom, rows)).toBe('bac');
	});

	it('without `aggregate` gives `undefined`', () => {
		expect(aggregateColumn(columns.plain, rows)).toBeUndefined();
	});
});

describe('aggregateRows', () => {
	it('aggregates by name only for columns with `aggregate`', () => {
		const result = aggregateRows(toColumnList(columns), rows);

		expect(Object.keys(result)).toEqual(['sum', 'avg', 'min', 'max', 'count', 'custom']);
		expect(result.sum).toBe(4);
	});
});
