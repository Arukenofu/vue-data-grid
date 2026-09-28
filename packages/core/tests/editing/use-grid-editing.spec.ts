import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef, type VNodeChild } from 'vue';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { CellWriteResult, EditingCell as EditingCellOf } from '@vue-data-grid/engine';

import type { CellContext, CellEditor } from '../../src/columns/column-fields';
import type { GridBodyRow } from '../../src/components/context';
import { GridBody, GridCells, GridRow } from '../../src/components/grid-body';
import { GridRangeOverlay } from '../../src/components/grid-range-overlay';
import { GridRoot } from '../../src/components/grid-root';
import { clipboard, editing, history, navigation, ranges, sorting } from '../../src/data-grid/factories';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';
import { checkboxField, dateField, numberField, selectEditor, textEditor } from '../../src/editing/editors';
import type { GridEditingOptions } from '../../src/editing/use-grid-editing';

interface Row {
	id: string;
	name: string;
	price: number | null;
	sector: string;
	active: boolean;
	due: string | null;
	note: string;
}

const SECTORS = [
	{ value: 'Tech', label: 'Technology' },
	{ value: 'Energy', label: 'Energy' },
	{ value: 'Health', label: 'Health care', disabled: true },
	{ value: 'Retail', label: 'Retail' },
];

const column = defineColumn<Row>();

const columns = defineColumns({
	id: column(row => row.id, { label: 'Id' }),
	name: column(row => row.name, {
		label: 'Name',
		editable: true,
		setValue: (row, name) => ({ ...row, name }),
		validate: name => (name === '' ? 'Required' : undefined),
	}),
	price: column(row => row.price, {
		label: 'Price',
		align: 'right',
		editable: true,
		setValue: (row, price) => ({ ...row, price }),
		validate: price => (Number.isNaN(price) ? 'Not a number' : undefined),
		...numberField({ step: 5 }),
	}),
	sector: column(row => row.sector, {
		label: 'Sector',
		editable: true,
		setValue: (row, sector) => ({ ...row, sector }),
		editor: selectEditor({ options: SECTORS }),
	}),
	active: column(row => row.active, {
		label: 'Active',
		// The first row is locked: its box shows, but cannot be changed.
		editable: row => row.id !== 'a',
		setValue: (row, active) => ({ ...row, active }),
		...checkboxField(),
	}),
	due: column(row => row.due, {
		label: 'Due',
		editable: true,
		setValue: (row, due) => ({ ...row, due }),
		...dateField({ value: 'text', min: '2026-01-01' }),
	}),
	note: column(row => row.note, {
		label: 'Note',
		editable: true,
		setValue: (row, note) => ({ ...row, note }),
		editor: textEditor({ multiline: true }),
	}),
});

const initial: Row[] = [
	{ id: 'a', name: 'Alpha', price: 1, sector: 'Tech', active: true, due: '2026-10-01', note: '' },
	{ id: 'b', name: 'Beta', price: 2, sector: 'Energy', active: false, due: null, note: '' },
	{ id: 'c', name: 'Gamma', price: 3, sector: 'Tech', active: true, due: '2026-10-03', note: '' },
];

type Grid = ReturnType<typeof createGrid>;

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	document.body.innerHTML = '';
});

interface SetupOptions extends Partial<GridEditingOptions<Row>> {
	/** The default slot of `GridCells`, to see the context of each cell. */
	cellSlot?: (context: CellContext<unknown, unknown>) => VNodeChild;
	/** Sort the rows by their names, so that a write can move them. */
	sorted?: boolean;
}

function createGrid(rows: ShallowRef<Row[]>, options: SetupOptions) {
	const { cellSlot: _cellSlot, sorted, ...editingOptions } = options;

	return useDataGrid({
		columns,
		rows,
		rowKey: 'id',
		rowHeight: 30,
		sort: sorted ? [{ name: 'name', direction: 'asc' }] : [],
		features: {
			sorting: sorting(),
			navigation: navigation(),
			ranges: ranges(),
			editing: editing({
				onCommit: (commit) => {
					rows.value = [...commit.apply(rows.value)];
				},
				...editingOptions,
			}),
			history: history(),
			clipboard: clipboard(),
		},
	});
}

