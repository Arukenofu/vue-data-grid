import { type Ref, ref, shallowRef, watch } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';

import { type AnyColumn, type AnyColumnInput, normalizeColumn } from '../../src/columns/column';
import type { GridLayout } from '../../src/columns/layout';
import { type ColumnsInsets, useGridColumns } from '../../src/engine/use-grid-columns';
import {
	FLEX_CELL_STYLES,
	getColumnSelector,
	type GeometryLayer,
	type GridCellStyles,
} from '../../src/render/geometry';

const value = () => 0;

function declare(name: string, input: Partial<AnyColumnInput> = {}) {
	return normalizeColumn(name, { value, ...input });
}

interface SetupOptions {
	columns?: readonly AnyColumn[];
	insets?: ColumnsInsets;
	cellStyles?: GridCellStyles;
}

function setup(options: SetupOptions = {}) {
	const columns = shallowRef<readonly AnyColumn[]>(options.columns ?? [
		declare('symbol', { width: 200, pinnable: true, hideable: true, movable: true }),
		declare('price', { width: 120, resizable: true, hideable: true, movable: true }),
		declare('cap', { width: 140, resizable: true, hideable: true, movable: true, pinnable: true, flex: 1 }),
	]);
	const layout = ref<GridLayout | null>(null) as Ref<GridLayout | null>;
	const insets = ref<ColumnsInsets>(options.insets ?? { start: 0, end: 0 });
	const cellStyles = options.cellStyles ?? FLEX_CELL_STYLES;

	const model = useGridColumns({ columns, layout, insets, cellStyles });

	return { columns, layout, insets, model };
}

const names = (model: ReturnType<typeof setup>['model']) =>
	model.columns.value.map(column => column.column?.name);

describe('useGridColumns — set and order', () => {
	it('without a layout the order comes from the declaration', () => {
		const { model } = setup();

		expect(names(model)).toEqual(['symbol', 'price', 'cap']);
	});

	it('start-pinned columns go first, end-pinned ones last', () => {
		const { model, layout } = setup();

		layout.value = { order: ['symbol', 'price', 'cap'], hidden: [], widths: {}, pinned: { cap: 'start' } };

		expect(names(model)).toEqual(['cap', 'symbol', 'price']);
	});

	it('a hidden column leaves the set but stays in `orderedColumns`', () => {
		const { model } = setup();

		model.toggleColumn('price');

		expect(names(model)).toEqual(['symbol', 'cap']);
		expect(model.orderedColumns.value.map(column => column.name)).toEqual(['symbol', 'price', 'cap']);
		expect(model.isColumnHidden('price')).toBe(true);
		expect(model.hiddenColumns.value.has('price')).toBe(true);
	});

	it('the column position is counted among the shown columns', () => {
		const { model } = setup();

		model.toggleColumn('symbol');

		expect(model.columns.value.map(column => column.index)).toEqual([0, 1]);
	});

	it('`getColumn` finds by name and gives `undefined` for an unknown one', () => {
		const { model } = setup();

		expect(model.getColumn('price')?.column?.name).toBe('price');
		expect(model.getColumn('zzz')).toBeUndefined();
	});
});

