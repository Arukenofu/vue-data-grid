import {
	defineColumnGroups,
	defineColumns,
	type GridScope,
	type RangeRect,
	type RowNode,
	useGridColumnsState,
	useGridEngine,
	useRowSelection,
	useRowTree,
} from '@vue-data-grid/engine';
import { defineComponent, h, shallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type GridPropsOptions, useGridProps } from '../../src/props/use-grid-props';

interface Row {
	id: string;
	price: number;
	parent?: string;
}

const columns = defineColumns({
	symbol: { value: (row: Row) => row.id, width: 100, pinnable: true },
	price: { value: (row: Row) => row.price, width: 100, sortable: true },
	cap: { value: (row: Row) => row.price * 2, width: 100, sortable: true },
	note: { value: (row: Row) => String(row.price), width: 100 },
});

const rows: Row[] = [
	{ id: 'a', price: 1 },
	{ id: 'b', price: 2 },
	{ id: 'c', price: 3, parent: 'a' },
];

interface Setup {
	scope: GridScope<Row>;
	props: ReturnType<typeof useGridProps>;
	state: ReturnType<typeof useGridColumnsState>;
	list: ReturnType<typeof shallowRef<Row[]>>;
	unmount: () => void;
}

interface SetupOptions {
	props?: (scope: GridScope<Row>) => GridPropsOptions;
	grouped?: boolean;
}

function setup(options: SetupOptions = {}): Setup {
	let result: Omit<Setup, 'unmount'> | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			const list = shallowRef(rows);
			const state = useGridColumnsState({ multiSort: true });
			const groups = options.grouped
				? defineColumnGroups({ quote: { children: ['price', 'cap'] } })
				: undefined;
			const { scope } = useGridEngine<Row>({
				columns,
				groups,
				rows: list,
				root: shallowRef(null),
				rowKey: 'id',
				rowHeight: 30,
				state,
			});

			result = { scope, props: useGridProps(scope, options.props?.(scope)), state, list };

			return () => h('div');
		},
	}));

	return { ...(result as unknown as Omit<Setup, 'unmount'>), unmount: () => wrapper.unmount() };
}

let current: Setup | null = null;

afterEach(() => {
	current?.unmount();
	current = null;
});

function rendered(name: string) {
	const item = current?.scope.columns.value.find(column => column.column?.name === name);

	if (!item) {
		throw new Error(`no column ${name}`);
	}

	return item;
}

describe('useGridProps — rows', () => {
	it('counts rows from the top of the header, group rows included', () => {
		current = setup({ grouped: true, props: () => ({ footerRows: 1 }) });

		const { props } = current;

		expect(props.headerRows.value).toBe(2);
		expect(props.getGridProps()).toMatchObject({ role: 'grid', 'aria-rowcount': 6, 'aria-colcount': 4 });
		expect(props.getGroupRowProps(0)).toEqual({
			role: 'row',
			'data-dg-part': 'row',
			'aria-rowindex': 1,
			'data-dg-grid-section': 'group-0',
			'data-dg-grid-row': 0,
		});
		expect(props.getHeaderRowProps()).toMatchObject({ role: 'row', 'aria-rowindex': 2, 'data-dg-grid-section': 'head' });
		expect(props.getRowProps({ index: 0, key: 'a' })).toMatchObject({ 'aria-rowindex': 3 });
		expect(props.getFooterRowProps()).toMatchObject({ 'aria-rowindex': 6, 'data-dg-grid-section': 'foot' });
	});

	it('a body row carries the index attribute and the navigation attributes in one set', () => {
		current = setup({ props: () => ({ indexAttribute: 'data-row' }) });

		expect(current.props.getRowProps({ index: 1, key: 'b' })).toEqual({
			role: 'row',
			'data-dg-part': 'row',
			'aria-rowindex': 3,
			'data-row': 1,
			'data-dg-grid-section': 'body',
			'data-dg-grid-row': 1,
		});
	});

	it('an unknown number of rows gives `aria-rowcount="-1"`', () => {
		current = setup({ props: () => ({ rowCount: -1 }) });

		expect(current.props.getGridProps()['aria-rowcount']).toBe(-1);
	});

	it('counts body rows on from `rowIndexOffset`, as the rows of a later page', () => {
		current = setup({ props: () => ({ rowCount: 120, rowIndexOffset: 80, footerRows: 1 }) });

		expect(current.props.getRowProps({ index: 0, key: 'a' })['aria-rowindex']).toBe(82);
		expect(current.props.getRowProps({ index: 2, key: 'c' })['aria-rowindex']).toBe(84);
		expect(current.props.getGridProps()['aria-rowcount']).toBe(122);
		expect(current.props.getFooterRowProps()['aria-rowindex']).toBe(122);
	});

	it('counts the footer on from the rows of the page when the size of the whole set is unknown', () => {
		current = setup({ props: () => ({ rowCount: -1, rowIndexOffset: 80, footerRows: 1 }) });

		expect(current.props.getRowProps({ index: 2, key: 'c' })['aria-rowindex']).toBe(84);
		expect(current.props.getFooterRowProps()['aria-rowindex']).toBe(85);
	});

	it('warns once when `rowIndexOffset` counts rows past `rowCount`', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		current = setup({ props: () => ({ rowIndexOffset: 80 }) });
		current.props.getGridProps();
		current.props.getGridProps();

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('`rowIndexOffset` counts rows past `rowCount`');
		warn.mockRestore();
	});

	it('without a header row the body starts at the first row', () => {
		current = setup({ props: () => ({ header: false }) });

		expect(current.props.getRowProps({ index: 0, key: 'a' })['aria-rowindex']).toBe(1);
		expect(current.props.sections.value.map(section => section.name)).toEqual(['body']);
	});
});