function setup(options: SetupOptions = {}) {
	const rows: ShallowRef<Row[]> = shallowRef(initial);
	let grid: Grid | null = null;

	wrapper = mount(defineComponent({
		setup() {
			grid = createGrid(rows, options);

			return () => h(GridRoot, { grid: grid as DataGrid }, {
				default: () => h(GridBody, null, {
					default: ({ rows: bodyRows }: { rows: readonly GridBodyRow[] }) => [
						...bodyRows.map(row => h(GridRow, { key: row.key, row }, {
							default: () => h(GridCells, null, options.cellSlot ? { default: options.cellSlot } : undefined),
							$stable: true,
						})),
						h(GridRangeOverlay, { key: 'ranges' }),
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

function editor() {
	return document.querySelector('[data-dg-part="editor"]') as HTMLInputElement | null;
}

function key(target: Element, name: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });

	// happy-dom leaves `isComposing` of the init out.
	Object.defineProperty(event, 'isComposing', { value: init.isComposing ?? false });
	target.dispatchEvent(event);

	return event;
}

async function focusCell(grid: Grid, row: number, column: string) {
	await grid.navigation.focusCell({ section: 'body', row, cell: column });
}

function type(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
	input.value = text;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

function clipboardEvent(type: 'paste' | 'cut', target: Element, text = '') {
	const data = new Map<string, string>([['text/plain', text]]);
	const event = new Event(type, { bubbles: true, cancelable: true });

	Object.defineProperty(event, 'clipboardData', {
		value: { getData: (format: string) => data.get(format) ?? '', setData: (format: string, value: string) => data.set(format, value) },
	});
	target.dispatchEvent(event);

	return { data, event };
}

/** Starts editing a cell by a key on it, as a user does. */
async function startWith(grid: Grid, row: number, column: string, name: string, init: KeyboardEventInit = {}) {
	await focusCell(grid, row, column);
	key(cell(row, column), name, init);
	await nextTick();

	return editor() as HTMLInputElement;
}

describe('useGridEditing — starting and ending', () => {
	it('Enter starts editing with the value; Enter in the editor commits and goes down', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'name', 'Enter');

		expect(input.value).toBe('Alpha');
		expect(document.activeElement).toBe(input);
		expect(cell(0, 'name').getAttribute('data-dg-state')).toBe('editing');

		type(input, 'Apex');
		key(input, 'Enter');

		expect(rows.value[0].name).toBe('Apex');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'name')));
		expect(editor()).toBeNull();
	});

	it('a typed character starts editing with that character; Tab commits and goes across', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 1, 'name', 'Z');

		expect(input.value).toBe('Z');

		key(input, 'Tab');

		expect(rows.value[1].name).toBe('Z');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'price')));
	});

	it('a character typed with AltGr starts editing; one with Ctrl or ⌘ alone does not', async () => {
		const { grid } = setup();

		await focusCell(grid, 0, 'name');

		const shortcut = key(cell(0, 'name'), 'q', { ctrlKey: true });

		expect(shortcut.defaultPrevented).toBe(false);
		expect(grid.editing.cell.value).toBeNull();

		const altGraph = new KeyboardEvent('keydown', { key: '@', ctrlKey: true, altKey: true, bubbles: true, cancelable: true });

		Object.defineProperty(altGraph, 'getModifierState', { value: (name: string) => name === 'AltGraph' });
		cell(0, 'name').dispatchEvent(altGraph);
		await nextTick();

		expect(editor()?.value).toBe('@');
	});

	it('Escape cancels and focus goes back to the cell; a double click starts editing', async () => {
		const { grid, rows } = setup();

		cell(2, 'name').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		await nextTick();
		type(editor() as HTMLInputElement, 'Nope');
		key(editor() as HTMLInputElement, 'Escape');
		await nextTick();

		expect(rows.value[2].name).toBe('Gamma');
		expect(editor()).toBeNull();
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(2, 'name')));
		expect(grid.editing.cell.value).toBeNull();
	});

	it('a cell that is not editable leaves Enter to the navigation', async () => {
		const { grid } = setup();

		await focusCell(grid, 0, 'id');

		expect(key(cell(0, 'id'), 'Enter').defaultPrevented).toBe(false);
		expect(grid.editing.cell.value).toBeNull();
	});

	it('leaving the editor commits, and focus stays where it went', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'name', 'Enter');
		const outside = document.createElement('button');

		document.body.append(outside);
		type(input, 'Apex');
		outside.focus();
		await nextTick();

		expect(rows.value[0].name).toBe('Apex');
		expect(editor()).toBeNull();
		expect(document.activeElement).toBe(outside);
	});

	it('`start` with text starts in the quick mode, without it in the full mode', async () => {
		const { grid } = setup();

		grid.editing.start({ key: 'a', column: 'name' }, { text: 'x' });
		await nextTick();

		expect(grid.editing.mode.value).toBe('quick');

		grid.editing.cancel();
		grid.editing.start({ key: 'a', column: 'name' });

		expect(grid.editing.mode.value).toBe('full');
	});
});

