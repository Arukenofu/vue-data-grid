import { computed, defineComponent, h, inject, nextTick, type Ref, shallowRef, watch } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defineColumnGroups } from '../../src/column-groups/define-column-groups';
import { type ColumnsInput, toColumnList } from '../../src/columns/column';
import { defineColumns } from '../../src/columns/define-columns';
import { useTableColumnsState } from '../../src/columns/use-table-columns-state';
import { TABLE_SCOPE } from '../../src/engine/scope';
import { type TableEngineOptions, useTableEngine } from '../../src/engine/use-table-engine';
import { createTableScopeContext } from '../../src/engine/use-table-scope-context';
import { FLEX_CELL_STYLES, getColumnSelector } from '../../src/render/geometry';
import { createScroller, type Frames, stubAnimationFrames } from '../support/dom';

interface Row {
	id: string;
	price: number;
}

const columns = defineColumns({
	symbol: { value: (row: Row) => row.id, width: 200, movable: true, hideable: true, pinnable: true },
	price: { value: (row: Row) => row.price, width: 120, resizable: true, hideable: true, sortable: true },
	cap: { value: (row: Row) => row.price * 2, width: 140, hideable: true, sortable: true },
});

const rows: Row[] = [
	{ id: 'a', price: 1 },
	{ id: 'b', price: 2 },
	{ id: 'c', price: 3 },
];

type Engine = ReturnType<typeof useTableEngine>;

interface Mounted {
	engine: Engine;
	root: Ref<HTMLElement | null>;
	unmount: () => void;
}

function setup(options: Partial<TableEngineOptions<Row>> = {}): Mounted {
	let engine: Engine | null = null;
	const root = shallowRef<HTMLElement | null>(null);

	const wrapper = mount(defineComponent({
		setup() {
			engine = useTableEngine({
				columns: () => columns,
				rows: () => rows,
				root,
				rowKey: 'id',
				rowHeight: 36,
				...options,
			});

			return () => h('div');
		},
	}));

	return { engine: engine as unknown as Engine, root, unmount: () => wrapper.unmount() };
}

let mounted: Mounted | null = null;

afterEach(() => {
	mounted?.unmount();
	mounted = null;
	vi.unstubAllGlobals();
	document.body.innerHTML = '';
});

describe('useTableEngine — what it builds', () => {
	it('returns a scope with columns in declaration order', () => {
		mounted = setup();

		expect(mounted.engine.scope.columns.value.map(column => column.column?.name))
			.toEqual(['symbol', 'price', 'cap']);
	});

	it('does not provide the scope itself: that is what `createTableScopeContext` is for', () => {
		const injected: unknown[] = [];

		const child = defineComponent({
			setup() {
				injected.push(inject(TABLE_SCOPE, null));

				return () => null;
			},
		});

		function mountWith(provided: boolean) {
			return mount(defineComponent({
				setup() {
					const { scope } = useTableEngine({
						columns: () => columns,
						rows: () => rows,
						root: shallowRef(null),
						rowKey: 'id',
						rowHeight: 36,
					});

					if (provided) {
						createTableScopeContext(scope);
					}

					return () => h(child);
				},
			}));
		}

		mountWith(false).unmount();
		mountWith(true).unmount();

		expect(injected[0]).toBeNull();
		expect(injected[1]).not.toBeNull();
	});

	it('creates its own state when none is passed', () => {
		mounted = setup();

		expect(mounted.engine.state.layout.value).toBeNull();
		expect(typeof mounted.engine.state.reset).toBe('function');
	});

	it('returns the passed state as the same object', () => {
		const state = useTableColumnsState({ multiSort: true });

		mounted = setup({ state });

		expect(mounted.engine.state).toBe(state);
	});

	it('passes rows to the scope as they are', () => {
		mounted = setup();

		expect(mounted.engine.scope.rows.value).toBe(rows);
	});
});

describe('useTableEngine — window options', () => {
	it('without `virtual` both windows are off and defaults are filled in', () => {
		mounted = setup();

		expect(mounted.engine.virtual.value).toEqual({
			rows: false,
			columns: false,
			overscan: 6,
			bufferPx: 200,
			ssrRows: 24,
		});
	});

	it('`virtual: true` turns both windows on', () => {
		mounted = setup({ virtual: () => true });

		expect(mounted.engine.virtual.value.rows).toBe(true);
		expect(mounted.engine.virtual.value.columns).toBe(true);
	});

	it('an object turns the windows on separately', () => {
		mounted = setup({ virtual: () => ({ rows: true, columns: false, overscan: 2 }) });

		expect(mounted.engine.virtual.value.rows).toBe(true);
		expect(mounted.engine.virtual.value.columns).toBe(false);
		expect(mounted.engine.virtual.value.overscan).toBe(2);
	});

	it('an empty object turns both windows on: it means yes, with defaults', () => {
		mounted = setup({ virtual: () => ({}) });

		expect(mounted.engine.virtual.value.rows).toBe(true);
		expect(mounted.engine.virtual.value.columns).toBe(true);
	});
});

describe('useTableEngine — row height', () => {
	it('by default every row has the same height', () => {
		mounted = setup();

		expect(mounted.engine.uniformHeight.value).toBe(36);
	});

	it('a ref of a number becomes the uniform height and follows it', () => {
		const height = shallowRef(48);

		mounted = setup({ rowHeight: height });
		expect(mounted.engine.uniformHeight.value).toBe(48);

		height.value = 28;
		expect(mounted.engine.uniformHeight.value).toBe(28);
	});

	it('a function is a height function of the row, never a getter', () => {
		mounted = setup({ rowHeight: row => (row.price > 1 ? 60 : 30) });

		expect(mounted.engine.uniformHeight.value).toBeNull();
		expect(mounted.engine.items.value.map(item => item.size)).toEqual([30, 60, 60]);
	});

	it('measuring in the DOM cancels the uniform height', () => {
		mounted = setup({ rowHeight: 48, measureRows: () => true });

		expect(mounted.engine.uniformHeight.value).toBeNull();
	});

	it('`getRowOffset` is where a row stands by the heights above it, clamped to the list', () => {
		mounted = setup({ rowHeight: row => (row.price > 1 ? 60 : 30) });

		const { getRowOffset } = mounted.engine.scope;

		expect([0, 1, 2, 3].map(getRowOffset)).toEqual([0, 30, 90, 150]);
		expect(getRowOffset(-1)).toBe(0);
		expect(getRowOffset(10)).toBe(150);
	});
});

