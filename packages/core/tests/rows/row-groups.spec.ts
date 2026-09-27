import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { type ColumnAggregates, toColumnList } from '../../src/columns/column';
import { defineColumn, defineColumns } from '../../src/columns/define-columns';
import { buildRowGroups, groupRows, type RowGroup } from '../../src/rows/row-groups';

interface Row {
	id: string;
	sector: string;
	country: string;
	cap: number;
	children?: Row[];
}

const columns = defineColumns({
	sector: { value: (row: Row) => row.sector },
	country: { value: (row: Row) => row.country },
	cap: { value: (row: Row) => row.cap, aggregate: 'sum' },
});

const createGroup = (group: RowGroup<Row, ColumnAggregates<typeof columns>>): Row => ({
	id: group.key,
	sector: group.name === 'sector' ? String(group.value) : '',
	country: group.name === 'country' ? String(group.value) : '',
	cap: group.aggregates.cap ?? 0,
	children: [...group.children],
});

const rows: Row[] = [
	{ id: 'aapl', sector: 'tech', country: 'us', cap: 30 },
	{ id: 'xom', sector: 'energy', country: 'us', cap: 5 },
	{ id: 'sap', sector: 'tech', country: 'de', cap: 2 },
	{ id: 'msft', sector: 'tech', country: 'us', cap: 28 },
];

const byLevels = (...levels: ('sector' | 'country')[]) => ({
	by: levels.map(name => columns[name]),
	columns,
	createGroup,
});

describe('groupRows', () => {
	it('groups come in the order values first appear, leaves in input order', () => {
		const groups = groupRows(rows, byLevels('sector'));

		expect(groups.map(group => group.sector)).toEqual(['tech', 'energy']);
		expect(groups[0].children?.map(row => row.id)).toEqual(['aapl', 'sap', 'msft']);
	});

	it('aggregates are computed over the leaves of the group', () => {
		const [tech, energy] = groupRows(rows, byLevels('sector'));

		expect(tech.cap).toBe(60);
		expect(energy.cap).toBe(5);
	});

	it('levels nest, and the top aggregate covers all leaves rather than the subgroups', () => {
		const [tech] = groupRows(rows, byLevels('sector', 'country'));

		expect(tech.children?.map(group => group.country)).toEqual(['us', 'de']);
		expect(tech.children?.[0].children?.map(row => row.id)).toEqual(['aapl', 'msft']);
		expect(tech.cap).toBe(60);
	});

	it('the group key is the path from the root', () => {
		const [tech] = groupRows(rows, byLevels('sector', 'country'));

		expect(tech.id).toBe('group:sector=tech');
		expect(tech.children?.[0].id).toBe('group:sector=tech/group:country=us');
	});

	it('different values with the same string get different keys', () => {
		const level = { name: 'box', value: (row: Row) => ({ sector: row.sector }) };
		const groups = groupRows(rows.slice(0, 2), { by: [level], columns, createGroup });

		expect(new Set(groups.map(group => group.id)).size).toBe(2);
	});

	it('dates with the same time form one group', () => {
		const level = { name: 'day', value: () => new Date('2026-09-22') };

		expect(groupRows(rows, { by: [level], columns, createGroup })).toHaveLength(1);
	});

	it('without levels the rows pass as they are', () => {
		expect(groupRows(rows, { by: [], columns, createGroup })).toEqual(rows);
	});
});

describe('buildRowGroups — previous pass', () => {
	it('a group with no changed leaves comes back as the same object, a group above a changed one as a new one', () => {
		const first = buildRowGroups(rows, byLevels('sector'));
		const changed = rows.map(row => (row.id === 'xom' ? { ...row, cap: 6 } : row));
		const second = buildRowGroups(changed, byLevels('sector'), first.cache);

		expect(second.rows[0]).toBe(first.rows[0]);
		expect(second.rows[1]).not.toBe(first.rows[1]);
		expect(second.rows[1].cap).toBe(6);
	});
});

