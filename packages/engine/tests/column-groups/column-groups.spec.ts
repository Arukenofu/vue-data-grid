import { describe, expect, it } from 'vitest';

import {
	type ColumnGroup,
	getGroupDepth,
	type GroupCellDraft,
	isCollapsibleGroup,
	keepsGroupsTogether,
	resolveCollapsedColumns,
	resolveGroupPaths,
	resolveGroupRows,
} from '../../src/column-groups/column-groups';
import type { ColumnPinSide, RenderedColumn, RuntimeColumn } from '../../src/columns/column';

function group(name: string, children: string[]): ColumnGroup {
	return { name, children };
}

function column(name: string, index: number, pin?: ColumnPinSide): RenderedColumn {
	return {
		column: { name } as RuntimeColumn,
		key: name,
		index,
		pin,
		cellProps: {},
		headerProps: {},
	};
}

function spacer(side: ColumnPinSide): RenderedColumn {
	return { column: null, key: `dg-spacer-${side}`, index: -1, spacer: side, cellProps: {}, headerProps: {} };
}

function describeCell(cell: GroupCellDraft) {
	const label = cell.spacer ? `~${cell.spacer.spacer}` : cell.group?.name ?? '∅';

	return `${label}:${cell.columns.map(item => item.column?.name).join(',')}`;
}

const describeRows = (rows: GroupCellDraft[][]) => rows.map(row => row.map(describeCell));

const PRICE = group('price', ['last', 'change']);
const BOOK = group('book', ['bid', 'ask']);
const MARKET = group('market', ['price', 'book']);

describe('resolveGroupPaths', () => {
	it('the path of a column goes from the outer group to the inner one', () => {
		const paths = resolveGroupPaths([MARKET, PRICE, BOOK]);

		expect(paths.get('last')?.map(item => item.name)).toEqual(['market', 'price']);
		expect(paths.get('ask')?.map(item => item.name)).toEqual(['market', 'book']);
	});

	it('group names in `children` do not count as columns', () => {
		const paths = resolveGroupPaths([MARKET, PRICE, BOOK]);

		expect(paths.has('price')).toBe(false);
		expect(paths.has('book')).toBe(false);
	});

	it('a column in two groups stays in the first one', () => {
		const paths = resolveGroupPaths([group('a', ['x']), group('b', ['x'])]);

		expect(paths.get('x')?.map(item => item.name)).toEqual(['a']);
	});

	it('a cycle of groups does not hang', () => {
		const paths = resolveGroupPaths([group('a', ['b', 'x']), group('b', ['a'])]);

		expect(paths.get('x')?.map(item => item.name)).toEqual(['b', 'a']);
	});

	it('the depth is the longest path', () => {
		expect(getGroupDepth(resolveGroupPaths([MARKET, PRICE, BOOK]))).toBe(2);
		expect(getGroupDepth(resolveGroupPaths([]))).toBe(0);
	});
});

describe('resolveGroupRows', () => {
	const paths = resolveGroupPaths([MARKET, PRICE, BOOK]);
	const depth = getGroupDepth(paths);

	it('neighbouring columns of one group share a cell, levels go from the top', () => {
		const visible = ['symbol', 'last', 'change', 'bid', 'ask'].map((name, index) => column(name, index));

		expect(describeRows(resolveGroupRows(visible, visible, paths, depth))).toEqual([
			['∅:symbol', 'market:last,change,bid,ask'],
			['∅:symbol', 'price:last,change', 'book:bid,ask'],
		]);
	});

	it('pinning cuts a group into two cells', () => {
		const visible = [column('last', 0, 'start'), column('change', 1), column('bid', 2)];
		const rows = resolveGroupRows(visible, visible, paths, depth);

		expect(describeRows(rows)[1]).toEqual(['price:last', 'price:change', 'book:bid']);
		expect(rows[1][0].pin).toBe('start');
	});

	it('a cut group knows it continues past the edge of the cell', () => {
		const visible = [column('last', 0, 'start'), column('change', 1)];
		const [, [start, end]] = resolveGroupRows(visible, visible, paths, depth);

		expect(start.continues).toEqual({ start: false, end: true });
		expect(end.continues).toEqual({ start: true, end: false });
	});

	it('a column-window spacer stands in every row and cuts the group', () => {
		const visible = [column('last', 0), column('change', 1), column('bid', 2), column('ask', 3)];
		const rendered = [column('last', 0), spacer('end')];
		const rows = resolveGroupRows(visible, rendered, paths, depth);

		expect(describeRows(rows)).toEqual([['market:last', '~end:'], ['price:last', '~end:']]);
		expect(rows[1][0].continues).toEqual({ start: false, end: true });
	});

	it('empty space under different groups does not merge into one cell', () => {
		const shallow = resolveGroupPaths([
			group('top', ['a', 'b']),
			group('deep', ['c']),
			group('outer', ['deep', 'd']),
		]);
		const visible = [column('a', 0), column('b', 1), column('d', 2), column('c', 3)];

		expect(describeRows(resolveGroupRows(visible, visible, shallow, getGroupDepth(shallow)))).toEqual([
			['top:a,b', 'outer:d,c'],
			['∅:a,b', '∅:d', 'deep:c'],
		]);
	});

	it('without groups there are no rows', () => {
		const visible = [column('a', 0)];

		expect(resolveGroupRows(visible, visible, new Map(), 0)).toEqual([]);
	});
});