describe('useGridEditing — validation', () => {
	it('an invalid draft shows its error and stays in editing', async () => {
		const { grid, rows } = setup();
		const started = await startWith(grid, 0, 'name', 'F2');

		type(started, '');
		await nextTick();

		const input = editor() as HTMLInputElement;
		const error = document.querySelector('[data-dg-part="editor-error"]');

		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(error?.textContent).toBe('Required');
		expect(input.getAttribute('aria-describedby')).toBe(error?.id);

		key(input, 'Enter');
		await nextTick();

		expect(editor()).not.toBeNull();
		expect(rows.value[0].name).toBe('Alpha');
	});

	it('an invalid draft left open takes focus back when another cell is edited', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'name', 'F2');

		type(input, '');
		input.blur();
		await focusCell(grid, 1, 'name');
		key(cell(1, 'name'), 'x');
		await nextTick();

		expect(grid.editing.cell.value?.key).toBe('a');
		expect(document.activeElement).toBe(editor());
		expect(rows.value[1].name).toBe('Beta');
	});

	it('under `invalid: \'revert\'` another cell starts editing at once, and the invalid draft is dropped', async () => {
		const { grid, rows } = setup({ invalid: 'revert' });
		const input = await startWith(grid, 0, 'name', 'F2');

		type(input, '');
		input.blur();
		await focusCell(grid, 1, 'name');
		key(cell(1, 'name'), 'x');
		await nextTick();

		expect(grid.editing.cell.value?.key).toBe('b');
		expect(editor()?.value).toBe('x');
		expect(rows.value[0].name).toBe('Alpha');
	});
});

describe('useGridEditing — the quick and the full mode', () => {
	it('after a typed character the arrows save and move to the next cell', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'name', 'Q');

		expect(input.getAttribute('data-dg-state')).toBe('quick');
		expect(key(input, 'ArrowDown').defaultPrevented).toBe(true);
		expect(rows.value[0].name).toBe('Q');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'name')));

		const next = await startWith(grid, 1, 'name', 'R');

		key(next, 'ArrowRight');

		expect(rows.value[1].name).toBe('R');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'price')));
	});

	it('after Enter, F2 or a double click the arrows stay in the editor', async () => {
		const { grid } = setup();
		const input = await startWith(grid, 0, 'name', 'Enter');

		expect(input.getAttribute('data-dg-state')).toBe('full');
		expect(key(input, 'ArrowLeft').defaultPrevented).toBe(false);
		expect(grid.editing.cell.value).not.toBeNull();
	});

	it('F2 in the editor switches the mode', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'name', 'Q');

		key(input, 'F2');
		await nextTick();

		expect(editor()?.getAttribute('data-dg-state')).toBe('full');
		expect(key(editor() as HTMLInputElement, 'ArrowDown').defaultPrevented).toBe(false);

		key(editor() as HTMLInputElement, 'F2');
		await nextTick();
		key(editor() as HTMLInputElement, 'ArrowDown');

		expect(rows.value[0].name).toBe('Q');
	});

	it('an invalid draft keeps the arrows from moving on', async () => {
		const { grid } = setup();
		const input = await startWith(grid, 0, 'price', '5');

		type(input, 'x');
		await nextTick();
		key(editor() as HTMLInputElement, 'ArrowDown');
		await nextTick();

		expect(grid.editing.cell.value?.key).toBe('a');
	});
});

