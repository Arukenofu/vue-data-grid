import '../../src/style.css';

import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { GridBodyRow } from '../../src/components/context';
import { GridBody, GridCells, GridRow } from '../../src/components/grid-body';
import { GridRangeOverlay } from '../../src/components/grid-range-overlay';
import { GridRoot } from '../../src/components/grid-root';
import { clipboard, editing, history, navigation, ranges } from '../../src/data-grid/factories';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';
import { checkboxField, numberField, selectEditor } from '../../src/editing/editors';

interface Row {
	id: string;
	name: string;
	price: number | null;
	sector: string;
	active: boolean;
}

const SECTORS = ['Tech', 'Energy', 'Health', 'Retail', 'Finance', 'Media', 'Travel', 'Food'].map(value => ({ value, label: value }));

const column = defineColumn<Row>({ editable: true });

const columns = defineColumns({
	name: column(row => row.name, { label: 'Name', width: 120, pinned: 'start', setValue: (row, name) => ({ ...row, name }) }),
	price: column(row => row.price, {
		label: 'Price',
		width: 100,
		align: 'right',
		setValue: (row, price) => ({ ...row, price }),
		...numberField(),
	}),
	sector: column(row => row.sector, { label: 'Sector', width: 120, setValue: (row, sector) => ({ ...row, sector }), editor: selectEditor({ options: SECTORS }) }),
	active: column(row => row.active, {
		label: 'Active',
		width: 80,
		setValue: (row, active) => ({ ...row, active }),
		...checkboxField(),
	}),
	note: column(row => row.id, { label: 'Note', width: 200, editable: false }),
});

function createGrid(rows: ShallowRef<Row[]>) {
	return useDataGrid({
		columns,
		rows,
		rowKey: 'id',
		rowHeight: 30,
		virtual: true,
		features: {
			navigation: navigation(),
			ranges: ranges(),
			editing: editing({
				onCommit: (commit) => {
					rows.value = [...commit.apply(rows.value)];
				},
			}),
			history: history(),
			clipboard: clipboard(),
		},
	});
}

type Grid = ReturnType<typeof createGrid>;

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

function setup() {
	const rows: ShallowRef<Row[]> = shallowRef(Array.from({ length: 40 }, (_, index) => ({
		id: `r${index}`,
		name: `Row ${index}`,
		price: index,
		sector: 'Tech',
		active: false,
	})));
	let grid: Grid | null = null;

	wrapper = mount(defineComponent({
		setup() {
			grid = createGrid(rows);

			return () => h(GridRoot, { grid: grid as DataGrid, style: { width: '400px', height: '240px', font: '14px sans-serif' } }, {
				default: () => h(GridBody, null, {
					default: ({ rows: bodyRows }: { rows: readonly GridBodyRow[] }) => [
						...bodyRows.map(row => h(GridRow, { key: row.key, row }, { default: () => h(GridCells), $stable: true })),
						h(GridRangeOverlay, { key: 'ranges' }),
					],
				}),
			});
		},
	}), { attachTo: document.body });

	return { rows, grid: grid as unknown as Grid };
}

function cell(row: number, column: string) {
	return document.querySelector<HTMLElement>(`[data-dg-part="body"] [data-dg-grid-row="${row}"] [data-dg-column="${column}"]`) as HTMLElement;
}

function editor() {
	return document.querySelector<HTMLInputElement>('[data-dg-part="editor"]');
}