describe('useTableEngine — column spans', () => {
	it('`getColumnSpan` splits the row around the span and styles it by the columns under it', () => {
		mounted = setup();

		const cells = mounted.engine.scope.getColumnSpan(1, 2);

		expect(cells.map(cell => [cell.columns, cell.inside])).toEqual([
			[['symbol'], false],
			[['price'], true],
			[['cap'], false],
		]);
		expect(cells[1].props.style).toContain('var(--tc-width-price, 120px)');
	});

	it('returns the same array while the geometry holds, and a new one when it changes', () => {
		const insets = shallowRef({ start: 0, end: 0 });

		mounted = setup({ insets: () => insets.value });

		const { scope } = mounted.engine;
		const first = scope.getColumnSpan(0, 2);

		expect(scope.getColumnSpan(0, 2)).toBe(first);

		scope.pinColumn('symbol', 'start');

		const pinned = scope.getColumnSpan(0, 2);

		expect(pinned).not.toBe(first);
		expect(pinned[0]).toMatchObject({ columns: ['symbol'], pin: 'start', continues: { start: false, end: true } });

		insets.value = { start: 44, end: 0 };

		expect(scope.getColumnSpan(0, 2)[0].key).toBe('tc-inset-start');
	});
});

describe('useTableEngine — row window off', () => {
	it('renders every row without the window', () => {
		mounted = setup();

		expect(mounted.engine.items.value).toHaveLength(rows.length);
		expect(mounted.engine.items.value.map(item => item.index)).toEqual([0, 1, 2]);
	});

	it('`rowRange` covers the whole list', () => {
		mounted = setup();

		expect(mounted.engine.scope.rowRange.value).toEqual({ start: 0, end: 3 });
	});

	it('an empty list gives an empty range', () => {
		mounted = setup({ rows: () => [] });

		expect(mounted.engine.scope.rowRange.value).toEqual({ start: 0, end: 0 });
	});

	it('row keys come from `rowKey`', () => {
		mounted = setup();

		expect(mounted.engine.items.value.map(item => item.key)).toEqual(['a', 'b', 'c']);
	});

	it('`rowKey` can be a function too', () => {
		mounted = setup({ rowKey: row => `row-${row.id}` });

		expect(mounted.engine.items.value.map(item => item.key)).toEqual(['row-a', 'row-b', 'row-c']);
	});
});

describe('useTableEngine — column window', () => {
	it('without the window `renderedColumns` is the same array as the columns', () => {
		mounted = setup();

		expect(mounted.engine.scope.renderedColumns.value).toBe(mounted.engine.scope.columns.value);
		expect(mounted.engine.windowed.value).toBe(false);
	});
});

describe('useTableEngine — sorting', () => {
	it('the first click sets desc, the second asc, the third clears the sort', () => {
		mounted = setup();

		const { scope } = mounted.engine;

		scope.toggleSort('price', false);
		expect(scope.getSortDirection('price')).toBe('desc');

		scope.toggleSort('price', false);
		expect(scope.getSortDirection('price')).toBe('asc');

		scope.toggleSort('price', false);
		expect(scope.getSortDirection('price')).toBeUndefined();
	});

	it('a column that is not `sortable` does not sort from a header gesture', () => {
		const state = useTableColumnsState();

		mounted = setup({ state });
		mounted.engine.scope.toggleSort('symbol', false);

		expect(state.sort.value).toEqual([]);

		state.sort.value = [{ name: 'symbol', direction: 'asc' }];

		expect(mounted.engine.scope.getSortDirection('symbol')).toBe('asc');
	});

	it('directions come from `sortOrder` of the column', () => {
		mounted = setup({
			columns: () => defineColumns({
				name: { value: (row: Row) => row.id, sortable: true, sortOrder: ['asc', 'desc'] },
			}),
		});

		const { scope } = mounted.engine;

		scope.toggleSort('name', false);
		expect(scope.getSortDirection('name')).toBe('asc');

		scope.toggleSort('name', false);
		expect(scope.getSortDirection('name')).toBe('desc');
	});

	it('without multi-sort, additive does not accumulate columns', () => {
		mounted = setup();

		mounted.engine.scope.toggleSort('price', true);
		mounted.engine.scope.toggleSort('cap', true);

		expect(mounted.engine.scope.sort.value.map(item => item.name)).toEqual(['cap']);
	});

	it('multi-sort from the state accumulates columns', () => {
		mounted = setup({ state: useTableColumnsState({ multiSort: true }) });

		mounted.engine.scope.toggleSort('price', true);
		mounted.engine.scope.toggleSort('cap', true);

		expect(mounted.engine.scope.sort.value.map(item => item.name)).toEqual(['price', 'cap']);
	});

	it('multi-sort can be switched on at runtime through the state', () => {
		const state = useTableColumnsState({ multiSort: false });

		mounted = setup({ state });
		mounted.engine.scope.toggleSort('price', true);
		mounted.engine.scope.toggleSort('cap', true);

		expect(mounted.engine.scope.sort.value.map(item => item.name)).toEqual(['cap']);

		state.multiSort.value = true;
		mounted.engine.scope.toggleSort('price', true);

		expect(mounted.engine.scope.multiSort.value).toBe(true);
		expect(mounted.engine.scope.sort.value.map(item => item.name)).toEqual(['cap', 'price']);
	});

	it('the multi-sort position is 1-based and appears only from the second column', () => {
		mounted = setup({ state: useTableColumnsState({ multiSort: true }) });

		mounted.engine.scope.toggleSort('price', true);
		expect(mounted.engine.scope.getSortIndex('price')).toBeUndefined();

		mounted.engine.scope.toggleSort('cap', true);
		expect(mounted.engine.scope.getSortIndex('price')).toBe(1);
		expect(mounted.engine.scope.getSortIndex('cap')).toBe(2);
	});

	it('a column that does not sort has an `undefined` position', () => {
		mounted = setup();

		expect(mounted.engine.scope.getSortIndex('symbol')).toBeUndefined();
	});

	it('a hidden column stops sorting', () => {
		mounted = setup();

		mounted.engine.scope.toggleSort('price', false);
		mounted.engine.scope.toggleColumn('price');

		expect(mounted.engine.scope.sort.value).toEqual([]);
	});

	it('showing the column again does not bring its sort back', () => {
		mounted = setup();

		mounted.engine.scope.toggleSort('price', false);
		mounted.engine.scope.toggleColumn('price');
		mounted.engine.scope.toggleColumn('price');

		expect(mounted.engine.scope.sort.value).toEqual([]);
	});

	it('hiding a column leaves the sort of other columns alone', () => {
		mounted = setup({ state: useTableColumnsState({ multiSort: true }) });

		mounted.engine.scope.toggleSort('price', true);
		mounted.engine.scope.toggleSort('cap', true);
		mounted.engine.scope.toggleColumn('price');

		expect(mounted.engine.scope.sort.value.map(item => item.name)).toEqual(['cap']);
	});

	it('a column hidden inside `batch` stops sorting too', () => {
		mounted = setup();

		mounted.engine.scope.toggleSort('price', false);
		mounted.engine.scope.batch(() => mounted?.engine.scope.toggleColumn('price'));

		expect(mounted.engine.scope.isColumnHidden('price')).toBe(true);
		expect(mounted.engine.scope.sort.value).toEqual([]);
	});

	it('a column shown inside `batch` keeps its sort', () => {
		const state = useTableColumnsState();

		mounted = setup({ state });
		mounted.engine.scope.toggleColumn('price');
		state.sort.value = [{ name: 'price', direction: 'asc' }];
		mounted.engine.scope.batch(() => mounted?.engine.scope.toggleColumn('price'));

		expect(mounted.engine.scope.isColumnHidden('price')).toBe(false);
		expect(state.sort.value).toEqual([{ name: 'price', direction: 'asc' }]);
	});
});