describe('useGridEditing — moves after saving', () => {
	it('Tab at the end of a row goes on to the first column of the next row', async () => {
		const { grid } = setup();
		const input = await startWith(grid, 0, 'note', 'Enter');

		key(input, 'Tab');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'name')));

		const back = await startWith(grid, 1, 'name', 'Enter');

		key(back, 'Tab', { shiftKey: true });
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'note')));
	});

	it('Enter after a run of Tab goes down to the column where Tab started', async () => {
		const { grid, rows } = setup();
		const first = await startWith(grid, 0, 'name', 'N');

		key(first, 'Tab');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'price')));

		const second = await startWith(grid, 0, 'price', '9');

		key(second, 'Enter');

		expect(rows.value[0]).toMatchObject({ name: 'N', price: 9 });
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'name')));
	});

	it('a run of Tab is forgotten once editing goes elsewhere', async () => {
		const { grid } = setup();
		const first = await startWith(grid, 0, 'name', 'N');

		key(first, 'Tab');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'price')));

		const elsewhere = await startWith(grid, 0, 'sector', 'Enter');

		key(elsewhere, 'Enter');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'sector')));
	});

	it('`enterMove` says where Enter goes, and Shift+Enter goes the other way', async () => {
		const { grid } = setup({ enterMove: 'right' });
		const input = await startWith(grid, 1, 'name', 'Enter');

		key(input, 'Enter');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'price')));

		const back = await startWith(grid, 1, 'price', 'Enter');

		key(back, 'Enter', { shiftKey: true });
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'name')));
	});

	it('`enterMove: \'none\'` stays on the cell', async () => {
		const { grid } = setup({ enterMove: 'none' });
		const input = await startWith(grid, 1, 'name', 'Enter');

		key(input, 'Enter');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(1, 'name')));
	});
});

describe('useGridEditing — Ctrl+Enter', () => {
	it('writes the typed text into every selected cell as one commit, through each column\'s `parse`', async () => {
		const { grid, rows } = setup();

		await focusCell(grid, 0, 'price');
		grid.ranges.select({ key: 'a', column: 'price' });
		grid.ranges.select({ key: 'c', column: 'price' }, 'extend');
		key(cell(0, 'price'), '4');
		await nextTick();
		key(editor() as HTMLInputElement, 'Enter', { ctrlKey: true });
		await nextTick();

		expect(rows.value.map(row => row.price)).toEqual([4, 4, 4]);
		expect(editor()).toBeNull();
		expect(grid.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 3, columnStart: 2, columnEnd: 3 }]);

		grid.history.undo();

		expect(rows.value.map(row => row.price)).toEqual([1, 2, 3]);
	});

	it('writes a chosen value, and only the focused cell without a range', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 1, 'sector', 'Enter');

		key(input, 'ArrowDown');
		key(input, 'Enter', { metaKey: true });

		expect(rows.value.map(row => row.sector)).toEqual(['Tech', 'Retail', 'Tech']);
	});
});

describe('useGridEditing — the list editor', () => {
	function options() {
		return [...document.querySelectorAll<HTMLElement>('[data-dg-part="editor-option"]')];
	}

	it('opens with every choice, the value highlighted and checked, as a combobox over a listbox', async () => {
		const { grid } = setup();
		const input = await startWith(grid, 1, 'sector', 'Enter');
		const list = document.querySelector('[data-dg-part="editor-list"]') as HTMLElement;
		const highlighted = options().find(option => option.getAttribute('aria-selected') === 'true');

		expect(options().map(option => option.textContent)).toEqual(['Technology', 'Energy', 'Health care', 'Retail']);
		expect(highlighted?.textContent).toBe('Energy');
		expect(highlighted?.getAttribute('data-dg-state')).toBe('checked');
		expect(input.getAttribute('role')).toBe('combobox');
		expect(input.getAttribute('aria-controls')).toBe(list.id);
		expect(input.getAttribute('aria-activedescendant')).toBe(highlighted?.id);
		expect(input.placeholder).toBe('Energy');
		expect(list.getAttribute('role')).toBe('listbox');
		expect(list.getAttribute('aria-label')).toBe('Sector');
	});

	it('↑ and ↓ move the highlight past disabled choices, and Enter saves it and goes down', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 1, 'sector', 'Enter');

		expect(key(input, 'ArrowDown').defaultPrevented).toBe(true);
		await nextTick();

		// Health care is disabled.
		expect(grid.editing.cell.value?.draft).toBe('Retail');

		key(input, 'ArrowDown');
		key(input, 'Enter');

		expect(rows.value[1].sector).toBe('Retail');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(2, 'sector')));
	});

	it('a character typed on the cell filters the list and highlights the first match', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'sector', 'e');

		await nextTick();

		expect(input.value).toBe('e');
		expect(options().map(option => option.textContent)).toEqual(['Technology', 'Energy', 'Health care', 'Retail']);
		expect(grid.editing.cell.value?.draft).toBe('Tech');

		type(input, 'en');
		await nextTick();

		expect(options().map(option => option.textContent)).toEqual(['Energy']);

		key(input, 'Tab');

		expect(rows.value[0].sector).toBe('Energy');
	});

	it('with no match the list says so, and saving keeps the value', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'sector', 'Enter');

		type(input, 'zzz');
		await nextTick();

		expect(document.querySelector('[data-dg-part="editor-empty"]')?.textContent).toBe('No matches');
		expect(input.hasAttribute('aria-activedescendant')).toBe(false);

		key(input, 'Enter');

		expect(rows.value[0].sector).toBe('Tech');
		expect(grid.editing.cell.value).toBeNull();
	});

	it('a click on a choice saves it; a press on the list keeps focus in the field', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'sector', 'Enter');
		const press = new Event('pointerdown', { bubbles: true, cancelable: true });

		options()[3].dispatchEvent(press);

		expect(press.defaultPrevented).toBe(true);

		options()[3].click();

		expect(rows.value[0].sector).toBe('Retail');
		await vi.waitFor(() => expect(document.activeElement).toBe(cell(0, 'sector')));
		expect(input.isConnected).toBe(false);
	});

	it('a click on a disabled choice does nothing', async () => {
		const { grid, rows } = setup();

		await startWith(grid, 0, 'sector', 'Enter');
		options()[2].click();

		expect(rows.value[0].sector).toBe('Tech');
		expect(grid.editing.cell.value).not.toBeNull();
	});

	it('Escape cancels', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'sector', 'Enter');

		key(input, 'ArrowDown');
		key(input, 'Escape');

		expect(rows.value[0].sector).toBe('Tech');
		expect(grid.editing.cell.value).toBeNull();
	});

	it('takes the choices of each row from a function, and a filter of your own', () => {
		const editorOf = selectEditor<Row, string>({
			options: row => (row.id === 'a' ? [{ value: 'x', label: 'X' }] : []),
			filter: (option, text) => option.label.startsWith(text),
		});

		expectTypeOf(editorOf).parameter(0).toHaveProperty('draft').toEqualTypeOf<string>();
		// @ts-expect-error: choices of a string column hold strings.
		selectEditor<Row, string>({ options: [{ value: 1, label: 'One' }] });
	});
});

