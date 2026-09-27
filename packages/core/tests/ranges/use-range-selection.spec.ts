import { defineColumns, useCellFocus, useCellRanges } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TableBodyRow } from '../../src/components/context';
import { TableBody, TableCells, TableRow } from '../../src/components/table-body';
import { TableRangeOverlay } from '../../src/components/table-range-overlay';
import { TableRoot } from '../../src/components/table-root';
import { navigation, ranges } from '../../src/data-table/factories';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';
import { useRangeSelection } from '../../src/ranges/use-range-selection';

interface Row {
	id: string;
	price: number;
}

const renders = new Map<string, number>();

const columns = defineColumns({
	number: { value: (row: Row) => row.id, label: '#', kind: 'service' },
	id: {
		value: (row: Row) => row.id,
		label: 'Id',
		cell: ({ key, value }) => {
			renders.set(key, (renders.get(key) ?? 0) + 1);

			return value;
		},
	},
	price: { value: (row: Row) => row.price, label: 'Price' },
	cap: { value: (row: Row) => row.price * 10, label: 'Cap' },
});

const initial: Row[] = ['a', 'b', 'c', 'd'].map((id, index) => ({ id, price: index }));

function createTable(rows: ShallowRef<Row[]>, withNavigation: boolean) {
	const options = { columns, rows, rowKey: 'id', rowHeight: 30 } as const;

	return withNavigation
		? useDataTable({ ...options, features: { navigation: navigation(), ranges: ranges() } })
		: useDataTable({ ...options, features: { ranges: ranges() } });
}

type Table = ReturnType<typeof createTable>;

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	renders.clear();
	document.body.innerHTML = '';
});

function setup(withNavigation = true) {
	const rows = shallowRef(initial);
	let table: Table | null = null;

	wrapper = mount(defineComponent({
		setup() {
			table = createTable(rows, withNavigation);

			return () => h(TableRoot, { table: table as DataTable }, {
				default: () => h(TableBody, null, {
					default: ({ rows: bodyRows }: { rows: readonly TableBodyRow[] }) => [
						...bodyRows.map(row => h(TableRow, { key: row.key, row }, { default: () => h(TableCells), $stable: true })),
						h(TableRangeOverlay, { key: 'ranges' }),
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

function press(target: HTMLElement, init: PointerEventInit = {}) {
	target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ...init }));
	window.dispatchEvent(new PointerEvent('pointerup'));
}

function key(target: HTMLElement, name: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });

	target.dispatchEvent(event);

	return event;
}

function selectedCells() {
	return [...document.querySelectorAll('[data-dg-part="body"] [aria-selected="true"]')]
		.map(element => `${element.closest('[data-dg-grid-row]')?.getAttribute('data-dg-grid-row')}:${element.getAttribute('data-dg-column')}`);
}

describe('useRangeSelection — the pointer', () => {
	it('a press selects the cell and focuses it; Shift extends the range to another', async () => {
		const { table } = setup();

		press(cell(1, 'id'));
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'id')));

		press(cell(2, 'price'), { shiftKey: true });
		await nextTick();

		expect(table.ranges.bounds.value).toEqual([{ rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 2 }]);
		expect(selectedCells()).toEqual(['1:id', '1:price', '2:id', '2:price']);
		// The focused cell stays where the range started.
		expect(document.activeElement).toBe(cell(1, 'id'));
	});

	it('Ctrl adds another range, a plain press replaces them all', () => {
		const { table } = setup();

		press(cell(0, 'id'));
		press(cell(3, 'cap'), { ctrlKey: true });

		expect(table.ranges.selectedRanges.value).toHaveLength(2);

		press(cell(2, 'price'));

		expect(table.ranges.selectedRanges.value).toHaveLength(1);
	});

	it('Ctrl on a selected cell takes it out, and focus stays where it was', async () => {
		const { table } = setup();

		press(cell(0, 'id'));
		press(cell(1, 'price'), { shiftKey: true });
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'id')));

		press(cell(1, 'price'), { ctrlKey: true });
		await nextTick();

		expect(selectedCells()).toEqual(['0:id', '0:price', '1:id']);
		expect(document.activeElement).toBe(cell(0, 'id'));
		expect(table.ranges.selectedRanges.value).toHaveLength(2);
	});

	it('Ctrl presses on one cell switch it in and out: ranges never pile up on it', async () => {
		const { table } = setup();

		press(cell(0, 'id'));

		for (let count = 0; count < 5; count += 1) {
			press(cell(2, 'cap'), { ctrlKey: true });
		}

		await nextTick();

		const covered = table.ranges.bounds.value
			.map(bounds => (bounds.rowEnd - bounds.rowStart) * (bounds.columnEnd - bounds.columnStart))
			.reduce((sum, size) => sum + size, 0);

		expect(selectedCells()).toEqual(['0:id', '2:cap']);
		expect(covered).toBe(2);

		press(cell(2, 'cap'), { metaKey: true });
		await nextTick();

		expect(selectedCells()).toEqual(['0:id']);
	});

	it('corners are row keys, so a range stays on its rows through a new order', async () => {
		const { table, rows } = setup();

		press(cell(0, 'id'));
		rows.value = [...rows.value].reverse();
		await nextTick();

		expect(table.ranges.selectedRanges.value[0].anchor).toEqual({ key: 'a', column: 'id' });
		expect(selectedCells()).toEqual(['3:id']);
	});

	it('cells of a column ranges leave out, such as a service column, carry no `aria-selected`', () => {
		setup();

		expect(cell(0, 'number').hasAttribute('aria-selected')).toBe(false);
		expect(cell(0, 'id').getAttribute('aria-selected')).toBe('false');
	});

	it('a press on a service column or on a control in a cell is left alone', () => {
		const { table } = setup();
		const button = document.createElement('button');

		cell(1, 'price').append(button);
		press(cell(1, 'number'));
		press(button);

		expect(table.ranges.selectedRanges.value).toEqual([]);
	});
});