describe('useTableEngine — geometry', () => {
	it('layers start with the root one', () => {
		mounted = setup();

		expect(mounted.engine.layers.value[0].selector).toBeNull();
	});

	it('at rest there is one layer', () => {
		mounted = setup();

		expect(mounted.engine.layers.value).toHaveLength(1);
	});

	it('a gesture adds a layer on the cells of the column and leaves the root alone', () => {
		const frames = stubAnimationFrames();

		mounted = setup();

		const before = mounted.engine.layers.value[0].style;

		mounted.engine.scope.resize('price', 240);
		frames.run();

		expect(mounted.engine.layers.value).toHaveLength(2);
		expect(mounted.engine.layers.value[1].selector).toBe(getColumnSelector('price'));
		expect(mounted.engine.layers.value[0].style).toEqual(before);
	});

	it('`contentWidth` diverges during a gesture and converges after the write', () => {
		const frames = stubAnimationFrames();

		mounted = setup();

		const { contentWidth } = mounted.engine;

		expect(contentWidth.live.value).toBe(contentWidth.committed.value);

		mounted.engine.scope.resize('price', 240);
		frames.run();
		expect(contentWidth.live.value).not.toBe(contentWidth.committed.value);

		mounted.engine.scope.commitResize();
		expect(contentWidth.live.value).toBe(contentWidth.committed.value);
	});

	it('the header style from `cellStyles` reaches the props', () => {
		mounted = setup({ cellStyles: { ...FLEX_CELL_STYLES, header: () => 'overflow:visible' } });

		const [first] = mounted.engine.scope.columns.value;

		expect(first.headerProps.style).toBe('overflow:visible');
		expect(String(first.cellProps.style)).not.toContain('overflow');
	});
});

describe('useTableEngine — insets', () => {
	it('without insets the variables are zero', () => {
		mounted = setup();

		expect(mounted.engine.layers.value[0].style['--tc-inset-start']).toBe('0px');
		expect(mounted.engine.layers.value[0].style['--tc-inset-end']).toBe('0px');
	});

	it('insets reach the root layer', () => {
		mounted = setup({ insets: () => ({ start: 44, end: 40 }) });

		expect(mounted.engine.layers.value[0].style['--tc-inset-start']).toBe('44px');
		expect(mounted.engine.layers.value[0].style['--tc-inset-end']).toBe('40px');
	});
});

describe('useTableEngine — reference stability', () => {
	it('a recreated columns object with the same fields keeps the set', () => {
		const price = (row: Row) => row.price;
		const declared = shallowRef<ColumnsInput>(defineColumns({ price: { value: price, width: 120 } }));

		mounted = setup({ columns: () => declared.value });

		const before = mounted.engine.scope.columns.value;

		declared.value = defineColumns({ price: { value: price, width: 120 } });

		expect(mounted.engine.scope.columns.value).toBe(before);
	});

	it('a recreated value function changes the set', () => {
		const declared = shallowRef<ColumnsInput>(defineColumns({
			price: { value: (row: Row) => row.price, width: 120 },
		}));

		mounted = setup({ columns: () => declared.value });

		const before = mounted.engine.scope.columns.value;

		declared.value = defineColumns({ price: { value: (row: Row) => row.price, width: 120 } });

		expect(mounted.engine.scope.columns.value).not.toBe(before);
	});

	it('columns as an array work the same as an object by name', () => {
		mounted = setup({ columns: () => toColumnList(columns) });

		expect(mounted.engine.scope.columns.value.map(column => column.column?.name))
			.toEqual(['symbol', 'price', 'cap']);
	});
});