describe('useGridEditing — other editors', () => {
	it('the number editor reads its text as typed; ↑ and ↓ step in the full mode', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'price', '7');

		type(input, '7,');
		await nextTick();

		expect(input.value).toBe('7,');
		expect(grid.editing.cell.value?.draft).toBe(7);

		key(input, 'F2');
		await nextTick();
		key(editor() as HTMLInputElement, 'ArrowUp');
		await nextTick();

		expect(editor()?.value).toBe('12');
		expect(editor()?.getAttribute('aria-valuenow')).toBe('12');

		key(editor() as HTMLInputElement, 'Enter');

		expect(rows.value[0].price).toBe(12);
	});

	it('a character typed on a date cell opens the date field with the value', async () => {
		const { grid } = setup();
		const input = await startWith(grid, 0, 'due', '2');

		expect(input.type).toBe('date');
		expect(input.value).toBe('2026-10-01');
		expect(input.min).toBe('2026-01-01');
		expect(input.getAttribute('data-dg-state')).toBe('full');
		expect(grid.editing.cell.value?.draft).toBe('2026-10-01');
	});

	it('a multiline text editor is a text area: Alt+Enter breaks the line, Enter saves', async () => {
		const { grid, rows } = setup();
		const area = await startWith(grid, 0, 'note', 'Enter') as unknown as HTMLTextAreaElement;

		expect(area.tagName).toBe('TEXTAREA');

		type(area, 'one');
		area.setSelectionRange(3, 3);
		expect(key(area, 'Enter', { altKey: true }).defaultPrevented).toBe(true);
		await nextTick();

		expect(grid.editing.cell.value?.text).toBe('one\n');

		key(editor() as HTMLInputElement, 'Enter');

		expect(rows.value[0].note).toBe('one\n');
	});

	it('the editor of a right-aligned column keeps to the right', async () => {
		const { grid } = setup();

		await startWith(grid, 0, 'price', 'Enter');

		expect(editor()?.parentElement?.getAttribute('data-dg-align')).toBe('right');
	});
});

