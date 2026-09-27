import { describe, expect, it } from 'vitest';

import {
	type AnyColumn,
	clampColumnWidth,
	DEFAULT_COLUMN_WIDTH,
	getCellText,
	normalizeColumn,
	reconcileColumns,
	resolveRowHeaders,
	toColumnList,
	toRuntimeColumn,
} from '../../src/columns/column';

const value = () => 0;

describe('clampColumnWidth', () => {
	it('keeps the width at or above `minWidth`', () => {
		expect(clampColumnWidth({ minWidth: 80 }, 20)).toBe(80);
	});

	it('keeps the width at or below `maxWidth`', () => {
		expect(clampColumnWidth({ minWidth: 80, maxWidth: 200 }, 900)).toBe(200);
	});

	it('without `maxWidth` there is no maximum', () => {
		expect(clampColumnWidth({ minWidth: 80 }, 100_000)).toBe(100_000);
	});

	it('rounds a fractional width', () => {
		expect(clampColumnWidth({ minWidth: 80 }, 120.4)).toBe(120);
		expect(clampColumnWidth({ minWidth: 80 }, 120.6)).toBe(121);
	});

	it('rounds before clamping, not after', () => {
		expect(clampColumnWidth({ minWidth: 80, maxWidth: 120 }, 120.6)).toBe(120);
	});

	it('`maxWidth` below `minWidth` wins: the maximum applies last', () => {
		expect(clampColumnWidth({ minWidth: 200, maxWidth: 100 }, 150)).toBe(100);
	});

	it('a negative width is raised to `minWidth`', () => {
		expect(clampColumnWidth({ minWidth: 40 }, -500)).toBe(40);
	});
});

describe('normalizeColumn — defaults', () => {
	it('the default width is 120', () => {
		expect(normalizeColumn('price', { value }).width).toBe(DEFAULT_COLUMN_WIDTH);
	});

	it('the default `minWidth` is the smaller of the width and 120', () => {
		expect(normalizeColumn('a', { value, width: 300 }).minWidth).toBe(DEFAULT_COLUMN_WIDTH);
		expect(normalizeColumn('b', { value, width: 60 }).minWidth).toBe(60);
	});

	it('an explicit `minWidth` wins', () => {
		expect(normalizeColumn('a', { value, width: 300, minWidth: 40 }).minWidth).toBe(40);
	});

	it('every right is off by default', () => {
		const column = normalizeColumn('a', { value });

		expect(column.sortable).toBe(false);
		expect(column.resizable).toBe(false);
		expect(column.movable).toBe(false);
		expect(column.hideable).toBe(false);
		expect(column.pinnable).toBe(false);
	});

	it('`flex`, `align` and `hiddenByDefault` get defaults', () => {
		const column = normalizeColumn('a', { value });

		expect(column.flex).toBe(0);
		expect(column.align).toBe('left');
		expect(column.hiddenByDefault).toBe(false);
	});

	it('`meta` moves to the column as the same reference', () => {
		const meta = { kind: 'price' };

		expect(normalizeColumn('a', { value, meta }).meta).toBe(meta);
	});

	it('the name comes as an argument, not from the declaration', () => {
		expect(normalizeColumn('price', { value }).name).toBe('price');
	});

	it('`maxWidth` without a value stays `undefined`', () => {
		expect(normalizeColumn('a', { value }).maxWidth).toBeUndefined();
	});

	it('a column holds data unless it says it is a service column', () => {
		expect(normalizeColumn('a', { value }).kind).toBe('data');
		expect(normalizeColumn('b', { value, kind: 'service' }).kind).toBe('service');
	});

	it('`rowHeader` stays as given, `undefined` without it', () => {
		expect(normalizeColumn('a', { value }).rowHeader).toBeUndefined();
		expect(normalizeColumn('b', { value, rowHeader: true }).rowHeader).toBe(true);
	});

	it('zero and empty values are not replaced by defaults', () => {
		const column = normalizeColumn('a', { value, width: 0, flex: 0, minWidth: 0 });

		expect(column.width).toBe(0);
		expect(column.minWidth).toBe(0);
	});
});