describe('useTableEngine — column groups', () => {
	const groups = defineColumnGroups({ quote: { header: 'Quote', children: ['price', 'cap'] } });

	it('group rows reach the scope: cells, props and logical position', () => {
		mounted = setup({ groups: () => groups });

		const [row] = mounted.engine.scope.headerGroups.value;
		const [, quote] = row;

		expect(row.map(cell => cell.group?.name ?? null)).toEqual([null, 'quote']);
		expect(quote.columns).toEqual(['price', 'cap']);
		expect(quote.props['data-tc-columns']).toBe('price cap');
		expect(quote).toMatchObject({ index: 1, span: 2 });
		expect(String(quote.props.style)).toContain('calc(var(--tc-width-price, 120px) + 140px)');
	});

	it('without groups there are no rows', () => {
		mounted = setup();

		expect(mounted.engine.scope.headerGroups.value).toEqual([]);
	});

	it('a group cell survives a change to a column outside it', () => {
		const declared = shallowRef<ColumnsInput>(columns);

		mounted = setup({ columns: () => declared.value, groups: () => groups });

		const [[, before]] = mounted.engine.scope.headerGroups.value;

		declared.value = defineColumns({ ...columns, symbol: { ...columns.symbol, header: 'Ticker' } });

		expect(mounted.engine.scope.headerGroups.value[0][1]).toBe(before);
	});

	it('a hidden column to the left of a group shifts its index', () => {
		mounted = setup({ groups: () => groups });
		mounted.engine.scope.toggleColumn('symbol');

		const [[quote]] = mounted.engine.scope.headerGroups.value;

		expect(quote).toMatchObject({ index: 0, span: 2 });
	});
});

describe('useTableEngine — columns replaced with only new functions', () => {
	const declare = (_version: number, width = 120) => defineColumns({
		price: { value: (row: Row) => row.price, cell: () => null, width },
	});

	it('warns once after the third replacement', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const version = shallowRef(0);

		mounted = setup({ columns: () => declare(version.value) });

		for (let next = 1; next <= 5; next += 1) {
			version.value = next;
			void mounted.engine.scope.columns.value;
		}

		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toContain('"price"');
	});

	it('a real change to the column does not count', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const version = shallowRef(0);

		mounted = setup({ columns: () => declare(version.value, 100 + version.value) });

		for (let next = 1; next <= 5; next += 1) {
			version.value = next;
			void mounted.engine.scope.columns.value;
		}

		expect(warn).not.toHaveBeenCalled();
	});
});

function createViewport(clientWidth: number, scrollWidth: number, direction = 'ltr') {
	const root = document.createElement('div');
	let scrollLeft = 0;

	root.style.direction = direction;
	document.body.append(root);

	Object.defineProperty(root, 'clientWidth', { get: () => clientWidth });
	Object.defineProperty(root, 'scrollWidth', { get: () => scrollWidth });
	Object.defineProperty(root, 'scrollLeft', {
		get: () => scrollLeft,
		set: (value: number) => {
			scrollLeft = value;
		},
	});

	return root;
}

describe('useTableEngine — scrolling to a column', () => {
	it('`auto` brings a column past the right edge exactly to the edge', () => {
		mounted = setup();
		mounted.root.value = createViewport(250, 460);

		mounted.engine.scope.scrollToColumn('cap');

		expect(mounted.root.value.scrollLeft).toBe(210);
	});

	it('`auto` leaves a visible column alone', () => {
		mounted = setup();
		mounted.root.value = createViewport(250, 460);

		mounted.engine.scope.scrollToColumn('symbol');

		expect(mounted.root.value.scrollLeft).toBe(0);
	});

	it('`start` puts the column right after pinned columns and insets', () => {
		mounted = setup({ insets: () => ({ start: 40, end: 0 }) });
		mounted.root.value = createViewport(300, 500);
		mounted.engine.scope.pinColumn('symbol', 'start');

		mounted.engine.scope.scrollToColumn('cap', 'start');

		expect(mounted.root.value.scrollLeft).toBe(120);
	});

	it('in a right-to-left table scrolls towards negative `scrollLeft`', () => {
		mounted = setup();
		mounted.root.value = createViewport(250, 460, 'rtl');

		mounted.engine.scope.scrollToColumn('cap');
		expect(mounted.root.value.scrollLeft).toBe(-210);

		mounted.engine.scope.scrollToColumn('symbol');
		expect(mounted.root.value.scrollLeft).toBe(0);
	});

	it('does not scroll to a pinned or a hidden column', () => {
		mounted = setup();
		mounted.root.value = createViewport(250, 460);
		mounted.engine.scope.pinColumn('symbol', 'end');
		mounted.engine.scope.toggleColumn('cap');

		mounted.engine.scope.scrollToColumn('symbol', 'start');
		mounted.engine.scope.scrollToColumn('cap', 'start');

		expect(mounted.root.value.scrollLeft).toBe(0);
	});
});

describe('useTableEngine — scrolling to a row without the row window', () => {
	function createRowScroller(clientHeight: number, scrollHeight: number) {
		return createScroller({ height: clientHeight, scrollHeight });
	}

	const many = Array.from({ length: 50 }, (_, index) => ({ id: `r${index}`, price: index }));

	it('scrolls by row heights, keeping the sticky top clear', () => {
		mounted = setup({ rows: () => many, scrollMargin: 40 });
		mounted.root.value = createRowScroller(400, 40 + 50 * 36);

		mounted.engine.scope.scrollToRow(20);

		expect(mounted.root.value.scrollTop).toBe(720);
	});

	it('`auto` leaves a visible row alone and brings a far one to the bottom edge', () => {
		mounted = setup({ rows: () => many, scrollMargin: 40 });
		mounted.root.value = createRowScroller(400, 40 + 50 * 36);

		mounted.engine.scope.scrollToRow(3, 'auto');
		expect(mounted.root.value.scrollTop).toBe(0);

		mounted.engine.scope.scrollToRow(20, 'auto');
		expect(mounted.root.value.scrollTop).toBe(40 + 21 * 36 - 400);
	});

	it('keeps the sticky bottom clear too', () => {
		mounted = setup({ rows: () => many, scrollMargin: 40, scrollMarginEnd: 30 });
		mounted.root.value = createRowScroller(400, 40 + 50 * 36 + 30);

		mounted.engine.scope.scrollToRow(20, 'auto');
		expect(mounted.root.value.scrollTop).toBe(40 + 21 * 36 - 400 + 30);
	});
});

