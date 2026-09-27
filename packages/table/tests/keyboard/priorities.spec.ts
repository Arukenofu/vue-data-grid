import { defineColumn, defineColumns } from '@vue-stack/table-core';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TableBodyRow } from '../../src/components/context';
import { TableBody, TableCells, TableRow } from '../../src/components/table-body';
import { TableRangeOverlay } from '../../src/components/table-range-overlay';
import { TableRoot } from '../../src/components/table-root';
import { clipboard, editing, fill, history, navigation, ranges, selection } from '../../src/data-table/factories';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';
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

function createTable(rows: ShallowRef<Row[]>) {
	return useDataTable({
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
	let table: ReturnType<typeof createTable> | null = null;

	wrapper = mount(defineComponent({
		setup() {
			table = createTable(rows);

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

	return { rows, table: table as unknown as ReturnType<typeof createTable> };
}

function cell(row: number, column: string) {
	return document.querySelector(`[data-tc-part="body"] [data-tc-grid-row="${row}"] [data-tc-column="${column}"]`) as HTMLElement;
}

function key(target: Element, name: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });

	target.dispatchEvent(event);

	return event;
}

async function focus(table: ReturnType<typeof createTable>, row: number, column: string) {
	await table.navigation.focusCell({ section: 'body', row, cell: column });
}

describe('who takes a key on a cell of a table with every feature', () => {
	it('Ctrl+A selects every cell, not every row', async () => {
		const { table } = setup();

		await focus(table, 0, 'name');
		key(cell(0, 'name'), 'a', { ctrlKey: true });

		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 2 }]);
		expect(table.selection.selectedCount.value).toBe(0);
	});

	it('Shift with an arrow extends the range and keeps focus; an arrow alone moves focus', async () => {
		const { table } = setup();

		await focus(table, 0, 'name');
		key(cell(0, 'name'), 'ArrowDown', { shiftKey: true });

		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 1 }]);
		expect(document.activeElement).toBe(cell(0, 'name'));

		key(cell(0, 'name'), 'ArrowRight');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'price')));
	});

	it('Shift+Space toggles the row; Ctrl+Space selects the column as a range', async () => {
		const { table } = setup();

		await focus(table, 1, 'price');
		key(cell(1, 'price'), ' ', { shiftKey: true });

		expect(table.selection.isSelected('b')).toBe(true);

		key(cell(1, 'price'), ' ', { ctrlKey: true });

		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 3, columnStart: 1, columnEnd: 2 }]);
	});

	it('Enter and a character start editing rather than move focus', async () => {
		const { table } = setup();

		await focus(table, 0, 'name');

		expect(key(cell(0, 'name'), 'Enter').defaultPrevented).toBe(true);
		expect(table.editing.cell.value).toMatchObject({ key: 'a', column: 'name' });
	});

	it('Escape in an editor cancels it; on a cell it collapses the ranges', async () => {
		const { table, rows } = setup();

		await focus(table, 0, 'name');
		key(cell(0, 'name'), 'x');
		await nextTick();
		key(document.querySelector('[data-tc-part="editor"]') as HTMLElement, 'Escape');

		expect(table.editing.cell.value).toBeNull();
		expect(rows.value[0].name).toBe('Alpha');

		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'name')));
		key(cell(0, 'name'), 'ArrowDown', { shiftKey: true });

		expect(key(cell(0, 'name'), 'Escape').defaultPrevented).toBe(true);
		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 }]);
	});

	it('Delete clears, Ctrl+D fills down, Ctrl+Z undoes: each once, by the feature that owns it', async () => {
		const { table, rows } = setup();

		await focus(table, 0, 'price');
		key(cell(0, 'price'), 'ArrowDown', { shiftKey: true });
		key(cell(0, 'price'), 'd', { ctrlKey: true });

		expect(rows.value.map(row => row.price)).toEqual([1, 1, 3]);

		key(cell(0, 'price'), 'Delete');

		expect(rows.value.map(row => row.price)).toEqual([null, null, 3]);

		key(cell(0, 'price'), 'z', { ctrlKey: true });

		expect(rows.value.map(row => row.price)).toEqual([1, 1, 3]);
		expect(table.history.steps.value.map(step => step.source)).toEqual(['fill']);
	});
});
