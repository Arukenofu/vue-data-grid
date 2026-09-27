import { h } from 'vue';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { toColumnList } from '../../src/columns/column';
import { defineColumn, defineColumns } from '../../src/columns/define-columns';

interface Row {
	id: string;
	price: number;
}

describe('defineColumns', () => {
	it('the column name comes from the key', () => {
		const columns = defineColumns({ price: { value: (row: Row) => row.price } });

		expect(columns.price.name).toBe('price');
	});

	it('defaults are filled in', () => {
		const columns = defineColumns({ price: { value: (row: Row) => row.price } });

		expect(columns.price.width).toBe(120);
		expect(columns.price.minWidth).toBe(120);
		expect(columns.price.flex).toBe(0);
		expect(columns.price.align).toBe('left');
		expect(columns.price.sortable).toBe(false);
	});

	it('a column without `width` starts at its `minWidth` when that is wider than the default', () => {
		const columns = defineColumns({
			wide: { value: (row: Row) => row.id, flex: 1, minWidth: 220 },
			narrow: { value: (row: Row) => row.id, minWidth: 40 },
			capped: { value: (row: Row) => row.id, maxWidth: 90 },
		});

		expect(columns.wide.width).toBe(220);
		expect(columns.narrow.width).toBe(120);
		expect(columns.capped.width).toBe(90);
	});

	it('given fields are not overwritten', () => {
		const columns = defineColumns({
			price: { value: (row: Row) => row.price, width: 300, align: 'right', sortable: true },
		});

		expect(columns.price.width).toBe(300);
		expect(columns.price.align).toBe('right');
		expect(columns.price.sortable).toBe(true);
	});

	it('extra fields of the declaration survive normalization', () => {
		const columns = defineColumns({
			price: { value: (row: Row) => row.price, icon: 'coin', format: (n: number) => `$${n}` },
		});

		expect(columns.price.icon).toBe('coin');
		expect(columns.price.format(7)).toBe('$7');
	});

	it('key order is kept', () => {
		const columns = defineColumns({
			symbol: { value: (row: Row) => row.id },
			price: { value: (row: Row) => row.price },
		});

		expect(toColumnList(columns).map(column => column.name)).toEqual(['symbol', 'price']);
	});

	it('the result is frozen', () => {
		const columns = defineColumns({ price: { value: (row: Row) => row.price } });

		expect(Object.isFrozen(columns)).toBe(true);
	});

	it('functions are carried over by reference', () => {
		const value = (row: Row) => row.price;
		const cell = () => h('i');
		const columns = defineColumns({ price: { value, cell } });

		expect(columns.price.value).toBe(value);
		expect(columns.price.cell).toBe(cell);
	});

	it('an empty declaration gives an empty set', () => {
		expect(toColumnList(defineColumns({}))).toEqual([]);
	});

	it('every call gives new objects: that is what `reconcileColumns` is for', () => {
		const value = (row: Row) => row.price;

		expect(defineColumns({ price: { value } }).price).not.toBe(defineColumns({ price: { value } }).price);
	});

	it('`minWidth` of a narrow column drops to its width', () => {
		const columns = defineColumns({ narrow: { value: (row: Row) => row.id, width: 40 } });

		expect(columns.narrow.minWidth).toBe(40);
	});
});

describe('defineColumn', () => {
	it('the builder puts the value and the rest into one declaration', () => {
		const column = defineColumn<Row>();
		const declared = column(row => row.price, { width: 200, sortable: true });

		expect(declared.width).toBe(200);
		expect(declared.sortable).toBe(true);
		expect(declared.value({ id: 'a', price: 7 })).toBe(7);
	});

	it('without the rest it returns a declaration with the value only', () => {
		const column = defineColumn<Row>();

		expect(Object.keys(column(row => row.price))).toEqual(['value']);
	});

	it('builder declarations fit into `defineColumns`', () => {
		const column = defineColumn<Row>();
		const columns = defineColumns({
			symbol: column(row => row.id),
			price: column(row => row.price, { align: 'right' }),
		});

		expect(columns.price.align).toBe('right');
		expect(columns.symbol.name).toBe('symbol');
	});
});

describe('defineColumn — defaults', () => {
	it('every column of the builder starts with the defaults and can override them', () => {
		const column = defineColumn<Row>({ sortable: true, resizable: true, width: 90, sortOrder: ['asc', 'desc'] });
		const columns = defineColumns({
			id: column(row => row.id),
			price: column(row => row.price, { resizable: false, width: 140 }),
		});

		expect(columns.id).toMatchObject({ sortable: true, resizable: true, width: 90, sortOrder: ['asc', 'desc'] });
		expect(columns.price).toMatchObject({ sortable: true, resizable: false, width: 140 });
	});
});

describe('defineColumn — aggregate type', () => {
	const column = defineColumn<Row>();

	it('the builder keeps the name of the aggregate in the column type', () => {
		expectTypeOf(column(row => row.price, { aggregate: 'avg' }).aggregate).toEqualTypeOf<'avg' | undefined>();
		expectTypeOf(column(row => row.price).aggregate).toEqualTypeOf<undefined>();
	});

	it('typed columns still fit into `defineColumns`', () => {
		const columns = defineColumns({
			price: column(row => row.price, { aggregate: 'avg' }),
			id: column(row => row.id, { aggregate: values => values.length }),
		});

		expect(columns.price.aggregate).toBe('avg');
	});
});
