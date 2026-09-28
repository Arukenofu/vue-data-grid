import {
	type ChangeStep,
	type ColumnAggregates,
	defineColumn,
	defineColumns,
	type GridSort,
	type RowGroup,
	type RowNode,
	type RowSelection,
	useGridColumnsState,
} from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, shallowRef } from 'vue';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { editing, fill, grouping, history, navigation, ranges, selection, sorting, tree } from '../../src/data-grid/factories';
import type { GridRowsFeature } from '../../src/data-grid/features';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';

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

/** Runs `create` in the setup of a mounted component, as a grid must be. */
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

describe('useDataGrid — the pipeline', () => {
	it('without features renders the rows as they come, and header clicks only change the sort', () => {
		const grid = inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30 }));

		grid.scope.toggleSort('cap', false);

		expect(grid.state.sort.value).toEqual([{ name: 'cap', direction: 'desc' }]);
		expect(ids(grid.rows.value)).toEqual(['a', 'b', 'c']);
		expect(grid.tree).toBeUndefined();
	});

	it('sorting sorts by the state', () => {
		const grid = inSetup(() => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			sort: [{ name: 'cap', direction: 'asc' }],
			features: { sorting: sorting() },
		}));

		expect(ids(grid.rows.value)).toEqual(['b', 'c', 'a']);
	});

	it('a tree flattens the rows and sorts every level by the state', () => {
		const grid = inSetup(() => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			sort: [{ name: 'id', direction: 'desc' }],
			features: { tree: tree({ parentKey: 'parent', defaultExpanded: -1 }) },
		}));

		expect(ids(grid.rows.value)).toEqual(['b', 'a', 'c']);
		expect(grid.tree.nodes.value.map(node => node.level)).toEqual([0, 0, 1]);

		grid.tree.toggle('a');

		expect(ids(grid.rows.value)).toEqual(['b', 'a']);
	});

	it('grouping feeds the tree, with aggregates typed by the columns', () => {
		const createGroup = (group: RowGroup<Row, ColumnAggregates<typeof columns>>): Row => ({
			id: group.key,
			sector: String(group.value),
			cap: group.aggregates.cap ?? 0,
			children: [...group.children],
		});
		const grid = inSetup(() => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				grouping: grouping({ by: [columns.sector], createGroup }),
				tree: tree({ childrenField: 'children', defaultExpanded: 1, sort: false }),
			},
		}));

		expect(grid.rows.value.map(row => [row.id, row.cap])).toEqual([
			['group:sector=tech', 5],
			['a', 3],
			['c', 2],
			['group:sector=energy', 1],
			['b', 1],
		]);
	});

	it('selection follows the tree: a group selects the leaves under it, and rows say so', () => {
		const grid = inSetup(() => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				tree: tree({ parentKey: 'parent', defaultExpanded: -1 }),
				selection: selection(),
			},
		}));

		grid.selection.toggle('a');

		expect(grid.selection.selectedKeys.value).toEqual(['c']);
		expect(grid.getGridProps()).toMatchObject({ role: 'treegrid', 'aria-multiselectable': true });
		expect(grid.getRowProps({ index: 0, key: 'a' })).toMatchObject({ 'aria-selected': true, 'aria-expanded': true });
	});
});

describe('useDataGrid — markup', () => {
	it('sizes the body to the row window and places every row below the measured header', async () => {
		const grid = inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30 }));

		const head = document.createElement('div');

		Object.defineProperty(head, 'offsetHeight', { value: 36 });
		grid.head.value = head;
		await nextTick();

		expect(grid.getBodyProps()).toMatchObject({ 'data-dg-part': 'body', style: { height: '90px' } });

		// Row offsets count from the top of the scroll content, header included: the first row stands at 0.
		const [first, second] = grid.items.value;

		expect(first.start).toBe(36);
		expect(grid.getRowProps(first).style).toEqual({ top: '0px', height: '30px' });
		expect(grid.getRowProps(second).style).toEqual({ top: '30px', height: '30px' });
	});

	it('without a header row leaves it out of the row count and the row indexes', () => {
		const withHeader = inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30 }));
		const withoutHeader = inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30, header: false }));

		expect(withHeader.getGridProps()['aria-rowcount']).toBe(4);
		expect(withoutHeader.getGridProps()['aria-rowcount']).toBe(3);
		expect(withHeader.getRowProps(withHeader.items.value[0])['aria-rowindex']).toBe(2);
		expect(withoutHeader.getRowProps(withoutHeader.items.value[0])['aria-rowindex']).toBe(1);
	});

	it('with rows in flow neither the body nor the rows get geometry', () => {
		const grid = inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30, rowLayout: 'flow' }));

		expect(grid.getBodyProps()).not.toHaveProperty('style');
		expect(grid.getRowProps(grid.items.value[0])).not.toHaveProperty('style');
	});

	it('the navigation puts cells in the roving tab order and takes the grid\'s sections', () => {
		const exit = shallowRef<HTMLElement | null>(null);
		const grid = inSetup(() => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: { navigation: navigation({ exit }) },
		}));

		expect(grid.getCellProps(grid.scope.columns.value[0]).tabindex).toBe(-1);
		expect(grid.navigation.focused.value).toBeNull();
	});
});

