import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import type { GridBodyRow } from '../../src/components/context';
import { GridBody, GridCells, GridRow } from '../../src/components/grid-body';
import { GridFillHandle } from '../../src/components/grid-fill-handle';
import { GridFillPreview, GridRangeOverlay } from '../../src/components/grid-range-overlay';
import { GridRoot } from '../../src/components/grid-root';
import { editing, fill, history, navigation, ranges, sorting } from '../../src/data-grid/factories';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';

interface Row {
	id: string;
	name: string;
	price: number;
}

const column = defineColumn<Row>({ editable: true });

const columns = defineColumns({
	id: column(row => row.id, { editable: false }),
	name: column(row => row.name, { setValue: (row, name) => ({ ...row, name }) }),
	price: column(row => row.price, { setValue: (row, price) => ({ ...row, price }) }),
});

const initial: Row[] = ['a', 'b', 'c', 'd'].map((id, index) => ({ id, name: `N${index}`, price: index * 10 }));

function createGrid(rows: ShallowRef<Row[]>, sorted: boolean) {
	return useDataGrid({
		columns,
		rows,
		rowKey: 'id',
		rowHeight: 30,
		sort: sorted ? [{ name: 'price', direction: 'desc' }] : [],
		features: {
			sorting: sorting(),
			navigation: navigation(),
			ranges: ranges(),
			editing: editing({
				onCommit: (commit) => {
					rows.value = [...commit.apply(rows.value)];
				},
			}),
			history: history(),
			fill: fill(),
		},
	});
}

type Grid = ReturnType<typeof createGrid>;

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	document.body.innerHTML = '';
});

function setup(sorted = false) {
	const rows: ShallowRef<Row[]> = shallowRef(initial);
	let grid: Grid | null = null;

	wrapper = mount(defineComponent({
		setup() {
			grid = createGrid(rows, sorted);

			return () => h(GridRoot, { grid: grid as DataGrid }, {
				default: () => h(GridBody, null, {
					default: ({ rows: bodyRows }: { rows: readonly GridBodyRow[] }) => [
						...bodyRows.map(row => h(GridRow, { key: row.key, row }, { default: () => h(GridCells), $stable: true })),
						h(GridRangeOverlay, { key: 'ranges' }, {
							default: ({ corner }: { corner: boolean }) => (corner ? h(GridFillHandle) : null),
						}),
						h(GridFillPreview, { key: 'fill' }),
					],
				}),
			});
		},
	}), { attachTo: document.body });

	return { rows, grid: grid as unknown as Grid };
}

function cell(row: number, column: string) {
	return document.querySelector(`[data-dg-part="body"] [data-dg-grid-row="${row}"] [data-dg-column="${column}"]`) as HTMLElement;
}

function key(target: Element, name: string, init: KeyboardEventInit = {}) {
	target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));
}

describe('useGridFill', () => {
	it('Ctrl+D fills the range down from its first row with copies', async () => {
		const { grid, rows } = setup();

		await grid.navigation.focusCell({ section: 'body', row: 0, cell: 'name' });
		grid.ranges.select({ key: 'a', column: 'name' });
		grid.ranges.select({ key: 'c', column: 'price' }, 'extend');
		key(cell(0, 'name'), 'd', { ctrlKey: true });

		expect(rows.value.map(row => [row.name, row.price])).toEqual([['N0', 0], ['N0', 0], ['N0', 0], ['N3', 30]]);
		expect(grid.history.steps.value.at(-1)?.source).toBe('fill');
	});

	it('Ctrl+R fills the range right from its first column', async () => {
		const { grid, rows } = setup();

		await grid.navigation.focusCell({ section: 'body', row: 1, cell: 'id' });
		grid.ranges.select({ key: 'b', column: 'id' });
		grid.ranges.select({ key: 'b', column: 'price' }, 'extend');
		key(cell(1, 'id'), 'r', { ctrlKey: true });

		expect(rows.value[1]).toEqual({ id: 'b', name: 'b', price: 'b' });
	});

	it('`fill` continues numbers as a series and selects the range it filled', () => {
		const { grid, rows } = setup();

		grid.fill.fill({ rowStart: 0, rowEnd: 2, columnStart: 2, columnEnd: 3 }, { rowStart: 0, rowEnd: 4, columnStart: 2, columnEnd: 3 });

		expect(rows.value.map(row => row.price)).toEqual([0, 10, 20, 30]);
		expect(grid.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 4, columnStart: 2, columnEnd: 3 }]);
	});

	it('the handle stands in the corner piece of the last range only', async () => {
		const { grid } = setup();

		grid.ranges.select({ key: 'a', column: 'name' });
		grid.ranges.select({ key: 'b', column: 'price' }, 'add');
		await nextTick();

		const handles = document.querySelectorAll('[data-dg-part="fill-handle"]');

		expect(handles).toHaveLength(1);
		expect(handles[0].closest('[data-dg-part="range"]')).toBe(document.querySelectorAll('[data-dg-part="range"]')[1]);
		expect(handles[0].getAttribute('aria-hidden')).toBe('true');
	});

	it('the handle goes away while a cell is being edited, and comes back after', async () => {
		const { grid } = setup();

		grid.ranges.select({ key: 'a', column: 'name' });
		grid.editing.start({ key: 'a', column: 'name' });
		await nextTick();

		expect(document.querySelector('[data-dg-part="fill-handle"]')).toBeNull();

		grid.editing.cancel();
		await nextTick();

		expect(document.querySelector('[data-dg-part="fill-handle"]')).not.toBeNull();
	});

	it('a fill that sorts the rows selects the cells it filled, where they went', () => {
		const { grid } = setup(true);

		expect(grid.rows.value.map(row => row.id)).toEqual(['d', 'c', 'b', 'a']);

		// `c` takes the price of `d`, and a tie keeps the rows in their source order.
		grid.fill.fill({ rowStart: 0, rowEnd: 1, columnStart: 2, columnEnd: 3 }, { rowStart: 0, rowEnd: 2, columnStart: 2, columnEnd: 3 }, { series: false });

		expect(grid.rows.value.map(row => row.id)).toEqual(['c', 'd', 'b', 'a']);
		expect(grid.ranges.getCells()).toEqual([{ key: 'c', column: 'price' }, { key: 'd', column: 'price' }]);
	});

	it('dragging the handle draws the range being filled, and rows that come cancel the drag', async () => {
		const { grid, rows } = setup();

		grid.ranges.select({ key: 'a', column: 'price' });
		await nextTick();

		const handle = document.querySelector('[data-dg-part="fill-handle"]') as HTMLElement;

		handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));

		expect(grid.fill.dragging.value).toBe(true);

		rows.value = [...rows.value, { id: 'e', name: 'N4', price: 40 }];
		await nextTick();

		expect(grid.fill.dragging.value).toBe(false);
		expect(document.querySelector('[data-dg-part="range"][data-dg-state="fill"]')).toBeNull();
	});

	it('a drag started while another is stuck goes on from the new press', async () => {
		const { grid } = setup();

		grid.ranges.select({ key: 'a', column: 'price' });
		await nextTick();

		const press = () => new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });

		grid.fill.start(press());
		grid.fill.start(press());

		expect(grid.fill.dragging.value).toBe(true);
		expect(grid.fill.preview.value).toBeNull();

		window.dispatchEvent(new PointerEvent('pointerup'));

		expect(grid.fill.dragging.value).toBe(false);
	});
});