describe('resolveCollapsedColumns', () => {
	const detail: ColumnGroup = {
		name: 'detail',
		children: ['bid', 'ask'],
		showWhen: { ask: 'expanded' },
	};
	const quote: ColumnGroup = {
		name: 'quote',
		children: ['last', 'total', 'detail'],
		showWhen: { total: 'collapsed', detail: 'expanded' },
	};
	const paths = resolveGroupPaths([quote, detail]);

	const collapsed = (...names: string[]) => (item: ColumnGroup) => names.includes(item.name);

	it('expanded groups hide only `collapsed` children', () => {
		expect([...resolveCollapsedColumns(paths, collapsed())]).toEqual(['total']);
	});

	it('a collapsed group hides `expanded` children with everything under them', () => {
		expect([...resolveCollapsedColumns(paths, collapsed('quote'))].sort()).toEqual(['ask', 'bid']);
	});

	it('a nested group collapses on its own', () => {
		expect([...resolveCollapsedColumns(paths, collapsed('detail'))].sort()).toEqual(['ask', 'total']);
	});
});

describe('isCollapsibleGroup', () => {
	it('only a group with entries in `showWhen` collapses', () => {
		expect(isCollapsibleGroup({ children: [], showWhen: { a: 'expanded' } })).toBe(true);
		expect(isCollapsibleGroup({ children: [], showWhen: {} })).toBe(false);
		expect(isCollapsibleGroup({ children: [] })).toBe(false);
	});
});

describe('keepsGroupsTogether', () => {
	const pair: ColumnGroup = { name: 'pair', children: ['b', 'c'], keepTogether: true };
	const paths = resolveGroupPaths([pair]);

	it('a move inside the group or past it is allowed', () => {
		expect(keepsGroupsTogether(paths, ['a', 'b', 'c', 'd'], ['a', 'c', 'b', 'd'])).toBe(true);
		expect(keepsGroupsTogether(paths, ['a', 'b', 'c', 'd'], ['b', 'c', 'a', 'd'])).toBe(true);
	});

	it('another column between children, or a child outside the group, is not allowed', () => {
		expect(keepsGroupsTogether(paths, ['a', 'b', 'c', 'd'], ['b', 'a', 'c', 'd'])).toBe(false);
		expect(keepsGroupsTogether(paths, ['a', 'b', 'c', 'd'], ['a', 'c', 'd', 'b'])).toBe(false);
	});

	it('a move does not have to join a group that is already cut', () => {
		expect(keepsGroupsTogether(paths, ['b', 'a', 'c', 'd'], ['b', 'a', 'd', 'c'])).toBe(true);
	});

	it('a group without `keepTogether` does not get in the way', () => {
		const loose = resolveGroupPaths([{ name: 'loose', children: ['b', 'c'] }]);

		expect(keepsGroupsTogether(loose, ['a', 'b', 'c'], ['b', 'a', 'c'])).toBe(true);
	});
});