describe('useRangeSelection — the keys', () => {
	it('Shift with the arrows moves the other corner, and focus stays', async () => {
		const { table } = setup();

		press(cell(0, 'id'));
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'id')));

		expect(key(cell(0, 'id'), 'ArrowDown', { shiftKey: true }).defaultPrevented).toBe(true);
		key(cell(0, 'id'), 'ArrowRight', { shiftKey: true });
		await nextTick();

		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 }]);
		expect(document.activeElement).toBe(cell(0, 'id'));
	});

	it('Ctrl+Shift with an arrow extends to the edge', () => {
		const { table } = setup();

		press(cell(1, 'id'));
		key(cell(1, 'id'), 'ArrowDown', { shiftKey: true, ctrlKey: true });

		expect(table.ranges.bounds.value[0]).toMatchObject({ rowStart: 1, rowEnd: 4 });
	});

	it('an arrow without Shift moves focus and the range goes with it', async () => {
		const { table } = setup();

		press(cell(0, 'id'));
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'id')));
		key(cell(0, 'id'), 'ArrowDown', { shiftKey: true });
		key(cell(0, 'id'), 'ArrowRight');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'price')));

		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 1, columnStart: 1, columnEnd: 2 }]);
	});

	it('Ctrl+A selects every cell, Ctrl+Space whole columns, Escape the focused cell alone', () => {
		const { table } = setup();

		press(cell(1, 'price'));
		key(cell(1, 'price'), 'a', { ctrlKey: true });

		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 3 }]);

		press(cell(1, 'price'));
		key(cell(1, 'price'), ' ', { ctrlKey: true });

		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 4, columnStart: 1, columnEnd: 2 }]);

		expect(key(cell(1, 'price'), 'Escape').defaultPrevented).toBe(true);
		expect(table.ranges.bounds.value).toEqual([{ rowStart: 1, rowEnd: 2, columnStart: 1, columnEnd: 2 }]);
		// Collapsed already: Escape is left to whatever else takes it.
		expect(key(cell(1, 'price'), 'Escape').defaultPrevented).toBe(false);
	});

	it('works without the navigation: the table element takes focus', () => {
		const { table } = setup(false);

		press(cell(0, 'id'));
		press(cell(1, 'price'), { shiftKey: true });

		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 }]);
		expect(document.activeElement).toBe(document.querySelector('[data-dg-part="table"]'));
	});
});