describe('useDataGrid — types', () => {
	it('types each feature handle, and a missing feature as `undefined`', () => {
		const grid = inSetup(() => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				tree: tree({ parentKey: 'parent' }),
				selection: selection(),
			},
		}));

		expectTypeOf(grid.tree.nodes.value).toEqualTypeOf<readonly RowNode[]>();
		expectTypeOf(grid.selection.toggle).toBeFunction();
		expectTypeOf(grid.sorting).toBeUndefined();
		expectTypeOf(grid.rows.value).toEqualTypeOf<readonly Row[]>();
	});

	it('names the handles of a grid in one object, the others as any grid has them', () => {
		const grid = inSetup(() => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				tree: tree({ parentKey: 'parent' }),
				selection: selection(),
			},
		}));

		function takeSelected(selected: DataGrid<Row, { selection: RowSelection }>) {
			return selected.selection.selectedKeys.value;
		}

		function takeAny(any: DataGrid) {
			return any.selection?.isSelected('a');
		}

		expectTypeOf(takeSelected(grid)).toEqualTypeOf<readonly string[]>();
		// A grid with any features fits a component that takes any grid.
		expectTypeOf(takeAny(grid)).toEqualTypeOf<boolean | undefined>();
		expectTypeOf<DataGrid<Row, { selection: RowSelection }>['sorting']>().toEqualTypeOf<GridRowsFeature<Row> | undefined>();
		expect(grid.getNodeAt(0)?.key).toBe('a');
	});

	it('checks feature options against the row type', () => {
		inSetup(() => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			// @ts-expect-error `nope` is not a field of the row
			features: { tree: tree({ parentKey: 'nope' }) },
		}));
	});

	it('infers the row of a factory from the grid: a commit gives the rows back as they are', () => {
		const source = shallowRef(rows);
		const grid = inSetup(() => useDataGrid({
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

		expectTypeOf(grid.editing.cell.value?.row).toEqualTypeOf<Row | undefined>();
		expectTypeOf(grid.history.steps.value).toEqualTypeOf<readonly ChangeStep[]>();
		expectTypeOf(grid.fill.fillDown).toBeFunction();
		expectTypeOf(grid.navigation).toBeUndefined();
	});

	it('types the aggregates of a group built inline by the columns of the grid', () => {
		inSetup(() => useDataGrid({
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

		expect(() => inSetup(() => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: {
				editing: editing({ onCommit: () => undefined }),
				// @ts-expect-error `fill` needs `ranges`
				fill: fill(),
			},
		}))).toThrow('useGridFill() needs the `ranges` and the `editing`');
		expect(() => inSetup(() => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			// @ts-expect-error `history` needs `editing`
			features: { history: history() },
		}))).toThrow('useGridHistory() needs the `editing`');
		warn.mockRestore();
	});

	it('says what is missing, not that every feature is wrong', () => {
		// @ts-expect-error `rowHeight` is missing
		inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', features: { sorting: sorting(), navigation: navigation() } }));
	});

	it('takes a state of its own or the options of one, not both', () => {
		const state = useGridColumnsState();

		// @ts-expect-error `sort` is an option of the state, which is given
		inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30, state, sort: [] }));
		inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30, state }));
	});

	it('checks the names of the initial sort against the columns', () => {
		inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30, sort: [{ name: 'cap', direction: 'desc' }] }));
		// @ts-expect-error `nope` is not a column
		inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30, sort: [{ name: 'nope', direction: 'desc' }] }));
	});

	it('takes a sort model with any names, and any names with columns in an array', () => {
		const sort = shallowRef<readonly GridSort[]>([{ name: 'cap', direction: 'desc' }]);
		const listed = Object.values(columns);

		inSetup(() => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30, sort }));
		inSetup(() => useDataGrid({ columns: listed, rows, rowKey: 'id', rowHeight: 30, sort: [{ name: 'cap', direction: 'asc' }] }));
	});

	it('takes a function of your own in place of a factory, typed by the grid', () => {
		const grid = inSetup(() => useDataGrid({
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

		expectTypeOf(grid.sorting.rows.value).toEqualTypeOf<readonly Row[]>();
	});
});