describe('useTableEngine — widths of several columns', () => {
	const wide = defineColumns({
		symbol: { value: (row: Row) => row.id, width: 100, minWidth: 20, resizable: true },
		price: { value: (row: Row) => row.price, width: 100, minWidth: 20, resizable: true, maxWidth: 150 },
		cap: { value: (row: Row) => row.price * 2, width: 100 },
	});

	it('`setWidths` writes widths of resizable columns in one write, within their limits', () => {
		const writes = vi.fn();
		const state = useTableColumnsState();

		mounted = setup({ columns: () => wide, state });
		watch(state.layout, writes, { flush: 'sync' });

		expect(mounted.engine.scope.setWidths({ symbol: 80, price: 400, cap: 50 })).toBe(true);
		expect(state.layout.value?.widths).toEqual({ symbol: 80, price: 150 });
		expect(writes).toHaveBeenCalledTimes(1);
	});

	it('`setWidths` without a resizable column changes nothing', () => {
		mounted = setup({ columns: () => wide });

		expect(mounted.engine.scope.setWidths({ cap: 50, gone: 10 })).toBe(false);
		expect(mounted.engine.state.layout.value).toBeNull();
	});

	it('`fitColumns` shares the viewport among resizable columns within `maxWidth`', () => {
		mounted = setup({ columns: () => wide, insets: () => ({ start: 20, end: 0 }) });
		mounted.root.value = createViewport(520, 520);

		expect(mounted.engine.scope.fitColumns()).toBe(true);
		expect(mounted.engine.state.layout.value?.widths).toEqual({ symbol: 250, price: 150 });
	});

	it('`fitColumns` writes nothing without a root', () => {
		mounted = setup({ columns: () => wide });

		expect(mounted.engine.scope.fitColumns()).toBe(false);
		expect(mounted.engine.state.layout.value).toBeNull();
	});
});

describe('useTableEngine — collapsing column groups', () => {
	const grouped = defineColumns({
		symbol: { value: (row: Row) => row.id, movable: true },
		price: { value: (row: Row) => row.price, movable: true },
		cap: { value: (row: Row) => row.price * 2, movable: true },
		total: { value: (row: Row) => row.price * 3, movable: true },
	});

	const collapsible = defineColumnGroups({
		quote: {
			header: 'Quote',
			children: ['price', 'cap', 'total'],
			showWhen: { cap: 'expanded', total: 'collapsed' },
		},
	});

	function names() {
		return mounted?.engine.scope.columns.value.map(item => item.column?.name);
	}

	it('an expanded group shows `expanded` children and hides `collapsed` ones', () => {
		mounted = setup({ columns: () => grouped, groups: () => collapsible });

		expect(mounted.engine.scope.isGroupCollapsed('quote')).toBe(false);
		expect(names()).toEqual(['symbol', 'price', 'cap']);
	});

	it('collapsing changes the set, writes the layout and marks the group cell', () => {
		mounted = setup({ columns: () => grouped, groups: () => collapsible });
		mounted.engine.scope.toggleGroup('quote');

		const [[, quote]] = mounted.engine.scope.headerGroups.value;

		expect(names()).toEqual(['symbol', 'price', 'total']);
		expect(mounted.engine.state.layout.value?.collapsed).toEqual({ quote: true });
		expect(quote).toMatchObject({ collapsible: true, collapsed: true, columns: ['price', 'total'] });
	});

	it('a column hidden by collapsing is not hidden by the user, but is in `hiddenColumns`', () => {
		mounted = setup({ columns: () => grouped, groups: () => collapsible });

		expect(mounted.engine.scope.isColumnHidden('total')).toBe(false);
		expect([...mounted.engine.hiddenColumns.value]).toEqual(['total']);
	});

	it('`collapsedByDefault` collapses the group until the first change', () => {
		const groups = defineColumnGroups({
			quote: { children: ['price', 'cap'], showWhen: { cap: 'expanded' }, collapsedByDefault: true },
		});

		mounted = setup({ columns: () => grouped, groups: () => groups });

		expect(mounted.engine.scope.isGroupCollapsed('quote')).toBe(true);
		expect(names()).toEqual(['symbol', 'price', 'total']);

		mounted.engine.scope.toggleGroup('quote');

		expect(names()).toEqual(['symbol', 'price', 'cap', 'total']);
	});

	it('a group without `showWhen` does not collapse', () => {
		const groups = defineColumnGroups({ quote: { children: ['price', 'cap'] } });

		mounted = setup({ columns: () => grouped, groups: () => groups });
		mounted.engine.scope.toggleGroup('quote');

		expect(mounted.engine.scope.isGroupCollapsed('quote')).toBe(false);
		expect(mounted.engine.state.layout.value).toBeNull();
	});

	it('two toggles in one `batch` leave the group as it was', () => {
		mounted = setup({ columns: () => grouped, groups: () => collapsible });

		const { scope } = mounted.engine;

		scope.batch(() => {
			scope.toggleGroup('quote');
			scope.toggleGroup('quote');
		});

		expect(scope.isGroupCollapsed('quote')).toBe(false);
	});

	it('`keepTogether` keeps other columns out of the group and the group in one piece', () => {
		const groups = defineColumnGroups({ quote: { children: ['price', 'cap'], keepTogether: true } });

		mounted = setup({ columns: () => grouped, groups: () => groups });

		const { scope } = mounted.engine;

		expect(scope.canMoveColumnTo('symbol', 1)).toBe(false);
		expect(scope.canMoveColumnTo('price', 2)).toBe(true);
		expect(scope.canMoveColumnTo('price', 3)).toBe(false);
		expect(scope.canMoveColumnTo('total', 0)).toBe(true);
	});

	it('`moveColumnBy` steps over a `keepTogether` group as over one place', () => {
		const groups = defineColumnGroups({ quote: { children: ['price', 'cap'], keepTogether: true } });

		mounted = setup({ columns: () => grouped, groups: () => groups });

		const { scope } = mounted.engine;
		const order = () => scope.columns.value.map(item => item.column?.name);

		expect(order()).toEqual(['symbol', 'price', 'cap', 'total']);
		expect(scope.moveColumnBy('symbol', 1)).toBe(true);
		expect(order()).toEqual(['price', 'cap', 'symbol', 'total']);
	});
});