describe('TableRangeOverlay and the cells', () => {
	it('draws each range as a row of pieces, and cells of a range get `aria-selected`', async () => {
		setup();

		press(cell(1, 'id'));
		press(cell(2, 'price'), { shiftKey: true });
		await nextTick();

		const range = document.querySelector('[data-dg-part="range"]');

		expect(range?.getAttribute('aria-hidden')).toBe('true');
		expect(range?.querySelectorAll('[data-dg-part="range-cell"]')).toHaveLength(1);
		expect(cell(0, 'id').getAttribute('aria-selected')).toBe('false');
		expect(document.querySelector('[data-dg-part="table"]')?.getAttribute('aria-multiselectable')).toBe('true');
	});

	it('a range that grows renders no row: `aria-selected` of its cells is written without a render', async () => {
		const { table } = setup();

		press(cell(0, 'id'));
		await nextTick();
		renders.clear();

		table.ranges.select({ key: 'b', column: 'id' }, 'extend');
		await nextTick();

		expect(selectedCells()).toEqual(['0:id', '1:id']);

		table.ranges.select({ key: 'd', column: 'cap' }, 'extend');
		await nextTick();

		expect(selectedCells()).toHaveLength(12);
		expect(Object.fromEntries(renders)).toEqual({});
	});

	it('cells a render brings back keep their `aria-selected`', async () => {
		const { table, rows } = setup();

		table.ranges.select({ key: 'a', column: 'id' });
		await nextTick();
		rows.value = [{ ...rows.value[0], price: 99 }, ...rows.value.slice(1)];
		await nextTick();

		expect(cell(0, 'id').getAttribute('aria-selected')).toBe('true');
	});
});

describe('useRangeSelection — around the press', () => {
	it('a press drops text selected on the page, so that a copy takes the cells', () => {
		setup();

		const text = document.createElement('p');

		text.textContent = 'Text on the page';
		document.body.append(text);
		document.getSelection()?.selectAllChildren(text);
		press(cell(0, 'id'));

		expect(document.getSelection()?.isCollapsed).toBe(true);
	});

	it('works with the cell focus of the core, as a grid on `aria-activedescendant` has it', () => {
		const rows = shallowRef(initial);
		let focus: ReturnType<typeof useCellFocus> | null = null;
		let selection: ReturnType<typeof useCellRanges> | null = null;

		wrapper = mount(defineComponent({
			setup() {
				const table = useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30 });

				focus = useCellFocus(table.scope);
				selection = useCellRanges(table.scope);
				useRangeSelection(table, { ranges: selection, focus });

				return () => h(TableRoot, { table: table as DataTable }, {
					default: () => h(TableBody, null, {
						default: ({ rows: bodyRows }: { rows: readonly TableBodyRow[] }) => bodyRows.map(row => h(
							TableRow,
							{ key: row.key, row },
							{ default: () => h(TableCells), $stable: true },
						)),
					}),
				});
			},
		}), { attachTo: document.body });

		const cellFocus = focus!;
		const cellRanges = selection!;

		press(cell(1, 'id'));
		press(cell(2, 'price'), { shiftKey: true });

		expect(cellFocus.focused.value).toMatchObject({ key: 'b', column: 'id' });
		expect(cellRanges.bounds.value).toEqual([{ rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 2 }]);

		cellFocus.move('down');

		expect(cellRanges.bounds.value).toEqual([{ rowStart: 2, rowEnd: 3, columnStart: 0, columnEnd: 1 }]);
	});
});