function centre(element: Element) {
	const box = element.getBoundingClientRect();

	return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

describe('editing in the browser', () => {
	it('typing replaces the value, and the arrows then save it and go on, value after value', async () => {
		const { rows } = setup();

		await userEvent.click(cell(1, 'price'));
		await userEvent.keyboard('42{ArrowDown}7{ArrowRight}');

		expect(rows.value[1].price).toBe(42);
		expect(rows.value[2].price).toBe(7);
		await expect.poll(() => document.activeElement).toBe(cell(2, 'sector'));
	});

	it('a click on another cell saves the edit, and focus stays on the cell clicked', async () => {
		const { rows } = setup();

		await userEvent.dblClick(cell(1, 'name'));
		await userEvent.keyboard('{Control>}a{/Control}Renamed');
		await userEvent.click(cell(3, 'price'));

		expect(rows.value[1].name).toBe('Renamed');
		await expect.poll(() => document.activeElement).toBe(cell(3, 'price'));
		expect(editor()).toBeNull();
	});

	it('a character typed on a list cell filters the list, and Enter saves the first match', async () => {
		const { rows } = setup();

		await userEvent.click(cell(0, 'sector'));
		await userEvent.keyboard('fi');
		await expect.poll(() => [...document.querySelectorAll('[data-dg-part="editor-option"]')].map(option => option.textContent))
			.toEqual(['Finance']);
		await userEvent.keyboard('{Enter}');

		expect(rows.value[0].sector).toBe('Finance');
	});

	it('the list opens above a cell near the bottom of the view, and stays in view', async () => {
		setup();

		await userEvent.click(cell(5, 'sector'));
		await userEvent.keyboard('{Enter}');
		await expect.poll(() => document.querySelector('[data-dg-part="editor-list"]')?.getAttribute('data-dg-side')).toBe('top');

		const list = document.querySelector('[data-dg-part="editor-list"]')!.getBoundingClientRect();
		const view = document.querySelector('[data-dg-part="grid"]')!.getBoundingClientRect();

		expect(list.top).toBeGreaterThanOrEqual(view.top);
		expect(list.bottom).toBeLessThanOrEqual(cell(5, 'sector').getBoundingClientRect().top + 1);
	});

	it('a click on a choice saves it with the pointer, and focus goes back to the cell', async () => {
		const { rows } = setup();

		await userEvent.dblClick(cell(0, 'sector'));

		const retail = [...document.querySelectorAll<HTMLElement>('[data-dg-part="editor-option"]')].find(option => option.textContent === 'Retail')!;

		await userEvent.click(retail);

		expect(rows.value[0].sector).toBe('Retail');
		await expect.poll(() => document.activeElement).toBe(cell(0, 'sector'));
	});

	it('a pinned cell being edited rises over the pinned cells and the pinned pieces of a range', async () => {
		const { grid } = setup();

		grid.ranges.select({ key: 'r1', column: 'name' });
		grid.ranges.select({ key: 'r3', column: 'price' }, 'extend');
		grid.editing.start({ key: 'r2', column: 'name' });
		await nextTick();

		const layer = (element: Element) => Number(getComputedStyle(element).zIndex) || 0;
		const pieces = [...document.querySelectorAll('[data-dg-part="range-cell"]')].map(layer);

		expect(layer(cell(2, 'name'))).toBe(3);
		expect(layer(cell(3, 'name'))).toBe(1);
		expect(Math.max(...pieces)).toBeLessThan(3);
	});

	it('a range is tinted on its cells: overlapping ranges tint a cell once, and the outline has no fill', async () => {
		const { grid } = setup();

		grid.ranges.select({ key: 'r1', column: 'price' });
		grid.ranges.select({ key: 'r2', column: 'sector' }, 'extend');
		grid.ranges.select({ key: 'r2', column: 'sector' }, 'add');
		grid.ranges.select({ key: 'r3', column: 'active' }, 'extend');
		await nextTick();

		const overlapped = getComputedStyle(cell(2, 'sector'), '::before').backgroundColor;
		const single = getComputedStyle(cell(1, 'price'), '::before').backgroundColor;
		const piece = document.querySelector('[data-dg-part="range-cell"]')!;

		expect(overlapped).toBe(single);
		expect(overlapped).not.toBe('rgba(0, 0, 0, 0)');
		expect(getComputedStyle(piece).backgroundColor).toBe('rgba(0, 0, 0, 0)');
	});

	it('Ctrl with a drag over selected cells takes them out of the selection', async () => {
		const { grid } = setup();

		grid.ranges.select({ key: 'r0', column: 'price' });
		grid.ranges.select({ key: 'r3', column: 'active' }, 'extend');
		await nextTick();

		const from = centre(cell(1, 'price'));
		const to = centre(cell(2, 'sector'));

		cell(1, 'price').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: true, clientX: from.x, clientY: from.y }));
		window.dispatchEvent(new PointerEvent('pointermove', { clientX: to.x, clientY: to.y }));
		window.dispatchEvent(new PointerEvent('pointerup', { clientX: to.x, clientY: to.y }));
		await nextTick();

		expect(cell(1, 'price').getAttribute('aria-selected')).toBe('false');
		expect(cell(2, 'sector').getAttribute('aria-selected')).toBe('false');
		expect(cell(1, 'active').getAttribute('aria-selected')).toBe('true');
		expect(cell(3, 'price').getAttribute('aria-selected')).toBe('true');
	});

	it('Space on a checkbox cell toggles it, with no editor', async () => {
		const { rows } = setup();

		await userEvent.click(cell(1, 'note'));
		await userEvent.keyboard('{ArrowLeft}{ }');

		expect(rows.value[1].active).toBe(true);
		expect(editor()).toBeNull();
	});
});

describe('paste in the browser', () => {
	function paste(target: Element, text: string) {
		const data = new DataTransfer();

		data.setData('text/plain', text);

		const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });

		target.dispatchEvent(event);

		return event;
	}

	it('a paste from a spreadsheet writes its rows over the focused cell, quoted line breaks and all', async () => {
		const { rows } = setup();

		await userEvent.click(cell(1, 'name'));

		const event = paste(cell(1, 'name'), '"Two\nlines"\t5\r\n"She said ""hi"""\t\r\n');

		expect(event.defaultPrevented).toBe(true);
		expect(rows.value[1]).toMatchObject({ name: 'Two\nlines', price: 5 });
		expect(rows.value[2]).toMatchObject({ name: 'She said "hi"', price: null });
	});

	it('a value pasted over a column fills it, and one undo takes it back', async () => {
		const { rows, grid } = setup();

		await userEvent.click(cell(0, 'note'));
		await userEvent.keyboard('{ArrowLeft}{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
		paste(cell(0, 'active'), 'TRUE\r\n');

		expect(rows.value.slice(0, 4).map(row => row.active)).toEqual([true, true, true, false]);

		grid.history.undo();

		expect(rows.value.slice(0, 3).map(row => row.active)).toEqual([false, false, false]);
	});
});
