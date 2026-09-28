import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridBodyRow } from '../../src/components/context';
import { GridBody, GridCells, GridRow } from '../../src/components/grid-body';
import { GridRangeOverlay } from '../../src/components/grid-range-overlay';
import { GridRoot } from '../../src/components/grid-root';
import { clipboard, editing, fill, history, navigation, ranges, selection } from '../../src/data-grid/factories';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';
import { numberField } from '../../src/editing/editors';

interface Row {
	id: string;
	name: string;
	price: number | null;
}

const column = defineColumn<Row>({ editable: true });

const columns = defineColumns({
	name: column(row => row.name, { setValue: (row, name) => ({ ...row, name }) }),
	price: column(row => row.price, { setValue: (row, price) => ({ ...row, price }), ...numberField() }),
});

const initial: Row[] = [
	{ id: 'a', name: 'Alpha', price: 1 },
	{ id: 'b', name: 'Beta', price: 2 },
	{ id: 'c', name: 'Gamma', price: 3 },
];

function createGrid(rows: ShallowRef<Row[]>) {
	return useDataGrid({
		columns,
		rows,
		rowKey: 'id',
		rowHeight: 30,
		features: {
			selection: selection(),
			navigation: navigation(),
			ranges: ranges(),
			editing: editing({
				onCommit: (commit) => {
					rows.value = [...commit.apply(rows.value)];
				},
			}),
			history: history(),
			fill: fill(),
			clipboard: clipboard(),
		},
	});
}

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	document.body.innerHTML = '';
});

function setup() {
	const rows: ShallowRef<Row[]> = shallowRef(initial);
	let grid: ReturnType<typeof createGrid> | null = null;

	wrapper = mount(defineComponent({
		setup() {
			grid = createGrid(rows);

			return () => h(GridRoot, { grid: grid as DataGrid }, {
				default: () => h(GridBody, null, {
					default: ({ rows: bodyRows }: { rows: readonly GridBodyRow[] }) => [
						...bodyRows.map(row => h(GridRow, { key: row.key, row }, { default: () => h(GridCells), $stable: true })),
						h(GridRangeOverlay, { key: 'ranges' }),
					],
				}),
			});
		},
	}), { attachTo: document.body });

	return { rows, grid: grid as unknown as ReturnType<typeof createGrid> };
}

function cell(row: number, column: string) {
	return document.querySelector(`[data-dg-part="body"] [data-dg-grid-row="${row}"] [data-dg-column="${column}"]`) as HTMLElement;
}

function key(target: Element, name: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });

	target.dispatchEvent(event);

	return event;
}

async function focus(grid: ReturnType<typeof createGrid>, row: number, column: string) {
	await grid.navigation.focusCell({ section: 'body', row, cell: column });
}

describe('who takes a key on a cell of a grid with every feature', () => {
	it('Ctrl+A selects every cell, not every row', async () => {
		const { grid } = setup();

		await focus(grid, 0, 'name');
		key(cell(0, 'name'), 'a', { ctrlKey: true });

		expect(grid.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 2 }]);
		expect(grid.selection.selectedCount.value).toBe(0);
	});

	it('Shift with an arrow extends the range and keeps focus; an arrow alone moves focus', async () => {
		const { grid } = setup();

		await focus(grid, 0, 'name');
		key(cell(0, 'name'), 'ArrowDown', { shiftKey: true });

		expect(grid.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 1 }]);
		expect(document.activeElement).toBe(cell(0, 'name'));

		key(cell(0, 'name'), 'ArrowRight');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'price')));
	});

	it('Shift+Space toggles the row; Ctrl+Space selects the column as a range', async () => {
		const { grid } = setup();

		await focus(grid, 1, 'price');
		key(cell(1, 'price'), ' ', { shiftKey: true });

		expect(grid.selection.isSelected('b')).toBe(true);

		key(cell(1, 'price'), ' ', { ctrlKey: true });

		expect(grid.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 3, columnStart: 1, columnEnd: 2 }]);
	});

	it('Enter and a character start editing rather than move focus', async () => {
		const { grid } = setup();

		await focus(grid, 0, 'name');

		expect(key(cell(0, 'name'), 'Enter').defaultPrevented).toBe(true);
		expect(grid.editing.cell.value).toMatchObject({ key: 'a', column: 'name' });
	});

	it('Escape in an editor cancels it; on a cell it collapses the ranges', async () => {
		const { grid, rows } = setup();

		await focus(grid, 0, 'name');
		key(cell(0, 'name'), 'x');
		await nextTick();
		key(document.querySelector('[data-dg-part="editor"]') as HTMLElement, 'Escape');

		expect(grid.editing.cell.value).toBeNull();
		expect(rows.value[0].name).toBe('Alpha');

		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'name')));
		key(cell(0, 'name'), 'ArrowDown', { shiftKey: true });

		expect(key(cell(0, 'name'), 'Escape').defaultPrevented).toBe(true);
		expect(grid.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 }]);
	});

	it('Delete clears, Ctrl+D fills down, Ctrl+Z undoes: each once, by the feature that owns it', async () => {
		const { grid, rows } = setup();

		await focus(grid, 0, 'price');
		key(cell(0, 'price'), 'ArrowDown', { shiftKey: true });
		key(cell(0, 'price'), 'd', { ctrlKey: true });

		expect(rows.value.map(row => row.price)).toEqual([1, 1, 3]);

		key(cell(0, 'price'), 'Delete');

		expect(rows.value.map(row => row.price)).toEqual([null, null, 3]);

		key(cell(0, 'price'), 'z', { ctrlKey: true });

		expect(rows.value.map(row => row.price)).toEqual([1, 1, 3]);
		expect(grid.history.steps.value.map(step => step.source)).toEqual(['fill']);
	});
});