describe('buildRowGroups — aggregates merged from subgroups', () => {
	const many: Row[] = Array.from({ length: 40 }, (_, index) => ({
		id: `r${index}`,
		sector: index % 2 === 0 ? 'tech' : 'energy',
		country: `c${index % 4}`,
		cap: index,
	}));

	it('a top-level `avg` is the average of all leaves, not an average of averages', () => {
		const avg = defineColumns({ cap: { value: (row: Row) => row.cap, aggregate: 'avg' } });
		const uneven: Row[] = [
			{ id: 'a', sector: 'tech', country: 'us', cap: 1 },
			{ id: 'b', sector: 'tech', country: 'us', cap: 2 },
			{ id: 'c', sector: 'tech', country: 'de', cap: 9 },
		];
		const [tech] = groupRows(uneven, { by: [columns.sector, columns.country], columns: avg, createGroup });

		expect(tech.cap).toBe(4);
	});

	it('`min`, `max` and `count` agree with a flat pass over the leaves', () => {
		const picks = defineColumns({
			min: { value: (row: Row) => row.cap, aggregate: 'min' },
			max: { value: (row: Row) => row.id, aggregate: 'max' },
			count: { value: (row: Row) => row.cap, aggregate: 'count' },
		});
		const seen: Record<string, unknown>[] = [];

		groupRows(many, {
			by: [columns.sector, columns.country],
			columns: picks,
			createGroup: (group) => {
				seen.push({ key: group.key, ...group.aggregates });

				return { id: group.key, sector: '', country: '', cap: 0, children: [...group.children] };
			},
		});

		expect(seen.find(group => group.key === 'group:sector=tech')).toMatchObject({ min: 0, max: 'r38', count: 20 });
	});

	it('a changed leaf is read again only in its own bottom group', () => {
		const value = vi.fn((row: Row) => row.cap);
		const counted = defineColumns({ cap: { value, aggregate: 'sum' } });
		const options = { by: [columns.sector, columns.country], columns: counted, createGroup };
		const first = buildRowGroups(many, options);

		value.mockClear();

		const changed = many.map(row => (row.id === 'r0' ? { ...row, cap: 100 } : row));
		const second = buildRowGroups(changed, options, first.cache);

		expect(value).toHaveBeenCalledTimes(10);
		expect(second.rows[0].cap).toBe(first.rows[0].cap + 100);
	});
});

describe('group aggregates — types', () => {
	interface Quote {
		symbol: string;
		price: number;
	}

	const column = defineColumn<Quote>();

	const typed = defineColumns({
		symbol: column(row => row.symbol),
		total: column(row => row.price, { aggregate: 'sum' }),
		top: column(row => row.symbol, { aggregate: 'max' }),
		rows: column(row => row.price, { aggregate: 'count' }),
		any: column(row => row.price, { aggregate: values => values.some(value => value > 0) }),
	});

	it('are typed by each column\'s `aggregate`, and columns without one are left out', () => {
		expectTypeOf<ColumnAggregates<typeof typed>>().toEqualTypeOf<{
			readonly total: number | null;
			readonly top: string | null;
			readonly rows: number;
			readonly any: boolean;
		}>();
	});

	it('reach `createGroup` from the columns given', () => {
		groupRows([{ symbol: 'a', price: 1 }], {
			by: [typed.symbol],
			columns: typed,
			createGroup: (group) => {
				expectTypeOf(group.aggregates.total).toEqualTypeOf<number | null>();

				return { symbol: String(group.value), price: group.aggregates.total ?? 0 };
			},
		});
	});

	it('are a record of `unknown` for columns given as an array', () => {
		expectTypeOf<ColumnAggregates<ReturnType<typeof toColumnList>>>()
			.toEqualTypeOf<Readonly<Record<string, unknown>>>();
	});
});
