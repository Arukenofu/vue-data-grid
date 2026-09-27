import {
	type ChangeStep,
	type ColumnAggregates,
	defineColumn,
	defineColumns,
	type RowGroup,
	type RowNode,
	type RowSelection,
	useTableColumnsState,
} from '@vue-stack/table-core';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, shallowRef } from 'vue';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { editing, fill, grouping, history, navigation, ranges, selection, sorting, tree } from '../../src/data-table/factories';
import type { TableRowsFeature } from '../../src/data-table/features';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';

interface Row {
	id: string;
	sector: string;
	cap: number;
	parent?: string;
	children?: Row[];
}

const column = defineColumn<Row>({ sortable: true });

const columns = defineColumns({
	id: column(row => row.id, { sortOrder: ['asc', 'desc'] }),
	sector: column(row => row.sector),
	cap: column(row => row.cap, { aggregate: 'sum' }),
});

const rows: Row[] = [
	{ id: 'a', sector: 'tech', cap: 3 },
	{ id: 'b', sector: 'energy', cap: 1 },
	{ id: 'c', sector: 'tech', cap: 2, parent: 'a' },
];

let unmount: (() => void) | null = null;

afterEach(() => {
	unmount?.();
	unmount = null;
});

/** Runs `create` in the setup of a mounted component, as a table must be. */
function inSetup<TResult>(create: () => TResult): TResult {
	let result: TResult | null = null;
	const wrapper = mount(defineComponent({
		setup() {
			result = create();

			return () => h('div');
		},
	}));

	unmount = () => wrapper.unmount();

	return result as unknown as TResult;
}

const ids = (list: readonly Row[]) => list.map(row => row.id);

describe('useDataTable — the pipeline', () => {
	it('without features renders the rows as they come, and header clicks only change the sort', () => {
		const table = inSetup(() => useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30 }));

		table.scope.toggleSort('cap', false);

		expect(table.state.sort.value).toEqual([{ name: 'cap', direction: 'desc' }]);
		expect(ids(table.rows.value)).toEqual(['a', 'b', 'c']);
		expect(table.tree).toBeUndefined();
	});

	it('sorting sorts by the state', () => {
		const table = inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			sort: [{ name: 'cap', direction: 'asc' }],
			features: { sorting: sorting() },
		}));

		expect(ids(table.rows.value)).toEqual(['b', 'c', 'a']);
	});

	it('a tree flattens the rows and sorts every level by the state', () => {
		const table = inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			sort: [{ name: 'id', direction: 'desc' }],
			features: { tree: tree({ parentKey: 'parent', defaultExpanded: -1 }) },
		}));

		expect(ids(table.rows.value)).toEqual(['b', 'a', 'c']);
		expect(table.tree.nodes.value.map(node => node.level)).toEqual([0, 0, 1]);

		table.tree.toggle('a');

		expect(ids(table.rows.value)).toEqual(['b', 'a']);
	});

	it('grouping feeds the tree, with aggregates typed by the columns', () => {
		const createGroup = (group: RowGroup<Row, ColumnAggregates<typeof columns>>): Row => ({
			id: group.key,
			sector: String(group.value),
			cap: group.aggregates.cap ?? 0,
			children: [...group.children],
		});
		const table = inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				grouping: grouping({ by: [columns.sector], createGroup }),
				tree: tree({ childrenField: 'children', defaultExpanded: 1, sort: false }),
			},
		}));

		expect(table.rows.value.map(row => [row.id, row.cap])).toEqual([
			['group:sector=tech', 5],
			['a', 3],
			['c', 2],
			['group:sector=energy', 1],
			['b', 1],
		]);
	});

	it('selection follows the tree: a group selects the leaves under it, and rows say so', () => {
		const table = inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				tree: tree({ parentKey: 'parent', defaultExpanded: -1 }),
				selection: selection(),
			},
		}));

		table.selection.toggle('a');

		expect(table.selection.selectedKeys.value).toEqual(['c']);
		expect(table.getGridProps()).toMatchObject({ role: 'treegrid', 'aria-multiselectable': true });
		expect(table.getRowProps({ index: 0, key: 'a' })).toMatchObject({ 'aria-selected': true, 'aria-expanded': true });
	});
});