describe('useGridColumns — cell props', () => {
	it('the core sets no roles: the markup chooses `table` or `grid`', () => {
		const { model } = setup();
		const [first] = model.columns.value;

		expect(first.cellProps.role).toBeUndefined();
		expect(first.headerProps.role).toBeUndefined();
	});

	it('the style comes from the given compiler', () => {
		const cellStyles: GridCellStyles = {
			cell: (column, pin, offset) => `${column.name}|${pin}|${offset}`,
			header: column => `header:${column.name}`,
			spacer: width => `${width}`,
		};
		const { model } = setup({ cellStyles });

		expect(model.columns.value.map(column => column.cellProps.style))
			.toEqual(['symbol|undefined|0', 'price|undefined|0', 'cap|undefined|0']);
		expect(model.columns.value[0].headerProps.style).toBe('header:symbol');
	});

	it('the compiler runs once per column, not on every recompute with the same geometry', () => {
		let calls = 0;
		const cellStyles: GridCellStyles = {
			cell: (...args) => {
				calls += 1;

				return FLEX_CELL_STYLES.cell(...args);
			},
			spacer: FLEX_CELL_STYLES.spacer,
		};
		const { model, layout } = setup({ cellStyles });

		expect(model.columns.value).toHaveLength(3);
		expect(calls).toBe(3);

		layout.value = { order: ['symbol', 'cap', 'price'], hidden: [], widths: {}, pinned: {} };

		expect(model.columns.value.map(column => column.column?.name)).toEqual(['symbol', 'cap', 'price']);
		expect(calls).toBe(3);
	});

	it('`data-dg-column` goes on both body and header props: geometry targets cells by it', () => {
		const { model } = setup();
		const [first] = model.columns.value;

		expect(first.cellProps['data-dg-column']).toBe('symbol');
		expect(first.headerProps['data-dg-column']).toBe('symbol');
	});

	it('props are frozen: one object is shared by all rows', () => {
		const { model } = setup();

		expect(Object.isFrozen(model.columns.value[0].cellProps)).toBe(true);
	});

	it('without header options the body and header style is one string', () => {
		const { model } = setup();
		const [first] = model.columns.value;

		expect(first.headerProps.style).toBe(first.cellProps.style);
	});

	it('props survive a change that does not affect them', () => {
		const { model, columns } = setup();
		const before = model.columns.value[1].cellProps;

		columns.value = columns.value.map(column =>
			(column.name === 'price' ? { ...column, header: 'Price' } : column));

		expect(model.columns.value[1].cellProps).toBe(before);
	});

	it('a width change rewrites the props', () => {
		const { model, columns } = setup();
		const before = model.columns.value[1].cellProps;

		columns.value = columns.value.map(column =>
			(column.name === 'price' ? { ...column, width: 300 } : column));

		expect(model.columns.value[1].cellProps).not.toBe(before);
	});

	it('hiding a neighbour does not rewrite the props of the others', () => {
		const { model } = setup();
		const before = model.columns.value[0].cellProps;

		model.toggleColumn('price');

		expect(model.columns.value[0].cellProps).toBe(before);
	});
});

describe('useGridColumns — cell props', () => {
	function setupWith(cellStyles: GridCellStyles, align: 'left' | 'right' | 'center' = 'right') {
		const columns = shallowRef<readonly AnyColumn[]>([declare('price', { width: 120, align })]);
		const layout = ref<GridLayout | null>(null) as Ref<GridLayout | null>;
		const insets = ref<ColumnsInsets>({ start: 0, end: 0 });

		return useGridColumns({ columns, layout, insets, cellStyles });
	}

	it('a header style of the strategy reaches the header props only', () => {
		const model = setupWith({ ...FLEX_CELL_STYLES, header: () => 'overflow:visible' });
		const [first] = model.columns.value;

		expect(first.headerProps.style).toBe('overflow:visible');
		expect(first.cellProps.style).not.toBe('overflow:visible');
	});

	it('`align` other than `left` reaches the props as `data-dg-align`', () => {
		const [right] = setupWith(FLEX_CELL_STYLES, 'right').columns.value;
		const [left] = setupWith(FLEX_CELL_STYLES, 'left').columns.value;

		expect(right.cellProps['data-dg-align']).toBe('right');
		expect(right.headerProps['data-dg-align']).toBe('right');
		expect(left.cellProps['data-dg-align']).toBeUndefined();
	});
});

describe('useGridColumns — widths and resizing', () => {
	let grid: ReturnType<typeof setup>;

	beforeEach(() => {
		grid = setup();
	});

	it('without changes the width comes from the declaration', () => {
		expect(grid.model.getWidth('price')).toBe(120);
	});

	it('`resize` changes the live width and leaves the committed one alone', () => {
		grid.model.resize('price', 240);

		expect(grid.model.getWidth('price')).toBe(240);
		expect(grid.model.contentWidth.live.value).toBe(200 + 240 + 140);
		expect(grid.model.contentWidth.committed.value).toBe(200 + 120 + 140);
	});

	it('the width is clamped by the column declaration', () => {
		grid.columns.value = [declare('price', { width: 120, minWidth: 80, maxWidth: 300, resizable: true })];

		grid.model.resize('price', 10);
		expect(grid.model.getWidth('price')).toBe(80);

		grid.model.resize('price', 9000);
		expect(grid.model.getWidth('price')).toBe(300);
	});

	it('a column that is not resizable ignores resizing', () => {
		grid.model.resize('symbol', 400);

		expect(grid.model.getWidth('symbol')).toBe(200);
	});

	it('an unknown column ignores resizing', () => {
		expect(() => grid.model.resize('zzz', 400)).not.toThrow();
	});

	it('`commitResize` moves the draft into the layout', () => {
		grid.model.resize('price', 240);
		grid.model.commitResize();

		expect(grid.layout.value?.widths).toEqual({ price: 240 });
		expect(grid.model.contentWidth.committed.value).toBe(grid.model.contentWidth.live.value);
	});

	it('`commitResize` without a draft leaves the layout alone', () => {
		grid.model.commitResize();

		expect(grid.layout.value).toBeNull();
	});

	it('several columns in one draft are committed together', () => {
		grid.model.resize('price', 240);
		grid.model.resize('cap', 300);
		grid.model.commitResize();

		expect(grid.layout.value?.widths).toEqual({ price: 240, cap: 300 });
	});

	it('a committed width survives the next draft', () => {
		grid.model.resize('price', 240);
		grid.model.commitResize();
		grid.model.resize('cap', 300);

		expect(grid.model.contentWidth.committed.value).toBe(200 + 240 + 140);
		expect(grid.model.contentWidth.live.value).toBe(200 + 240 + 300);
	});
});