describe('reconcileColumns', () => {
	const price = normalizeColumn('price', { value, width: 120 });
	const cap = normalizeColumn('cap', { value, width: 140 });

	it('the first set on top of an empty one is built anew, but from the same objects', () => {
		const next = [price, cap];
		const result = reconcileColumns([], next);

		expect(result).not.toBe(next);
		expect(result).toEqual(next);
		expect(result[0]).toBe(price);
	});

	it('a recreated object with the same fields returns the previous set', () => {
		const current = [price, cap];
		const next = [normalizeColumn('price', { value, width: 120 }), normalizeColumn('cap', { value, width: 140 })];

		expect(reconcileColumns(current, next)).toBe(current);
	});

	it('a changed column comes as a new object, an unchanged one as the previous one', () => {
		const current = [price, cap];
		const next = [normalizeColumn('price', { value, width: 200 }), normalizeColumn('cap', { value, width: 140 })];

		const result = reconcileColumns(current, next);

		expect(result).not.toBe(current);
		expect(result[0]).toBe(next[0]);
		expect(result[1]).toBe(cap);
	});

	it('a recreated `value` function counts as a change', () => {
		const current = [price];
		const next = [normalizeColumn('price', { value: () => 0, width: 120 })];

		expect(reconcileColumns(current, next)[0]).toBe(next[0]);
	});

	it('a recreated `format` function counts as a change', () => {
		const withFormat = normalizeColumn('price', { value, format: () => '' });
		const next = [normalizeColumn('price', { value, format: () => '' })];

		expect(reconcileColumns([withFormat], next)[0]).toBe(next[0]);
	});

	it('the same `format` function does not count as a change', () => {
		const format = () => '';
		const current = [normalizeColumn('price', { value, format })];
		const next = [normalizeColumn('price', { value, format })];

		expect(reconcileColumns(current, next)).toBe(current);
	});

	it('`normalizeColumn` keeps fields the core does not know, such as those of `ColumnExtension`', () => {
		const cell = () => null;
		const input = { value, cell };

		expect(normalizeColumn('price', input)).toMatchObject({ name: 'price', cell });
	});

	it('a changed field unknown to the core counts as a change', () => {
		const current = [{ ...normalizeColumn('price', { value }), hint: 'Last price' }];
		const next = [{ ...normalizeColumn('price', { value }), hint: 'Close price' }];

		expect(reconcileColumns(current, next)[0]).toBe(next[0]);
	});

	it('the same field unknown to the core does not count as a change', () => {
		const current = [{ ...normalizeColumn('price', { value }), hint: 'Last price' }];
		const next = [{ ...normalizeColumn('price', { value }), hint: 'Last price' }];

		expect(reconcileColumns(current, next)).toBe(current);
	});

	it('a new field unknown to the core counts as a change', () => {
		const current = [normalizeColumn('price', { value })];
		const next = [{ ...normalizeColumn('price', { value }), hint: 'Last price' }];

		expect(reconcileColumns(current, next)[0]).toBe(next[0]);
	});

	it('a rebuilt `meta` with the same values does not count as a change', () => {
		const current = [normalizeColumn('price', { value, meta: { kind: 'price', digits: 2 } })];
		const next = [normalizeColumn('price', { value, meta: { kind: 'price', digits: 2 } })];

		expect(reconcileColumns(current, next)).toBe(current);
	});

	it('a changed value in `meta` is caught', () => {
		const current = [normalizeColumn('price', { value, meta: { kind: 'price', digits: 2 } })];
		const next = [normalizeColumn('price', { value, meta: { kind: 'price', digits: 4 } })];

		expect(reconcileColumns(current, next)[0]).toBe(next[0]);
	});

	it('`meta` is compared one level deep: a nested object by reference', () => {
		const current = [normalizeColumn('price', { value, meta: { format: { digits: 2 } } })];
		const next = [normalizeColumn('price', { value, meta: { format: { digits: 2 } } })];

		expect(reconcileColumns(current, next)[0]).toBe(next[0]);
	});

	it('a `meta` that is not a plain object is compared by reference', () => {
		const current = [normalizeColumn('price', { value, meta: new Map([['kind', 'price']]) })];
		const next = [normalizeColumn('price', { value, meta: new Map([['kind', 'price']]) })];

		expect(reconcileColumns(current, next)[0]).toBe(next[0]);
	});

	it('reordering the same columns gives a new array of the previous objects', () => {
		const current = [price, cap];
		const result = reconcileColumns(current, [cap, price]);

		expect(result).not.toBe(current);
		expect(result[0]).toBe(cap);
		expect(result[1]).toBe(price);
	});

	it('an added column breaks set equality but not the references of the others', () => {
		const volume = normalizeColumn('volume', { value });
		const current = [price, cap];
		const result = reconcileColumns(current, [price, cap, volume]);

		expect(result).not.toBe(current);
		expect(result[0]).toBe(price);
		expect(result[2]).toBe(volume);
	});

	it('a removed column breaks set equality', () => {
		const current = [price, cap];

		expect(reconcileColumns(current, [price])).not.toBe(current);
	});

	it('a column renamed to another does not inherit the previous reference', () => {
		const renamed = normalizeColumn('cost', { value, width: 120 });

		expect(reconcileColumns([price], [renamed])[0]).toBe(renamed);
	});

	it('an empty set on top of an empty one returns the previous reference', () => {
		const current: readonly AnyColumn[] = [];

		expect(reconcileColumns(current, [])).toBe(current);
	});

	it('a difference only in rights is caught', () => {
		const current = [normalizeColumn('price', { value })];
		const next = [normalizeColumn('price', { value, sortable: true })];

		expect(reconcileColumns(current, next)[0]).toBe(next[0]);
	});
});