describe('useTableEngine — windows', () => {
	const many = Array.from({ length: 1000 }, (_, index) => ({ id: `r${index}`, price: index }));

	const wide = defineColumns(Object.fromEntries(Array.from({ length: 30 }, (_, index) => [
		`c${index}`,
		{ value: (row: Row) => row.price, width: 100 },
	])));

	function names() {
		return mounted?.engine.scope.renderedColumns.value.map(item => item.column?.name ?? item.spacer);
	}

	it('renders the server set before mount and the viewport after', () => {
		mounted = setup({ rows: () => many, virtual: true });
		expect(mounted.engine.items.value).toHaveLength(24);

		mounted.root.value = createScroller({ width: 1000, height: 360 });

		expect(mounted.engine.items.value.map(item => item.index)).toEqual(Array.from({ length: 16 }, (_, index) => index));
		expect(mounted.engine.scope.rowRange.value).toEqual({ start: 0, end: 16 });
		expect(mounted.engine.totalSize.value).toBe(36_000);
	});

	it('moves the row window with scrolling and with `scrollToRow`', () => {
		mounted = setup({ rows: () => many, virtual: { rows: true, columns: false, overscan: 0 } });

		const scroller = createScroller({ width: 1000, height: 360 });

		mounted.root.value = scroller;
		scroller.scrollToPosition({ top: 3600 });
		expect(mounted.engine.scope.rowRange.value).toEqual({ start: 100, end: 110 });

		mounted.engine.scope.scrollToRow(500);
		scroller.dispatchEvent(new Event('scroll'));
		expect(mounted.engine.scope.rowRange.value).toEqual({ start: 500, end: 510 });
	});

	it('the rows in view and the page step come from the row window', () => {
		mounted = setup({ rows: () => many, virtual: { overscan: 2 }, scrollMargin: 36 });

		const scroller = createScroller({ width: 1000, height: 360 });

		mounted.root.value = scroller;
		scroller.scrollToPosition({ top: 3600 });

		expect(mounted.engine.scope.visibleRange.value).toEqual({ start: 100, end: 109 });
		expect(mounted.engine.scope.getPageStep(100, 'down')).toBe(9);
	});

	it('keeps the rows from `keepRows` rendered', () => {
		mounted = setup({ rows: () => many, virtual: { overscan: 0 }, keepRows: () => [900] });
		mounted.root.value = createScroller({ width: 1000, height: 360 });

		expect(mounted.engine.items.value.at(-1)?.index).toBe(900);
		expect(mounted.engine.scope.rowRange.value).toEqual({ start: 0, end: 901 });
	});

	it('a source registered with `keepRendered` keeps its rows and columns until released', () => {
		mounted = setup({ rows: () => many, columns: () => wide, virtual: { overscan: 0, bufferPx: 0 } });
		mounted.root.value = createScroller({ width: 500, height: 360 });

		const release = mounted.engine.scope.keepRendered({ rows: () => [700], columns: () => ['c20'] });

		expect(mounted.engine.items.value.at(-1)?.index).toBe(700);
		expect(names()).toContain('c20');

		release();

		expect(mounted.engine.items.value.at(-1)?.index).toBe(9);
		expect(names()).not.toContain('c20');
	});

	it('a kept row that moves inside the window re-renders nothing', async () => {
		const held = shallowRef<readonly number[]>([5]);
		const root = shallowRef<HTMLElement | null>(null);
		let renders = 0;

		const wrapper = mount(defineComponent({
			setup() {
				const engine = useTableEngine({
					columns: () => columns,
					rows: () => many,
					root,
					rowKey: 'id',
					rowHeight: 36,
					virtual: { overscan: 0 },
				});

				engine.scope.keepRendered({ rows: () => held.value });

				return () => {
					renders += 1;

					return h('div', engine.items.value.map(item => h('div', { key: item.key }, item.key)));
				};
			},
		}));

		root.value = createScroller({ width: 1000, height: 360 });
		await nextTick();

		const before = renders;

		held.value = [6];
		await nextTick();
		expect(renders).toBe(before);

		held.value = [900];
		await nextTick();
		expect(renders).toBe(before + 1);

		wrapper.unmount();
	});

	it('`rowRange` stays the same object while its bounds hold', () => {
		const list = shallowRef(many);

		mounted = setup({ rows: () => list.value, virtual: { overscan: 0 } });
		mounted.root.value = createScroller({ width: 1000, height: 360 });

		const before = mounted.engine.scope.rowRange.value;

		list.value = [{ id: 'renamed', price: 0 }, ...many.slice(1)];

		expect(mounted.engine.items.value[0].key).toBe('renamed');
		expect(mounted.engine.scope.rowRange.value).toBe(before);
	});

	it('windows the columns with spacers in place of the skipped ones', () => {
		mounted = setup({ columns: () => wide, virtual: { rows: false, bufferPx: 0 } });

		const scroller = createScroller({ width: 500, height: 400 });

		mounted.root.value = scroller;
		expect(names()).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'end']);
		expect(mounted.engine.windowed.value).toBe(true);

		scroller.scrollToPosition({ left: 1000 });
		expect(names()).toEqual(['c0', 'start', 'c10', 'c11', 'c12', 'c13', 'c14', 'end']);
	});

	it('a right-to-left container scrolls to negative `scrollLeft`, and the window follows', () => {
		mounted = setup({ columns: () => wide, virtual: { rows: false, bufferPx: 0 } });

		const scroller = createScroller({ width: 500, height: 400 });

		mounted.root.value = scroller;
		scroller.scrollToPosition({ left: -1000 });

		expect(names()).toEqual(['c0', 'start', 'c10', 'c11', 'c12', 'c13', 'c14', 'end']);
	});

	it('keeps the row header rendered in its place when the window scrolls away from it', () => {
		mounted = setup({ columns: () => wide, virtual: { rows: false, bufferPx: 0 } });

		const scroller = createScroller({ width: 500, height: 400 });

		mounted.root.value = scroller;
		scroller.scrollToPosition({ left: 1000 });

		const [header, spacer] = mounted.engine.scope.renderedColumns.value;

		expect(header.rowHeader).toBe(true);
		expect(spacer.key).toBe('tc-spacer-start');
		expect(spacer.cellProps.style).toBe('flex:0 0 900px;min-width:900px');
	});

	it('`rowHeader` on a column makes it the row header instead of the first one', () => {
		const marked = defineColumns({
			...wide,
			c3: { value: (row: Row) => row.price, width: 100, rowHeader: true },
		});

		mounted = setup({ columns: () => marked, virtual: { rows: false, bufferPx: 0 } });

		const scroller = createScroller({ width: 500, height: 400 });

		mounted.root.value = scroller;
		scroller.scrollToPosition({ left: 1000 });

		expect(mounted.engine.scope.renderedColumns.value.map(item => item.key))
			.toEqual(['tc-spacer-start-1', 'c3', 'tc-spacer-start', 'c10', 'c11', 'c12', 'c13', 'c14', 'tc-spacer-end']);
	});

	it('`rowHeader: false` on the first data column leaves the table without a row header', () => {
		const plain = defineColumns({
			...wide,
			c0: { value: (row: Row) => row.price, width: 100, rowHeader: false },
		});

		mounted = setup({ columns: () => plain, virtual: { rows: false, bufferPx: 0 } });

		const scroller = createScroller({ width: 500, height: 400 });

		mounted.root.value = scroller;
		scroller.scrollToPosition({ left: 1000 });

		expect(names()).toEqual(['start', 'c10', 'c11', 'c12', 'c13', 'c14', 'end']);
		expect(mounted.engine.scope.columns.value.some(item => item.rowHeader)).toBe(false);
	});

	it('a service column is never the row header by default', () => {
		const service = defineColumns({
			select: { value: (row: Row) => row.id, width: 40, kind: 'service' },
			...wide,
		});

		mounted = setup({ columns: () => service, virtual: { rows: false } });

		const headers = mounted.engine.scope.columns.value.filter(item => item.rowHeader).map(item => item.key);

		expect(headers).toEqual(['c0']);
	});

	it('keeps every column with the column window disabled', () => {
		mounted = setup({ columns: () => wide, virtual: { columns: false } });
		mounted.root.value = createScroller({ width: 500, height: 400 });

		expect(names()).toHaveLength(30);
		expect(mounted.engine.windowed.value).toBe(false);
	});
});

