import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import type { TableBodyRow } from '../../src/components/context';
import { TableBody, TableCells, TableRow } from '../../src/components/table-body';
import { TableFillHandle } from '../../src/components/table-fill-handle';
import { TableFillPreview, TableRangeOverlay } from '../../src/components/table-range-overlay';
import { TableRoot } from '../../src/components/table-root';
import { editing, fill, history, navigation, ranges, sorting } from '../../src/data-table/factories';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';

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

function createTable(rows: ShallowRef<Row[]>, sorted: boolean) {
	return useDataTable({
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

type Table = ReturnType<typeof createTable>;

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	document.body.innerHTML = '';
});

function setup(sorted = false) {
	const rows: ShallowRef<Row[]> = shallowRef(initial);
	let table: Table | null = null;

	wrapper = mount(defineComponent({
		setup() {
			table = createTable(rows, sorted);

			return () => h(TableRoot, { table: table as DataTable }, {
				default: () => h(TableBody, null, {
					default: ({ rows: bodyRows }: { rows: readonly TableBodyRow[] }) => [
						...bodyRows.map(row => h(TableRow, { key: row.key, row }, { default: () => h(TableCells), $stable: true })),
						h(TableRangeOverlay, { key: 'ranges' }, {
							default: ({ corner }: { corner: boolean }) => (corner ? h(TableFillHandle) : null),
						}),
						h(TableFillPreview, { key: 'fill' }),
					],
				}),
			});
		},
	}), { attachTo: document.body });

	return { rows, table: table as unknown as Table };
}

function cell(row: number, column: string) {
	return document.querySelector(`[data-dg-part="body"] [data-dg-grid-row="${row}"] [data-dg-column="${column}"]`) as HTMLElement;
}

function key(target: Element, name: string, init: KeyboardEventInit = {}) {
	target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));
}

describe('useTableFill', () => {
	it('Ctrl+D fills the range down from its first row with copies', async () => {
		const { table, rows } = setup();

		await table.navigation.focusCell({ section: 'body', row: 0, cell: 'name' });
		table.ranges.select({ key: 'a', column: 'name' });
		table.ranges.select({ key: 'c', column: 'price' }, 'extend');
		key(cell(0, 'name'), 'd', { ctrlKey: true });

		expect(rows.value.map(row => [row.name, row.price])).toEqual([['N0', 0], ['N0', 0], ['N0', 0], ['N3', 30]]);
		expect(table.history.steps.value.at(-1)?.source).toBe('fill');
	});

	it('Ctrl+R fills the range right from its first column', async () => {
		const { table, rows } = setup();

		await table.navigation.focusCell({ section: 'body', row: 1, cell: 'id' });
		table.ranges.select({ key: 'b', column: 'id' });
		table.ranges.select({ key: 'b', column: 'price' }, 'extend');
		key(cell(1, 'id'), 'r', { ctrlKey: true });

		expect(rows.value[1]).toEqual({ id: 'b', name: 'b', price: 'b' });
	});

	it('`fill` continues numbers as a series and selects the range it filled', () => {
		const { table, rows } = setup();

		table.fill.fill({ rowStart: 0, rowEnd: 2, columnStart: 2, columnEnd: 3 }, { rowStart: 0, rowEnd: 4, columnStart: 2, columnEnd: 3 });

		expect(rows.value.map(row => row.price)).toEqual([0, 10, 20, 30]);
		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 4, columnStart: 2, columnEnd: 3 }]);
	});

	it('the handle stands in the corner piece of the last range only', async () => {
		const { table } = setup();

		table.ranges.select({ key: 'a', column: 'name' });
		table.ranges.select({ key: 'b', column: 'price' }, 'add');
		await nextTick();

		const handles = document.querySelectorAll('[data-dg-part="fill-handle"]');

		expect(handles).toHaveLength(1);
		expect(handles[0].closest('[data-dg-part="range"]')).toBe(document.querySelectorAll('[data-dg-part="range"]')[1]);
		expect(handles[0].getAttribute('aria-hidden')).toBe('true');
	});

	it('the handle goes away while a cell is being edited, and comes back after', async () => {
		const { table } = setup();

		table.ranges.select({ key: 'a', column: 'name' });
		table.editing.start({ key: 'a', column: 'name' });
		await nextTick();

		expect(document.querySelector('[data-dg-part="fill-handle"]')).toBeNull();

		table.editing.cancel();
		await nextTick();

		expect(document.querySelector('[data-dg-part="fill-handle"]')).not.toBeNull();
	});

	it('a fill that sorts the rows selects the cells it filled, where they went', () => {
		const { table } = setup(true);

		expect(table.rows.value.map(row => row.id)).toEqual(['d', 'c', 'b', 'a']);

		// `c` takes the price of `d`, and a tie keeps the rows in their source order.
		table.fill.fill({ rowStart: 0, rowEnd: 1, columnStart: 2, columnEnd: 3 }, { rowStart: 0, rowEnd: 2, columnStart: 2, columnEnd: 3 }, { series: false });

		expect(table.rows.value.map(row => row.id)).toEqual(['c', 'd', 'b', 'a']);
		expect(table.ranges.getCells()).toEqual([{ key: 'c', column: 'price' }, { key: 'd', column: 'price' }]);
	});

	it('dragging the handle draws the range being filled, and rows that come cancel the drag', async () => {
		const { table, rows } = setup();

		table.ranges.select({ key: 'a', column: 'price' });
		await nextTick();

		const handle = document.querySelector('[data-dg-part="fill-handle"]') as HTMLElement;

		handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));

		expect(table.fill.dragging.value).toBe(true);

		rows.value = [...rows.value, { id: 'e', name: 'N4', price: 40 }];
		await nextTick();

		expect(table.fill.dragging.value).toBe(false);
		expect(document.querySelector('[data-dg-part="range"][data-dg-state="fill"]')).toBeNull();
	});

	it('a drag started while another is stuck goes on from the new press', async () => {
		const { table } = setup();

		table.ranges.select({ key: 'a', column: 'price' });
		await nextTick();

		const press = () => new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });

		table.fill.start(press());
		table.fill.start(press());

		expect(table.fill.dragging.value).toBe(true);
		expect(table.fill.preview.value).toBeNull();

		window.dispatchEvent(new PointerEvent('pointerup'));

		expect(table.fill.dragging.value).toBe(false);
	});
});