describe('useGridColumns — geometry layers', () => {
	it('root variables carry the insets and committed widths', () => {
		const { model, insets } = setup();

		insets.value = { start: 44, end: 40 };

		expect(model.variables.value['--dg-inset-start']).toBe('44px');
		expect(model.variables.value['--dg-inset-end']).toBe('40px');
	});

	it('at rest there is no overlay', () => {
		const { model } = setup();

		expect(model.overlay.value).toEqual([]);
	});

	it('at rest the overlay is the same array every time', () => {
		const { model } = setup();
		const first = model.overlay.value;

		expect(model.overlay.value).toBe(first);
	});

	it('the draft goes as a layer on the cells of its column, not on the root', () => {
		const { model } = setup();
		const before = model.variables.value;

		model.resize('price', 240);

		const [layer] = model.overlay.value as readonly GeometryLayer[];

		expect(model.overlay.value).toHaveLength(1);
		expect(layer.selector).toBe(getColumnSelector('price'));
		expect(layer.style['--dg-width-price']).toBe('240px');
		expect(model.variables.value).toEqual(before);
	});

	it('the root does not change at all during a gesture', () => {
		const { model } = setup();
		const before = JSON.stringify(model.variables.value);

		model.resize('price', 240);
		model.resize('price', 260);
		model.resize('cap', 400);

		expect(JSON.stringify(model.variables.value)).toBe(before);
	});

	it('after `commitResize` the overlay is removed and the width goes to the root', () => {
		const { model } = setup();

		model.resize('price', 240);
		model.commitResize();

		expect(model.overlay.value).toEqual([]);
		expect(model.variables.value['--dg-width-price']).toBe('240px');
	});

	it('a preview goes as layers, never to the layout, and `null` takes it off', () => {
		const { model, layout } = setup();

		model.previewWidths({ price: 180, cap: 200 });

		expect(model.overlay.value.map(layer => [layer.selector, layer.style['--dg-width-price'] ?? layer.style['--dg-width-cap']]))
			.toEqual([[getColumnSelector('price'), '180px'], [getColumnSelector('cap'), '200px']]);
		expect(model.getWidth('price')).toBe(180);
		expect(layout.value).toBeNull();

		model.previewWidths(null);

		expect(model.overlay.value).toEqual([]);
		expect(model.getWidth('price')).toBe(120);
	});

	it('a resize draws over a preview, and commits only its own width', () => {
		const { model, layout } = setup();

		model.previewWidths({ price: 180, cap: 200 });
		model.resize('price', 240);

		expect(model.getWidth('price')).toBe(240);
		expect(model.getWidth('cap')).toBe(200);

		model.commitResize();

		expect(layout.value?.widths).toEqual({ price: 240 });
	});

	it('a layer is created only for the columns that changed', () => {
		const { model } = setup();

		model.resize('price', 240);

		expect((model.overlay.value as readonly GeometryLayer[]).map(layer => layer.selector))
			.toEqual([getColumnSelector('price')]);
	});

	it('the grow variable is zeroed only when the user sets the width', () => {
		const { model } = setup();

		expect(model.variables.value['--dg-grow-cap']).toBeUndefined();

		model.resize('cap', 300);

		const [layer] = model.overlay.value as readonly GeometryLayer[];

		expect(layer.style['--dg-grow-cap']).toBe('0');

		model.commitResize();

		expect(model.variables.value['--dg-grow-cap']).toBe('0');
	});

	it('pinned columns get an offset variable from their edge', () => {
		const { model, layout } = setup();

		layout.value = {
			order: ['symbol', 'price', 'cap'],
			hidden: [],
			widths: {},
			pinned: { symbol: 'start', cap: 'end' },
		};

		expect(model.variables.value['--dg-pin-start-symbol']).toBe('0px');
		expect(model.variables.value['--dg-pin-end-cap']).toBe('0px');
	});

	it('resizing a pinned column shifts its neighbour on the same edge, and both layers reach their cells', () => {
		const { model, columns, layout } = setup();

		columns.value = [
			declare('a', { width: 100, resizable: true, pinnable: true }),
			declare('b', { width: 100, pinnable: true }),
			declare('c', { width: 100 }),
		];
		layout.value = { order: ['a', 'b', 'c'], hidden: [], widths: {}, pinned: { a: 'start', b: 'start' } };

		expect(model.variables.value['--dg-pin-start-b']).toBe('100px');

		model.resize('a', 160);

		const layers = model.overlay.value as readonly GeometryLayer[];
		const byColumn = new Map(layers.map(layer => [layer.selector, layer.style]));

		expect(byColumn.get(getColumnSelector('a'))?.['--dg-width-a']).toBe('160px');
		expect(byColumn.get(getColumnSelector('b'))?.['--dg-pin-start-b']).toBe('160px');
	});
});