describe('useGridEditing — a control in the cell', () => {
	function checkbox(row: number) {
		return cell(row, 'active').querySelector('input') as HTMLInputElement;
	}

	it('a click on `checkboxCell` writes at once, as an edit', async () => {
		const { grid, rows } = setup();

		checkbox(1).click();

		expect(rows.value[1].active).toBe(true);
		expect(grid.editing.lastCommit.value?.source).toBe('edit');
		expect(grid.editing.cell.value).toBeNull();
	});

	it('Enter and Space on the cell press the checkbox; a character opens no editor', async () => {
		const { grid, rows } = setup();

		await focusCell(grid, 1, 'active');
		key(cell(1, 'active'), 'Enter');

		expect(rows.value[1].active).toBe(true);

		await nextTick();
		key(cell(1, 'active'), ' ');

		expect(rows.value[1].active).toBe(false);

		key(cell(1, 'active'), 'x');
		cell(1, 'active').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		await nextTick();

		expect(grid.editing.cell.value).toBeNull();
	});

	it('the checkbox is disabled where the cell cannot be edited', () => {
		setup();

		expect(checkbox(0).disabled).toBe(true);
		expect(checkbox(1).disabled).toBe(false);
	});

	it('a write that is refused leaves the box as the value is', async () => {
		const { rows } = setup({ onBeforeCommit: () => false });

		checkbox(1).click();
		await nextTick();

		expect(rows.value[1].active).toBe(false);
		expect(checkbox(1).checked).toBe(false);
	});

	it('`write` of a cell is the same function while its row holds, and a new one for a new object of the row', async () => {
		const writes: unknown[] = [];
		const { grid } = setup({
			cellSlot: (context) => {
				if (context.column.name === 'name' && context.key === 'b') {
					writes.push(context.write);
				}

				return undefined;
			},
		});

		const rendered = writes.length;

		// Editing another cell of the row renders it again, with the same object.
		grid.editing.start({ key: 'b', column: 'price' });
		await nextTick();

		expect(writes.length).toBeGreaterThan(rendered);
		expect(writes.at(-1)).toBe(writes[0]);

		grid.editing.cancel();
		grid.editing.write([{ key: 'b', column: 'price', value: 50 }], 'edit');
		await nextTick();

		expect(writes.at(-1)).toBeTypeOf('function');
		expect(writes.at(-1)).not.toBe(writes[0]);
	});

	it('a cell that cannot be edited gets no `write`', () => {
		const contexts: CellContext<unknown, unknown>[] = [];

		setup({ cellSlot: (context) => {
			contexts.push(context);

			return undefined;
		} });

		expect(contexts.find(context => context.column.name === 'id')?.write).toBeUndefined();
		expect(contexts.find(context => context.column.name === 'active' && context.key === 'a')?.write).toBeUndefined();
		expect(contexts.find(context => context.column.name === 'active' && context.key === 'b')?.write).toBeTypeOf('function');
	});
});

describe('useGridEditing — the selection', () => {
	it('Delete clears the selected cells through `parse`, skipping the ones it cannot', async () => {
		const { grid, rows } = setup();

		// Focus first: focus moved by code collapses the ranges to the focused cell.
		await focusCell(grid, 0, 'id');
		grid.ranges.select({ key: 'a', column: 'id' });
		grid.ranges.select({ key: 'b', column: 'price' }, 'extend');
		key(cell(0, 'id'), 'Delete');

		// Names are required, so they stay; prices clear to `null`.
		expect(rows.value.map(row => [row.name, row.price])).toEqual([['Alpha', null], ['Beta', null], ['Gamma', 3]]);
	});

	it('a cut copies the selection and clears it', async () => {
		const { grid, rows } = setup();

		grid.ranges.select({ key: 'b', column: 'price' });

		const { data } = clipboardEvent('cut', cell(1, 'price'));

		expect(data.get('text/plain')).toBe('2');
		expect(rows.value[1].price).toBeNull();
	});

	it('Ctrl+Z undoes the last commit, a paste as one step; Ctrl+Y redoes it', async () => {
		const { grid, rows } = setup();

		await focusCell(grid, 0, 'price');
		clipboardEvent('paste', cell(0, 'price'), '10\r\n20');
		key(cell(0, 'price'), 'z', { ctrlKey: true });

		expect(rows.value.map(row => row.price)).toEqual([1, 2, 3]);

		key(cell(0, 'price'), 'y', { ctrlKey: true });

		expect(rows.value.map(row => row.price)).toEqual([10, 20, 3]);
		expect(grid.history.canRedo.value).toBe(false);
	});
});