describe('useGridProps — parts for the structural styles', () => {
	it('the grid, its blocks and its rows name their part', () => {
		current = setup();

		expect(current.props.getGridProps()['data-dg-part']).toBe('grid');
		expect(current.props.getHeadProps()).toEqual({ role: 'rowgroup', 'data-dg-part': 'head' });
		expect(current.props.getFootProps()).toEqual({ role: 'rowgroup', 'data-dg-part': 'foot' });
		expect(current.props.getRowProps({ index: 0, key: 'a' })['data-dg-part']).toBe('row');
	});

	it('the body says how its rows are laid out: positioned by default', () => {
		current = setup();
		expect(current.props.getBodyProps()['data-dg-row-layout']).toBe('positioned');

		current.unmount();
		current = setup({ props: () => ({ rowLayout: 'flow' }) });
		expect(current.props.getBodyProps()['data-dg-row-layout']).toBe('flow');
	});

	it('block and inset props are frozen objects that never change', () => {
		current = setup();

		expect(current.props.getBodyProps()).toBe(current.props.getBodyProps());
		expect(current.props.getInsetCellProps('start')).toEqual({ role: 'presentation', 'data-dg-inset': 'start' });
		expect(Object.isFrozen(current.props.getInsetCellProps('end'))).toBe(true);
	});
});

describe('useGridProps — cell ranges', () => {
	function createRect(start: number, end: number): RangeRect {
		const scope = current?.scope as GridScope<Row>;

		return {
			bounds: { rowStart: 1, rowEnd: 3, columnStart: start, columnEnd: end },
			top: 30,
			height: 60,
			cells: scope.getColumnSpan(start, end),
		};
	}

	it('a range is a row over the body at its rows, hidden from screen readers', () => {
		current = setup();

		expect(current.props.getRangeProps(createRect(1, 3))).toEqual({
			'data-dg-part': 'range',
			'aria-hidden': 'true',
			style: 'top:30px;height:60px',
		});
	});

	it('only the cells in the range are the `range-cell` part; the others keep their place and nothing else', () => {
		current = setup();

		const [before, inside, after] = createRect(1, 3).cells.map(current.props.getRangeCellProps);

		expect(inside).toMatchObject({ 'data-dg-part': 'range-cell', 'data-dg-columns': 'price cap' });
		expect(inside['data-dg-continues']).toBeUndefined();
		expect(before['data-dg-part']).toBeUndefined();
		expect(after).toBe(createRect(1, 3).cells[2].props);
	});

	it('a range cut by a pin says which sides go on, and the props are the same object for the same cell', () => {
		current = setup();
		current.scope.pinColumn('symbol', 'start');

		const cells = createRect(0, 2).cells;
		const [pinned, middle] = cells.map(current.props.getRangeCellProps);

		expect(pinned['data-dg-continues']).toBe('end');
		expect(middle['data-dg-continues']).toBe('start');
		expect(current.props.getRangeCellProps(cells[0])).toBe(pinned);
	});
});