describe('useTableEngine — row keys', () => {
	it('`rowKeys` and `getRowIndex` share one index of the rows', () => {
		const source = shallowRef<Row[]>(rows);

		mounted = setup({ rows: source });

		const { scope } = mounted.engine;

		expect(scope.rowKeys.value).toEqual(['a', 'b', 'c']);
		expect(scope.getRowIndex('c')).toBe(2);
		expect(scope.getRowIndex('nope')).toBe(-1);
		expect(scope.getRowKey(rows[1])).toBe('b');

		source.value = [...rows].reverse();

		expect(scope.getRowIndex('c')).toBe(0);
	});

	it('the index is not built until someone reads it', () => {
		const read = vi.fn((row: Row) => row.id);

		mounted = setup({ rowKey: read, virtual: { overscan: 0 } });
		mounted.root.value = createScroller({ width: 500, height: 36 });
		void mounted.engine.items.value;

		expect(read.mock.calls.length).toBeLessThan(rows.length);
	});
});

describe('useTableEngine — duplicate row keys', () => {
	const twins: Row[] = [{ id: 'a', price: 1 }, { id: 'b', price: 2 }, { id: 'a', price: 3 }];

	it('warn once, when the keys are first read', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const source = shallowRef<Row[]>(twins);

		mounted = setup({ rows: source });

		expect(warn).not.toHaveBeenCalled();

		void mounted.engine.scope.rowKeys.value;
		source.value = [...twins, { id: 'b', price: 4 }];
		void mounted.engine.scope.rowKeys.value;

		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toContain('"a"');
	});

	it('unique keys give no warning', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		mounted = setup();
		void mounted.engine.scope.rowKeys.value;

		expect(warn).not.toHaveBeenCalled();
	});
});

describe('useTableEngine — sort of columns that are gone', () => {
	it('neither sorts nor counts in positions', () => {
		const state = useTableColumnsState({ multiSort: true });

		state.sort.value = [{ name: 'gone', direction: 'asc' }, { name: 'price', direction: 'desc' }];
		mounted = setup({ state });

		const { scope } = mounted.engine;

		expect(scope.sort.value).toEqual([{ name: 'price', direction: 'desc' }]);
		expect(scope.getSortIndex('price')).toBeUndefined();
	});

	it('is dropped from the state by the next header click', () => {
		const state = useTableColumnsState({ multiSort: true });

		state.sort.value = [{ name: 'gone', direction: 'asc' }, { name: 'price', direction: 'desc' }];
		mounted = setup({ state });
		mounted.engine.scope.toggleSort('cap', true);

		expect(state.sort.value.map(item => item.name)).toEqual(['price', 'cap']);
	});

	it('an unchanged sort keeps its reference', () => {
		const state = useTableColumnsState();

		state.sort.value = [{ name: 'price', direction: 'desc' }];
		mounted = setup({ state });

		expect(mounted.engine.scope.sort.value).toBe(state.sort.value);
	});
});