describe('useGridEditing — paste', () => {
	it('writes the clipboard rows from the focused cell and selects what it wrote', async () => {
		const { grid, rows } = setup();

		await focusCell(grid, 1, 'name');
		clipboardEvent('paste', cell(1, 'name'), 'Bravo\t20\r\nCharlie\t30\r\n');

		expect(rows.value.slice(1).map(row => [row.name, row.price])).toEqual([['Bravo', 20], ['Charlie', 30]]);
		expect(grid.ranges.bounds.value).toEqual([{ rowStart: 1, rowEnd: 3, columnStart: 1, columnEnd: 3 }]);
	});

	it('one value pasted over a range fills it', async () => {
		const { grid, rows } = setup();

		grid.ranges.select({ key: 'a', column: 'price' });
		grid.ranges.select({ key: 'c', column: 'price' }, 'extend');
		clipboardEvent('paste', cell(0, 'price'), '9');

		expect(rows.value.map(row => row.price)).toEqual([9, 9, 9]);
	});

	it('pastes over the last range, and one empty cell from Excel clears', async () => {
		const { grid, rows } = setup();

		grid.ranges.select({ key: 'a', column: 'name' });
		grid.ranges.select({ key: 'b', column: 'price' }, 'add');
		clipboardEvent('paste', cell(0, 'name'), '\r\n');

		expect(rows.value.map(row => [row.name, row.price])).toEqual([['Alpha', 1], ['Beta', null], ['Gamma', 3]]);
	});

	it('leaves out the cells it cannot edit and the values `validate` refuses, and writes the rest', async () => {
		const { grid, rows } = setup();

		await focusCell(grid, 0, 'id');
		const { event } = clipboardEvent('paste', cell(0, 'id'), 'x\tFirst\tabc\r\ny\t\t42');

		expect(event.defaultPrevented).toBe(true);
		expect(rows.value.map(row => [row.id, row.name, row.price])).toEqual([['a', 'First', 1], ['b', 'Beta', 42], ['c', 'Gamma', 3]]);
		expect(grid.editing.lastCommit.value?.source).toBe('paste');
	});

	it('is cut at the last row, and at the last column', async () => {
		const { grid, rows } = setup();

		await focusCell(grid, 2, 'note');
		clipboardEvent('paste', cell(2, 'note'), 'n1\textra\r\nn2\textra');

		expect(rows.value.map(row => row.note)).toEqual(['', '', 'n1']);
		expect(grid.ranges.bounds.value).toEqual([{ rowStart: 2, rowEnd: 3, columnStart: 6, columnEnd: 7 }]);
	});

	it('reads text of a checkbox column through its `parse`', async () => {
		const { grid, rows } = setup();

		await focusCell(grid, 1, 'active');
		clipboardEvent('paste', cell(1, 'active'), 'TRUE\r\nfalse');

		expect(rows.value.map(row => row.active)).toEqual([true, true, false]);
	});

	it('a paste into the field of an editor is the field\'s', async () => {
		const { grid } = setup();
		const input = await startWith(grid, 0, 'name', 'Enter');
		const { event } = clipboardEvent('paste', input, 'Pasted');

		expect(event.defaultPrevented).toBe(false);
		expect(grid.editing.cell.value?.key).toBe('a');
	});

	it('with nothing focused or selected, a paste is left to the page', () => {
		const { rows } = setup();
		const { event } = clipboardEvent('paste', cell(0, 'name'), 'x');

		expect(event.defaultPrevented).toBe(false);
		expect(rows.value).toBe(initial);
	});
});

describe('useGridEditing — input methods', () => {
	it('Enter that chooses a candidate of an input method stays in the editor', async () => {
		const { grid, rows } = setup();
		const input = await startWith(grid, 0, 'name', 'Enter');

		type(input, 'かな');

		expect(key(input, 'Enter', { isComposing: true }).defaultPrevented).toBe(false);
		expect(key(input, 'Escape', { isComposing: true }).defaultPrevented).toBe(false);
		expect(grid.editing.cell.value?.draft).toBe('かな');
		expect(rows.value[0].name).toBe('Alpha');

		key(input, 'Enter');

		expect(rows.value[0].name).toBe('かな');
	});

	it('the arrows of the list and of a number wait for the composition too', async () => {
		const { grid } = setup();
		const list = await startWith(grid, 1, 'sector', 'Enter');

		expect(key(list, 'ArrowDown', { isComposing: true }).defaultPrevented).toBe(false);
		expect(grid.editing.cell.value?.draft).toBe('Energy');
	});
});