describe('useGridColumns — offsets', () => {
	it('the first item is the start inset, then running sums of widths', () => {
		const { model, insets } = setup();

		insets.value = { start: 44, end: 0 };

		expect(model.offsets.value).toEqual([44, 244, 364, 504]);
	});

	it('a hidden column leaves the sums', () => {
		const { model } = setup();

		model.toggleColumn('price');

		expect(model.offsets.value).toEqual([0, 200, 340]);
	});
});

describe('useGridColumns — visibility, pinning, moving', () => {
	it('`toggleColumn` works only for a column with the right', () => {
		const { model, columns } = setup();

		columns.value = [declare('locked'), declare('free', { hideable: true })];

		model.toggleColumn('locked');
		expect(model.isColumnHidden('locked')).toBe(false);

		model.toggleColumn('free');
		expect(model.isColumnHidden('free')).toBe(true);
	});

	it('a second `toggleColumn` shows the column again', () => {
		const { model } = setup();

		model.toggleColumn('price');
		model.toggleColumn('price');

		expect(model.isColumnHidden('price')).toBe(false);
	});

	it('`pinColumn` works only for a column with the right', () => {
		const { model } = setup();

		model.pinColumn('price', 'start');
		expect(model.getPin('price')).toBeUndefined();

		model.pinColumn('symbol', 'start');
		expect(model.getPin('symbol')).toBe('start');
	});

	it('`pinColumn(null)` unpins', () => {
		const { model } = setup();

		model.pinColumn('symbol', 'start');
		model.pinColumn('symbol', null);

		expect(model.getPin('symbol')).toBeUndefined();
	});

	it('`moveColumnTo` moves a column to a place among the shown ones', () => {
		const { model } = setup();

		model.moveColumnTo('cap', 0);

		expect(names(model)).toEqual(['cap', 'symbol', 'price']);
	});

	it('`moveColumnTo` to the end', () => {
		const { model } = setup();

		model.moveColumnTo('symbol', 2);

		expect(names(model)).toEqual(['price', 'cap', 'symbol']);
	});

	it('a column without the move right stays in place', () => {
		const { model, columns } = setup();

		columns.value = [declare('a'), declare('b', { movable: true })];
		model.moveColumnTo('a', 1);

		expect(names(model)).toEqual(['a', 'b']);
	});

	it('a column does not move out of its pin group', () => {
		const { model, layout } = setup();

		layout.value = { order: ['symbol', 'price', 'cap'], hidden: [], widths: {}, pinned: { symbol: 'start' } };

		expect(model.canMoveColumnTo('price', 0)).toBe(false);
		expect(model.canMoveColumnTo('price', 2)).toBe(true);
	});

	it('`canMoveColumnTo` answers without changing the layout', () => {
		const { model, layout } = setup();

		model.canMoveColumnTo('cap', 0);

		expect(layout.value).toBeNull();
	});

	it('`moveColumnBy` moves by places among the shown columns and goes as far as it can', () => {
		const { model } = setup();

		expect(model.moveColumnBy('symbol', 1)).toBe(true);
		expect(names(model)).toEqual(['price', 'symbol', 'cap']);

		expect(model.moveColumnBy('symbol', 5)).toBe(true);
		expect(names(model)).toEqual(['price', 'cap', 'symbol']);

		expect(model.moveColumnBy('symbol', 1)).toBe(false);
		expect(model.canMoveColumnBy('symbol', 1)).toBe(false);
		expect(model.canMoveColumnBy('symbol', -1)).toBe(true);
	});

	it('`moveColumnBy` does not move past a column that keeps its place', () => {
		const { model, columns } = setup();

		columns.value = [
			declare('a', { movable: true }),
			declare('b', { movable: true }),
			declare('fixed'),
			declare('c', { movable: true }),
		];

		expect(model.canMoveColumnBy('b', 1)).toBe(false);
		expect(model.moveColumnBy('a', 1)).toBe(true);
		expect(names(model)).toEqual(['b', 'a', 'fixed', 'c']);
	});

	it('`moveColumnBy` by zero or for an unknown column does nothing', () => {
		const { model, layout } = setup();

		expect(model.moveColumnBy('symbol', 0)).toBe(false);
		expect(model.moveColumnBy('zzz', 1)).toBe(false);
		expect(layout.value).toBeNull();
	});

	it('`moveColumnBefore` turns a neighbour into a position', () => {
		const { model } = setup();

		model.moveColumnBefore('cap', 'symbol');

		expect(names(model)).toEqual(['cap', 'symbol', 'price']);
	});

	it('`moveColumnBefore(null)` moves to the end', () => {
		const { model } = setup();

		model.moveColumnBefore('symbol', null);

		expect(names(model)).toEqual(['price', 'cap', 'symbol']);
	});

	it('`moveColumnBefore` with an unknown target does nothing', () => {
		const { model } = setup();

		model.moveColumnBefore('symbol', 'zzz');

		expect(names(model)).toEqual(['symbol', 'price', 'cap']);
	});
});