describe('useGridProps — trees and selection', () => {
	let getNodes: () => readonly RowNode[] = () => [];

	function withTree() {
		const result = setup({
			props: (scope) => {
				const tree = useRowTree({ rows: scope.rows, rowKey: 'id', parentKey: 'parent', defaultExpanded: -1 });
				const selection = useRowSelection({ rows: scope.rows, rowKey: 'id', canSelect: key => key !== 'b' });

				selection.toggle('c');
				getNodes = () => tree.nodes.value;

				return { nodes: tree.nodes, selection };
			},
		});

		// The grid shows the rows in the order of the tree, so a row's index is its node's.
		result.list.value = [rows[0], rows[2], rows[1]];

		return result;
	}

	it('a tree makes the grid a treegrid, and rows carry their level and place', () => {
		current = withTree();

		expect(current.props.getGridProps()).toMatchObject({ role: 'treegrid', 'aria-multiselectable': true });
		expect(current.scope.rowKeys.value).toEqual(getNodes().map(node => node.key));
		expect(current.props.getRowProps({ index: 0, key: 'a' })).toMatchObject({
			'aria-level': 1,
			'aria-posinset': 1,
			'aria-setsize': 2,
			'aria-expanded': true,
		});
	});

	it('a row given its node reads that node, not `nodes`', () => {
		current = withTree();

		const leaf = getNodes()[1];

		expect(current.props.getRowProps({ index: 0, key: 'a', node: leaf })).toMatchObject({ 'aria-level': 2 });
		expect(current.props.getRowProps({ index: 0, key: 'a', node: leaf })).not.toHaveProperty('aria-expanded');
	});

	it('only a row that can expand gets `aria-expanded`', () => {
		current = withTree();

		expect(current.props.getRowProps({ index: 1, key: 'c' })).not.toHaveProperty('aria-expanded');
		expect(current.props.getRowProps({ index: 1, key: 'c' })).toMatchObject({ 'aria-level': 2 });
	});

	it('rows get `aria-selected` from the selection, except those it cannot select', () => {
		current = withTree();

		expect(current.props.getRowProps({ index: 1, key: 'c' })['aria-selected']).toBe(true);
		expect(current.props.getRowProps({ index: 0, key: 'a' })['aria-selected']).toBe(false);
		expect(current.props.getRowProps({ index: 2, key: 'b' })).not.toHaveProperty('aria-selected');
	});

	it('a static table has no selection or navigation attributes on its cells', () => {
		const nodes: readonly RowNode[] = [];

		current = setup({
			props: scope => ({ role: 'table', nodes, selection: useRowSelection({ rows: scope.rows, rowKey: 'id' }) }),
		});

		expect(current.props.getGridProps()['aria-multiselectable']).toBeUndefined();
		expect(current.props.getRowProps({ index: 0, key: 'a' })).not.toHaveProperty('aria-selected');
		expect(current.props.getCellProps(rendered('price'), { selected: true })).not.toHaveProperty('aria-selected');
		expect(current.props.getCellProps(rendered('price')).role).toBe('cell');
	});
});

describe('useGridProps — cells', () => {
	it('a cell gets its role and `aria-colindex` over the core props, one frozen object for all rows', () => {
		current = setup();

		const price = rendered('price');
		const props = current.props.getCellProps(price);

		expect(props).toMatchObject({ ...price.cellProps, role: 'gridcell', 'aria-colindex': 2 });
		expect(current.props.getCellProps(price)).toBe(props);
		expect(Object.isFrozen(props)).toBe(true);
	});

	it('the row header column gets `role="rowheader"`', () => {
		current = setup();

		expect(current.props.getCellProps(rendered('symbol')).role).toBe('rowheader');
	});

	it('`navigation` puts cells and header cells in the roving tab order', () => {
		current = setup({ props: () => ({ navigation: true }) });

		expect(current.props.getCellProps(rendered('price')).tabindex).toBe(-1);
		expect(current.props.getHeaderCellProps(rendered('price')).tabindex).toBe(-1);
		expect(current.props.getHeaderCellProps(rendered('note')).tabindex).toBe(-1);
	});

	it('without navigation a header cell with keys is tabbable, one without is not', () => {
		current = setup();

		expect(current.props.getHeaderCellProps(rendered('price')).tabindex).toBe(0);
		expect(current.props.getHeaderCellProps(rendered('note')).tabindex).toBeUndefined();
	});

	it('a cell selection gets `aria-selected` on a copy, leaving the shared object alone', () => {
		current = setup();

		const shared = current.props.getCellProps(rendered('price'));
		const selected = current.props.getCellProps(rendered('price'), { selected: true });

		expect(selected).toMatchObject({ ...shared, 'aria-selected': true });
		expect(shared).not.toHaveProperty('aria-selected');
	});

	it('selected and unselected cell props are one frozen object each, for every row', () => {
		current = setup();

		const selected = current.props.getCellProps(rendered('price'), { selected: true });
		const unselected = current.props.getCellProps(rendered('price'), { selected: false });

		expect(current.props.getCellProps(rendered('price'), { selected: true })).toBe(selected);
		expect(current.props.getCellProps(rendered('price'), { selected: false })).toBe(unselected);
		expect(unselected['aria-selected']).toBe(false);
		expect(Object.isFrozen(selected)).toBe(true);
	});

	it('`cellSelection` makes the grid multiselectable', () => {
		current = setup({ props: () => ({ cellSelection: true }) });

		expect(current.props.getGridProps()['aria-multiselectable']).toBe(true);
	});

	it('`aria-colindex` follows a column that moved', () => {
		current = setup();

		const before = current.props.getCellProps(rendered('note'));

		current.state.layout.value = { order: ['note', 'symbol', 'price', 'cap'], hidden: [], widths: {}, pinned: {} };

		expect(before['aria-colindex']).toBe(4);
		expect(current.props.getCellProps(rendered('note'))['aria-colindex']).toBe(1);
	});
});