describe('useGridEditing — the list and the pointer', () => {
	it('a press on the list itself, such as on its scrollbar, keeps the editor open', async () => {
		const { grid, rows } = setup();

		await startWith(grid, 1, 'sector', 'Enter');

		const list = document.querySelector('[data-dg-part="editor-list"]') as HTMLElement;

		list.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
		await nextTick();

		expect(grid.editing.cell.value).toMatchObject({ key: 'b', column: 'sector' });
		expect(rows.value[1].sector).toBe('Energy');
	});
});

describe('useGridEditing — what a write tells', () => {
	it('`onWrite` hears a paste with the cells it skipped', async () => {
		const results: CellWriteResult<Row>[] = [];
		const { grid } = setup({ onWrite: result => results.push(result) });

		await focusCell(grid, 0, 'id');
		clipboardEvent('paste', cell(0, 'id'), 'x\tFirst');

		expect(results).toHaveLength(1);
		expect(results[0].source).toBe('paste');
		expect(results[0].skipped.map(write => write.column)).toEqual(['id']);
	});

	it('a paste that sorts the rows selects the cells it wrote, where they went', async () => {
		const { grid, rows } = setup({ sorted: true });

		await focusCell(grid, 0, 'name');
		clipboardEvent('paste', cell(0, 'name'), 'Zulu');
		await nextTick();

		expect(rows.value[0].name).toBe('Zulu');
		expect(grid.rows.value.map(row => row.id)).toEqual(['b', 'c', 'a']);
		expect(grid.ranges.getCells()).toEqual([{ key: 'a', column: 'name' }]);
	});
});

describe('useGridEditing — the default editor', () => {
	it('an editable column without `editor` gets the `editor` option', async () => {
		const own: CellEditor = context => h('input', { ...context.inputProps, 'data-own': 'yes', value: String(context.draft) });
		const { grid } = setup({ editor: own });

		await startWith(grid, 0, 'name', 'Enter');

		expect(editor()?.getAttribute('data-own')).toBe('yes');
	});

	it('types the editing by the rows, so a commit gives the rows back', () => {
		const rows = shallowRef<Row[]>(initial);

		mount(defineComponent({
			setup() {
				const grid = createGrid(rows, {});

				expectTypeOf(grid.editing.cell.value).toEqualTypeOf<EditingCellOf<Row> | null>();
				expectTypeOf(grid.history.undo).returns.toEqualTypeOf<CellWriteResult<Row> | null>();

				return () => null;
			},
		})).unmount();
	});
});

describe('dateField', () => {
	const timeZone = process.env.TZ;

	afterEach(() => {
		process.env.TZ = timeZone;
	});

	function render(field: CellEditor<unknown, unknown>, draft: unknown) {
		const drafts: unknown[] = [];
		const vnodes = field({
			row: {},
			value: draft,
			key: 'a',
			index: 0,
			column: columns.due as never,
			mode: 'full',
			draft,
			text: undefined,
			error: null,
			errorId: 'error',
			setDraft: value => drafts.push(value),
			setText: () => undefined,
			commit: () => true,
			cancel: () => undefined,
			inputProps: {},
		}) as unknown as { props: { value: string; onInput: (event: Event) => void } }[];
		const input = document.createElement('input');

		return {
			shown: vnodes[0].props.value,
			pick(text: string) {
				input.value = text;
				vnodes[0].props.onInput({ target: input } as unknown as Event);

				return drafts.at(-1);
			},
		};
	}

	it.each(['Asia/Tokyo', 'America/Los_Angeles', 'UTC'])('shows and picks the local day in %s', (zone) => {
		process.env.TZ = zone;

		const { editor: dates, parse } = dateField();
		const shown = render(dates as CellEditor<unknown, unknown>, new Date(2026, 2, 4));
		const picked = shown.pick('2026-03-05') as Date;

		expect(shown.shown).toBe('2026-03-04');
		expect([picked.getFullYear(), picked.getMonth(), picked.getDate(), picked.getHours()]).toEqual([2026, 2, 5, 0]);
		expect(parse('2026-03-05')?.getDate()).toBe(5);
	});

	it('picks a `Date` for an empty cell of dates, and text with `value: \'text\'`', () => {
		const dates = render(dateField().editor as CellEditor<unknown, unknown>, null);
		const texts = render(dateField({ value: 'text' }).editor as CellEditor<unknown, unknown>, null);

		expect(dates.pick('2026-03-05')).toBeInstanceOf(Date);
		expect(texts.pick('2026-03-05')).toBe('2026-03-05');
		expect(dates.pick('')).toBeNull();
	});
});