describe('resolveRowHeaders', () => {
	const data = (name: string, rowHeader?: boolean) => ({ name, kind: 'data' as const, rowHeader });
	const service = (name: string) => ({ name, kind: 'service' as const });

	it('the first data column is the row header by default, service columns skipped', () => {
		expect([...resolveRowHeaders([service('select'), data('symbol'), data('price')])]).toEqual(['symbol']);
	});

	it('columns with `rowHeader: true` are the row headers, and the default is off', () => {
		expect([...resolveRowHeaders([data('symbol'), data('name', true), data('code', true)])]).toEqual(['name', 'code']);
	});

	it('`rowHeader: false` on the first data column leaves none', () => {
		expect(resolveRowHeaders([data('symbol', false), data('price')]).size).toBe(0);
	});

	it('a table of service columns only has no row header', () => {
		expect(resolveRowHeaders([service('select')]).size).toBe(0);
	});
});

describe('toColumnList', () => {
	const price = normalizeColumn('price', { value });
	const cap = normalizeColumn('cap', { value });

	it('an array is returned as the same reference', () => {
		const columns = [price, cap];

		expect(toColumnList(columns)).toBe(columns);
	});

	it('an object by name is turned into its values in key order', () => {
		expect(toColumnList({ price, cap })).toEqual([price, cap]);
		expect(toColumnList({ cap, price })).toEqual([cap, price]);
	});

	it('an empty object gives an empty array', () => {
		expect(toColumnList({})).toEqual([]);
	});
});

describe('toRuntimeColumn', () => {
	it('returns the same object: only the type erasure is lifted', () => {
		const column = normalizeColumn('price', { value });

		expect(toRuntimeColumn(column)).toBe(column);
	});
});

describe('normalizeColumn — row handling', () => {
	it('`format`, `compare`, `sortOrder` and `aggregate` move over as they are', () => {
		const format = (input: number) => `${input}`;
		const compare = (a: number, b: number) => a - b;
		const column = normalizeColumn('a', { value, format, compare, sortOrder: ['asc'], aggregate: 'sum' });

		expect(column).toMatchObject({ format, compare, sortOrder: ['asc'], aggregate: 'sum' });
	});
});

describe('getCellText', () => {
	const row = { price: 1.5, missing: null };

	it('through the column `format`', () => {
		const column = normalizeColumn('price', {
			value: (input: typeof row) => input.price,
			format: (price: number, input: typeof row) => `${price.toFixed(2)}/${input.price}`,
		});

		expect(getCellText(column, row)).toBe('1.50/1.5');
	});

	it('without `format`: as a string, empty values as an empty string', () => {
		expect(getCellText(normalizeColumn('price', { value: (input: typeof row) => input.price }), row)).toBe('1.5');
		expect(getCellText(normalizeColumn('missing', { value: (input: typeof row) => input.missing }), row)).toBe('');
	});
});