describe('useGridProps — headers', () => {
	it('in a multi-sort only the first column gets `aria-sort`', () => {
		current = setup();
		current.scope.toggleSort('price', true);
		current.scope.toggleSort('cap', true);

		expect(current.props.getHeaderCellProps(rendered('price'))['aria-sort']).toBe('descending');
		expect(current.props.getHeaderCellProps(rendered('cap'))['aria-sort']).toBeUndefined();

		current.scope.toggleSort('price', true);

		expect(current.props.getHeaderCellProps(rendered('price'))['aria-sort']).toBe('ascending');
	});

	it('a group cell gets `aria-colindex` and `aria-colspan`', () => {
		current = setup({ grouped: true });

		const [cells] = current.scope.headerGroups.value;
		const quote = cells.find(cell => cell.group?.name === 'quote');

		expect(quote && current.props.getGroupCellProps(quote)).toMatchObject({
			role: 'columnheader',
			'aria-colindex': 2,
			'aria-colspan': 2,
		});
	});

	it('a header of a column without a group spans the group row above it; one in a group does not', () => {
		current = setup({ grouped: true });

		expect(current.props.getHeaderCellProps(rendered('symbol'))['data-dg-rowspan']).toBe(2);
		expect(current.props.getHeaderCellProps(rendered('price'))['data-dg-rowspan']).toBeUndefined();
	});

	it('without groups no header spans', () => {
		current = setup();

		expect(current.props.getHeaderCellProps(rendered('symbol'))['data-dg-rowspan']).toBeUndefined();
	});
});

describe('useGridProps — sections', () => {
	it('gives the sections of the navigation, the same array while they hold', () => {
		current = setup({ props: () => ({ footerRows: 1 }) });

		const before = current.props.sections.value;

		expect(before.map(section => [section.name, section.rows])).toEqual([['head', 1], ['body', 3], ['foot', 1]]);

		current.list.value = [...rows].reverse();
		expect(current.props.sections.value).toBe(before);

		current.list.value = rows.slice(0, 2);
		expect(current.props.sections.value).not.toBe(before);
		expect(current.props.sections.value[0].cells).toBe(before[0].cells);
	});

	it('puts the group rows of the header first, their empty cells passed over by the keys', () => {
		current = setup({ grouped: true, props: () => ({ navigation: true }) });

		const [groups, head] = current.props.sections.value;

		expect(groups).toEqual({
			name: 'group-0',
			rows: 1,
			cells: [{ key: 'symbol', span: 1, skip: true }, { key: 'price', span: 2 }, { key: 'note', span: 1, skip: true }],
		});
		expect(head.name).toBe('head');
	});

	it('gives the cells of a group their place in the navigation, and focus only to a group', () => {
		current = setup({ grouped: true, props: () => ({ navigation: true }) });

		const [empty, quote] = current.scope.headerGroups.value[0];

		expect(current.props.getGroupCellProps(quote)).toMatchObject({ 'data-dg-grid-cell': 'price', tabindex: -1 });
		expect(current.props.getGroupCellProps(empty)).toMatchObject({ 'data-dg-grid-cell': 'symbol' });
		expect(current.props.getGroupCellProps(empty).tabindex).toBeUndefined();
	});
});