describe('useTableEngine — the width a resize gives', () => {
	it('is the width within the column limits, and the current width for a column that does not resize', () => {
		const limited = defineColumns({
			price: { value: (row: Row) => row.price, width: 120, minWidth: 60, maxWidth: 200, resizable: true },
			cap: { value: (row: Row) => row.price, width: 140 },
		});

		mounted = setup({ columns: () => limited });

		const { scope } = mounted.engine;

		expect(scope.resize('price', 500)).toBe(200);
		expect(scope.resize('price', 10)).toBe(60);
		expect(scope.resize('price', 150.4)).toBe(150);
		expect(scope.resize('cap', 300)).toBe(140);
	});
});

describe('useTableEngine — resize per animation frame', () => {
	let frames: Frames;

	beforeEach(() => {
		frames = stubAnimationFrames();
	});

	function liveWidth() {
		return mounted?.engine.scope.getWidth('price');
	}

	it('the first move schedules a frame and applies nothing', () => {
		mounted = setup();
		mounted.engine.scope.resize('price', 200);

		expect(frames.pending()).toBe(1);
		expect(liveWidth()).toBe(120);
	});

	it('six moves in one frame cost one frame, and the last width wins', () => {
		mounted = setup();

		for (let step = 1; step <= 6; step += 1) {
			mounted.engine.scope.resize('price', 100 + step * 10);
		}

		expect(frames.pending()).toBe(1);

		frames.run();

		expect(liveWidth()).toBe(160);
	});

	it('`commitResize` applies a waiting width at once and writes it to the layout', () => {
		mounted = setup();
		mounted.engine.scope.resize('price', 200);
		mounted.engine.scope.commitResize();

		expect(frames.pending()).toBe(0);
		expect(frames.cancelled()).toBe(1);
		expect(mounted.engine.state.layout.value?.widths.price).toBe(200);
	});

	it('a cancelled frame does not apply the width a second time', () => {
		mounted = setup();
		mounted.engine.scope.resize('price', 200);
		mounted.engine.scope.commitResize();
		frames.run();

		expect(mounted.engine.contentWidth.live.value).toBe(mounted.engine.contentWidth.committed.value);
	});

	it('`commitResize` without moves writes nothing', () => {
		mounted = setup();
		mounted.engine.scope.commitResize();

		expect(mounted.engine.state.layout.value).toBeNull();
	});

	it('unmounting cancels a waiting frame', () => {
		mounted = setup();
		mounted.engine.scope.resize('price', 200);
		mounted.unmount();
		mounted = null;

		expect(frames.cancelled()).toBe(1);
	});

	it('without `requestAnimationFrame` the width applies at once', () => {
		vi.stubGlobal('requestAnimationFrame', undefined);
		mounted = setup();
		mounted.engine.scope.resize('price', 200);

		expect(liveWidth()).toBe(200);
	});
});

describe('useTableEngine — typed rows', () => {
	it('infers the row type from `rows` for `rowKey` and `rowHeight`', () => {
		const wrapper = mount(defineComponent({
			setup() {
				useTableEngine({
					columns: () => columns,
					rows: computed(() => rows),
					root: shallowRef(null),
					rowKey: 'id',
					rowHeight: row => row.price,
				});

				useTableEngine({
					columns: () => columns,
					rows: computed(() => rows),
					root: shallowRef(null),
					// @ts-expect-error: `symbol` is not a field of the row
					rowKey: 'symbol',
					rowHeight: 36,
				});

				return () => null;
			},
		}));

		wrapper.unmount();
	});
});


describe('useTableEngine — references across width changes and streams', () => {
	it('`scope.columns` and their props stay the same after a resize is written to the layout', () => {
		stubAnimationFrames();
		mounted = setup();

		const { scope } = mounted.engine;
		const before = scope.columns.value;

		scope.resize('price', 200);
		scope.commitResize();

		expect(scope.columns.value).toBe(before);
		expect(scope.columns.value[1].cellProps).toBe(before[1].cellProps);
	});

	it('`scope.columns` stays the same after `setWidths`, and changes when a column is hidden', () => {
		mounted = setup();

		const { scope } = mounted.engine;
		const before = scope.columns.value;

		scope.setWidths({ price: 300 });

		expect(scope.columns.value).toBe(before);

		scope.toggleColumn('cap');

		expect(scope.columns.value).not.toBe(before);
		expect(scope.columns.value.find(column => column.key === 'price')).toBe(before[1]);
	});

	it('a frame of a resize wakes no reader of a column\'s grow', () => {
		const frames = stubAnimationFrames();
		const flexible = defineColumns({
			name: { value: (row: Row) => row.id, width: 100, flex: 1, resizable: true },
			price: { value: (row: Row) => row.price, width: 120, resizable: true },
		});

		mounted = setup({ columns: () => flexible });

		const { scope } = mounted.engine;
		let runs = 0;

		scope.setWidths({ price: 130 });
		watch(() => {
			runs += 1;

			return scope.getColumnSpan(0, 1);
		}, () => undefined, { flush: 'sync' });
		scope.resize('price', 150);
		frames.run();
		scope.resize('price', 160);
		frames.run();

		expect(runs).toBe(1);
	});

	it('`rowKeys` stays the same array while new data comes under the same keys', () => {
		const source = shallowRef<Row[]>(rows);

		mounted = setup({ rows: source });

		const { scope } = mounted.engine;
		const before = scope.rowKeys.value;

		source.value = rows.map(row => ({ ...row, price: row.price + 1 }));

		expect(scope.rowKeys.value).toBe(before);

		source.value = [...source.value].reverse();

		expect(scope.rowKeys.value).toEqual(['c', 'b', 'a']);
	});
});