describe('useGridColumns — batch', () => {
	function countWrites(run: (model: ReturnType<typeof setup>['model']) => void) {
		const { model, layout } = setup();
		let writes = 0;

		watch(layout, () => {
			writes += 1;
		}, { flush: 'sync' });
		run(model);

		return { writes, layout };
	}

	const threeEdits = (model: ReturnType<typeof setup>['model']) => {
		model.toggleColumn('price');
		model.toggleColumn('cap');
		model.pinColumn('symbol', 'start');
	};

	it('three changes reach the layout in one write', () => {
		const { writes, layout } = countWrites(model => model.batch(() => threeEdits(model)));

		expect(writes).toBe(1);
		expect(layout.value?.hidden).toEqual(['price', 'cap']);
		expect(layout.value?.pinned).toEqual({ symbol: 'start' });
	});

	it('the same three changes without a batch cost three writes', () => {
		const { writes, layout } = countWrites(threeEdits);

		expect(writes).toBe(3);
		expect(layout.value?.hidden).toEqual(['price', 'cap']);
	});

	it('inside a batch changes see each other', () => {
		const { model } = setup();

		model.batch(() => {
			model.toggleColumn('price');
			model.toggleColumn('cap');
		});

		expect(model.hiddenColumns.value).toEqual(new Set(['price', 'cap']));
	});

	it('a batch without changes creates no layout', () => {
		const { model, layout } = setup();

		model.batch(() => undefined);

		expect(layout.value).toBeNull();
	});

	it('an exception inside a batch does not leave pending changes behind', () => {
		const { model, layout } = setup();

		expect(() => model.batch(() => {
			model.toggleColumn('price');
			throw new Error('failure');
		})).toThrow('failure');

		expect(layout.value?.hidden).toEqual(['price']);
	});

	it('a nested batch writes once, on leaving the outer one', () => {
		const { model, layout } = setup();

		model.batch(() => {
			model.toggleColumn('price');
			model.batch(() => model.toggleColumn('cap'));

			expect(layout.value).toBeNull();
		});

		expect(layout.value?.hidden).toEqual(['price', 'cap']);
	});
});