describe('useDataTable — markup', () => {
	it('sizes the body to the row window and places every row below the measured header', async () => {
		const table = inSetup(() => useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30 }));

		const head = document.createElement('div');

		Object.defineProperty(head, 'offsetHeight', { value: 36 });
		table.head.value = head;
		await nextTick();

		expect(table.getBodyProps()).toMatchObject({ 'data-tc-part': 'body', style: { height: '90px' } });

		// Row offsets count from the top of the scroll content, header included: the first row stands at 0.
		const [first, second] = table.items.value;

		expect(first.start).toBe(36);
		expect(table.getRowProps(first).style).toEqual({ top: '0px', height: '30px' });
		expect(table.getRowProps(second).style).toEqual({ top: '30px', height: '30px' });
	});

	it('with rows in flow neither the body nor the rows get geometry', () => {
		const table = inSetup(() => useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30, rowLayout: 'flow' }));

		expect(table.getBodyProps()).not.toHaveProperty('style');
		expect(table.getRowProps(table.items.value[0])).not.toHaveProperty('style');
	});

	it('the navigation puts cells in the roving tab order and takes the table\'s sections', () => {
		const exit = shallowRef<HTMLElement | null>(null);
		const table = inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: { navigation: navigation({ exit }) },
		}));

		expect(table.getCellProps(table.scope.columns.value[0]).tabindex).toBe(-1);
		expect(table.navigation.focused.value).toBeNull();
	});
});

describe('useDataTable — types', () => {
	it('types each feature handle, and a missing feature as `undefined`', () => {
		const table = inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				tree: tree({ parentKey: 'parent' }),
				selection: selection(),
			},
		}));

		expectTypeOf(table.tree.nodes.value).toEqualTypeOf<readonly RowNode[]>();
		expectTypeOf(table.selection.toggle).toBeFunction();
		expectTypeOf(table.sorting).toBeUndefined();
		expectTypeOf(table.rows.value).toEqualTypeOf<readonly Row[]>();
	});

	it('names the handles of a table in one object, the others as any table has them', () => {
		const table = inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				tree: tree({ parentKey: 'parent' }),
				selection: selection(),
			},
		}));

		function takeSelected(selected: DataTable<Row, { selection: RowSelection }>) {
			return selected.selection.selectedKeys.value;
		}

		function takeAny(any: DataTable) {
			return any.selection?.isSelected('a');
		}

		expectTypeOf(takeSelected(table)).toEqualTypeOf<readonly string[]>();
		// A table with any features fits a component that takes any table.
		expectTypeOf(takeAny(table)).toEqualTypeOf<boolean | undefined>();
		expectTypeOf<DataTable<Row, { selection: RowSelection }>['sorting']>().toEqualTypeOf<TableRowsFeature<Row> | undefined>();
		expect(table.getNodeAt(0)?.key).toBe('a');
	});

	it('checks feature options against the row type', () => {
		inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			// @ts-expect-error `nope` is not a field of the row
			features: { tree: tree({ parentKey: 'nope' }) },
		}));
	});

	it('infers the row of a factory from the table: a commit gives the rows back as they are', () => {
		const source = shallowRef(rows);
		const table = inSetup(() => useDataTable({
			columns,
			rows: source,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				ranges: ranges(),
				editing: editing({
					onCommit: (commit) => {
						expectTypeOf(commit.apply(source.value)).toEqualTypeOf<readonly Row[]>();
						source.value = [...commit.apply(source.value)];
					},
				}),
				history: history(),
				fill: fill(),
			},
		}));

		expectTypeOf(table.editing.cell.value?.row).toEqualTypeOf<Row | undefined>();
		expectTypeOf(table.history.steps.value).toEqualTypeOf<readonly ChangeStep[]>();
		expectTypeOf(table.fill.fillDown).toBeFunction();
		expectTypeOf(table.navigation).toBeUndefined();
	});

	it('types the aggregates of a group built inline by the columns of the table', () => {
		inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				grouping: grouping({
					by: [columns.sector],
					createGroup: (group) => {
						expectTypeOf(group.aggregates.cap).toEqualTypeOf<number | null>();

						return { id: group.key, sector: String(group.value), cap: 0, children: [...group.children] };
					},
				}),
			},
		}));
	});

	it('refuses a feature without the features it needs, as a type error and at once', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		expect(() => inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				editing: editing({ onCommit: () => undefined }),
				// @ts-expect-error `fill` needs `ranges`
				fill: fill(),
			},
		}))).toThrow('useTableFill() needs the `ranges` and the `editing`');
		expect(() => inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			// @ts-expect-error `history` needs `editing`
			features: { history: history() },
		}))).toThrow('useTableHistory() needs the `editing`');
		warn.mockRestore();
	});

	it('says what is missing, not that every feature is wrong', () => {
		// @ts-expect-error `rowHeight` is missing
		inSetup(() => useDataTable({ columns, rows, rowKey: 'id', features: { sorting: sorting(), navigation: navigation() } }));
	});

	it('takes a state of its own or the options of one, not both', () => {
		const state = useTableColumnsState();

		// @ts-expect-error `sort` is an option of the state, which is given
		inSetup(() => useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30, state, sort: [] }));
		inSetup(() => useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30, state }));
	});

	it('takes a function of your own in place of a factory, typed by the table', () => {
		const table = inSetup(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				sorting: (current) => {
					expectTypeOf(current.rows.value).toEqualTypeOf<readonly Row[]>();

					return { rows: current.rows };
				},
			},
		}));

		expectTypeOf(table.sorting.rows.value).toEqualTypeOf<readonly Row[]>();
	});
});
