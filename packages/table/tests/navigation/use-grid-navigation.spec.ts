import { defineColumns, type GridSection, type RowNode, useTableEngine } from '@vue-stack/table-core';
import { defineComponent, h, nextTick, shallowRef, type VNodeChild } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getGridCellAttributes, getGridRowAttributes } from '../../src/navigation/grid-attributes';
import { type GridNavigationOptions, useGridNavigation } from '../../src/navigation/use-grid-navigation';

interface Row {
	id: string;
}

const COLUMNS = ['a', 'b', 'c'];

const columns = defineColumns({
	a: { value: (row: Row) => row.id },
	b: { value: (row: Row) => row.id },
	c: { value: (row: Row) => row.id },
});

interface GridSetup {
	rows?: number;
	/** A row window over a viewport three rows high; without it every row is rendered. */
	windowed?: boolean;
	rtl?: boolean;
	/** A footer row under the body. */
	footer?: boolean;
	columns?: typeof columns;
	content?: (row: number, column: string) => VNodeChild;
	options?: Partial<GridNavigationOptions>;
}

function setup(config: GridSetup = {}) {
	const rows = shallowRef<Row[]>(Array.from({ length: config.rows ?? 5 }, (_, index) => ({ id: `r${index}` })));
	const grid = shallowRef<HTMLElement | null>(null);
	const exit = shallowRef<HTMLElement | null>(null);
	const head = shallowRef<HTMLElement | null>(null);
	const cells = COLUMNS.map(key => ({ key }));
	const sections = (): GridSection[] => [
		{ name: 'head', rows: 1, cells },
		{ name: 'body', rows: rows.value.length, cells },
		...(config.footer ? [{ name: 'foot', rows: 1, cells }] : []),
	];
	const onSpace = vi.fn();
	const onFocus = vi.fn();
	let navigation: ReturnType<typeof useGridNavigation> | null = null;

	// happy-dom has no layout: a windowed grid reports a viewport three rows high before the core reads it.
	const setGrid = (element: unknown) => {
		if (element instanceof HTMLElement && config.windowed) {
			Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => 108 });
			Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => 300 });
		}

		grid.value = element instanceof HTMLElement ? element : null;
	};

	const cell = (row: number, column: string) => h('div', { 'data-tc-column': column, tabindex: -1 }, [
		config.content?.(row, column) ?? `${column}${row}`,
	]);

	const wrapper = mount(defineComponent({
		setup() {
			const engine = useTableEngine({
				columns: config.columns ?? columns,
				rows,
				root: grid,
				rowKey: 'id',
				rowHeight: 36,
				virtual: config.windowed ? { rows: true, columns: false, overscan: 0 } : false,
			});

			navigation = useGridNavigation(engine.scope, {
				grid,
				exit,
				sections,
				onSpace,
				onFocus,
				stickyStart: head,
				...config.options,
			});

			return () => h('div', [
				h('button', { id: 'before' }, 'before'),
				h('div', { ref: setGrid, role: 'grid', tabindex: 0, style: config.rtl ? 'direction: rtl' : undefined }, [
					h('div', { ref: head, ...getGridRowAttributes('head', 0) }, COLUMNS.map(column => h('div', {
						'data-tc-column': column,
						tabindex: -1,
					}, column))),
					...engine.items.value.map(item => h('div', { key: item.key, ...getGridRowAttributes('body', item.index) }, COLUMNS.map(column => cell(item.index, column)))),
					config.footer
						? h('div', getGridRowAttributes('foot', 0), COLUMNS.map(column => h('div', { 'data-tc-column': column, tabindex: -1 }, column)))
						: null,
				]),
				h('span', { ref: exit, tabindex: 0 }),
				h('button', { id: 'after' }, 'after'),
			]);
		},
	}), { attachTo: document.body });

	function find(section: string, row: number, column: string) {
		return document.querySelector<HTMLElement>(`[data-tc-grid-section="${section}"][data-tc-grid-row="${row}"] [data-tc-column="${column}"]`) as HTMLElement;
	}

	return {
		wrapper,
		rows,
		grid: () => grid.value as HTMLElement,
		exit: () => exit.value as HTMLElement,
		find,
		onSpace,
		onFocus,
		navigation: navigation as unknown as ReturnType<typeof useGridNavigation>,
	};
}

function press(target: Element, key: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });

	target.dispatchEvent(event);

	return event;
}

async function settle() {
	await flushPromises();
	await nextTick();
}

let current: ReturnType<typeof setup> | null = null;

afterEach(() => {
	current?.wrapper.unmount();
	current = null;
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('useGridNavigation — moves', () => {
	it('a key on the grid enters its first cell', async () => {
		current = setup();
		current.grid().focus();
		press(current.grid(), 'ArrowDown');
		await settle();

		expect(document.activeElement).toBe(current.find('head', 0, 'a'));
	});

	it('arrows cross from the header into the body and back', async () => {
		current = setup();
		current.find('head', 0, 'b').focus();
		press(current.find('head', 0, 'b'), 'ArrowDown');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 0, 'b'));

		press(current.find('body', 0, 'b'), 'ArrowUp');
		await settle();

		expect(document.activeElement).toBe(current.find('head', 0, 'b'));
	});

	it('Home, End and Ctrl+End', async () => {
		current = setup();
		current.find('body', 1, 'b').focus();
		press(current.find('body', 1, 'b'), 'End');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 1, 'c'));

		press(current.find('body', 1, 'c'), 'Home');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 1, 'a'));

		press(current.find('body', 1, 'a'), 'End', { ctrlKey: true });
		await settle();

		expect(document.activeElement).toBe(current.find('body', 4, 'c'));
	});

	it('PageDown moves as many rows as fit into the viewport, by the core', async () => {
		current = setup({ rows: 20, windowed: true });
		current.find('body', 0, 'a').focus();
		press(current.find('body', 0, 'a'), 'PageDown');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 3, 'a'));
	});

	it('PageUp from the footer moves a page up from the last row', async () => {
		current = setup({ rows: 20, windowed: true, footer: true });
		await current.navigation.focusCell({ section: 'foot', row: 0, cell: 'a' });
		press(current.find('foot', 0, 'a'), 'PageUp');
		await settle();

		expect(current.navigation.focused.value).toMatchObject({ section: 'body', row: 17 });
	});

	it('in a right-to-left grid ← goes to the next cell', async () => {
		current = setup({ rtl: true });
		current.find('body', 0, 'a').focus();
		press(current.find('body', 0, 'a'), 'ArrowLeft');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 0, 'b'));
	});

	it('Alt with an arrow is left alone', async () => {
		current = setup();
		current.find('body', 0, 'a').focus();

		const event = press(current.find('body', 0, 'a'), 'ArrowRight', { altKey: true });

		await settle();

		expect(event.defaultPrevented).toBe(false);
		expect(document.activeElement).toBe(current.find('body', 0, 'a'));
	});

	it('a key a cell handled itself is left alone', async () => {
		current = setup();

		const cell = current.find('body', 0, 'a');

		cell.addEventListener('keydown', event => event.preventDefault());
		cell.focus();
		press(cell, 'ArrowRight');
		await settle();

		expect(document.activeElement).toBe(cell);
	});

	it('focus by a pointer or from code sets where the next arrow moves from', async () => {
		current = setup();
		current.find('body', 2, 'c').focus();

		expect(current.onFocus).toHaveBeenLastCalledWith({ section: 'body', row: 2, cell: 'c' });

		press(current.find('body', 2, 'c'), 'ArrowUp');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 1, 'c'));
	});

	it('a cell outside the row window is kept rendered, waited for and focused', async () => {
		current = setup({ rows: 20, windowed: true });
		// Before mount the server set of rows is rendered; the window takes over on the next render.
		await settle();

		expect(current.find('body', 3, 'a')).toBeNull();

		current.find('body', 2, 'a').focus();
		press(current.find('body', 2, 'a'), 'ArrowDown');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 3, 'a'));
	});

	it('`focusCell` focuses any cell from code, and `focused` follows its row by key', async () => {
		current = setup();

		await expect(current.navigation.focusCell({ section: 'body', row: 4, cell: 'b' })).resolves.toBe(true);
		expect(document.activeElement).toBe(current.find('body', 4, 'b'));
		expect(current.navigation.focused.value).toEqual({ section: 'body', row: 4, cell: 'b', key: 'r4' });

		current.rows.value = [...current.rows.value].reverse();

		expect(current.navigation.focused.value).toEqual({ section: 'body', row: 0, cell: 'b', key: 'r4' });
	});

	it('`focusCell` asks the browser to show the focus ring, whatever came before it', async () => {
		current = setup();

		const focus = vi.spyOn(HTMLElement.prototype, 'focus');

		await current.navigation.focusCell({ section: 'body', row: 2, cell: 'a' });

		expect(focus).toHaveBeenLastCalledWith({ preventScroll: true, focusVisible: true });
	});

	it('a cell that is not in the grid is not focused', async () => {
		current = setup();

		await expect(current.navigation.focusCell({ section: 'body', row: 9, cell: 'b' })).resolves.toBe(false);
	});

	it('does nothing while disabled', async () => {
		current = setup({ options: { enabled: false } });
		current.find('body', 0, 'a').focus();
		press(current.find('body', 0, 'a'), 'ArrowDown');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 0, 'a'));
	});
});

describe('useGridNavigation — cell content', () => {
	it('Enter presses the only button of a cell', async () => {
		const click = vi.fn();

		current = setup({ content: (row, column) => (row === 0 && column === 'a' ? h('button', { onClick: click }, 'go') : undefined) });
		current.find('body', 0, 'a').focus();
		press(current.find('body', 0, 'a'), 'Enter');

		expect(click).toHaveBeenCalledTimes(1);
	});

	it('Enter focuses an input in a cell, arrows stay in it, and Escape comes back to the cell', async () => {
		current = setup({ content: (row, column) => (row === 0 && column === 'a' ? h('input', { type: 'text' }) : undefined) });

		const cell = current.find('body', 0, 'a');
		const input = cell.querySelector('input') as HTMLInputElement;

		cell.focus();
		press(cell, 'Enter');

		expect(document.activeElement).toBe(input);

		const arrow = press(input, 'ArrowDown');

		await settle();

		expect(arrow.defaultPrevented).toBe(false);
		expect(document.activeElement).toBe(input);

		press(input, 'Escape');

		expect(document.activeElement).toBe(cell);
	});

	it('arrows inside a toolbar in a cell belong to it, and Escape comes back to the cell', async () => {
		current = setup({
			content: (row, column) => (row === 0 && column === 'a'
				? h('div', { role: 'toolbar' }, [h('button', 'edit'), h('button', { tabindex: -1 }, 'delete')])
				: undefined),
		});

		const cell = current.find('body', 0, 'a');
		const button = cell.querySelector('button') as HTMLButtonElement;

		button.focus();

		const arrow = press(button, 'ArrowRight');

		await settle();

		expect(arrow.defaultPrevented).toBe(false);
		expect(document.activeElement).toBe(button);

		press(button, 'Escape');

		expect(document.activeElement).toBe(cell);
	});

	it('arrows from a button inside a cell move through the grid', async () => {
		current = setup({ content: (row, column) => (row === 0 && column === 'a' ? h('button', 'go') : undefined) });

		const button = current.find('body', 0, 'a').querySelector('button') as HTMLButtonElement;

		button.focus();
		press(button, 'ArrowRight');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 0, 'b'));
	});

	it('focus on a control inside a cell puts the model on that cell', () => {
		current = setup({ content: (row, column) => (row === 2 && column === 'b' ? h('button', 'go') : undefined) });
		(current.find('body', 2, 'b').querySelector('button') as HTMLButtonElement).focus();

		expect(current.navigation.focused.value).toEqual({ section: 'body', row: 2, cell: 'b', key: 'r2' });
		expect(current.onFocus).not.toHaveBeenCalled();
	});

	it('Space on a cell calls `onSpace` with its position', () => {
		current = setup();
		current.find('body', 3, 'b').focus();

		const event = press(current.find('body', 3, 'b'), ' ');

		expect(event.defaultPrevented).toBe(true);
		expect(current.onSpace).toHaveBeenCalledWith({ section: 'body', row: 3, cell: 'b' }, event);
	});

	it('Space toggles the only checkbox of a cell instead of calling `onSpace`', () => {
		const change = vi.fn();

		current = setup({ content: (row, column) => (row === 0 && column === 'a' ? h('input', { type: 'checkbox', onChange: change }) : undefined) });

		const cell = current.find('body', 0, 'a');
		const box = cell.querySelector('input') as HTMLInputElement;

		cell.focus();

		expect(press(cell, ' ').defaultPrevented).toBe(true);
		expect(box.checked).toBe(true);
		expect(change).toHaveBeenCalledTimes(1);
		expect(current.onSpace).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(cell);
	});

	it('Space leaves the only button of a cell to Enter', () => {
		const click = vi.fn();

		current = setup({ content: (row, column) => (row === 0 && column === 'a' ? h('button', { onClick: click }, 'go') : undefined) });
		current.find('body', 0, 'a').focus();
		press(current.find('body', 0, 'a'), ' ');

		expect(click).not.toHaveBeenCalled();
		expect(current.onSpace).toHaveBeenCalledTimes(1);
	});

	it('F2 is a switch: into the content of a cell, and back to the cell', () => {
		current = setup({ content: (row, column) => (row === 0 && column === 'a' ? h('input', { type: 'text' }) : undefined) });

		const cell = current.find('body', 0, 'a');

		cell.focus();
		press(cell, 'F2');
		expect(document.activeElement).toBe(cell.querySelector('input'));

		const back = press(document.activeElement as HTMLElement, 'F2');

		expect(back.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(cell);
	});
});

describe('useGridNavigation — selection keys', () => {
	function withSelection() {
		const selection = { toggle: vi.fn(), setAll: vi.fn() };
		const onSelectColumn = vi.fn();

		return { selection, onSelectColumn, grid: setup({ options: { selection, onSelectColumn } }) };
	}

	it('Shift+Space toggles the row of the cell', () => {
		const { selection, grid } = withSelection();

		current = grid;
		current.find('body', 2, 'b').focus();

		expect(press(current.find('body', 2, 'b'), ' ', { shiftKey: true }).defaultPrevented).toBe(true);
		expect(selection.toggle).toHaveBeenCalledWith('r2');
		expect(current.onSpace).not.toHaveBeenCalled();
	});

	it('Ctrl+Space asks to select the column, Ctrl+A selects every row', () => {
		const { selection, onSelectColumn, grid } = withSelection();

		current = grid;
		current.find('body', 1, 'c').focus();

		const space = press(current.find('body', 1, 'c'), ' ', { ctrlKey: true });

		expect(onSelectColumn).toHaveBeenCalledWith({ section: 'body', row: 1, cell: 'c' }, space);
		expect(press(current.find('body', 1, 'c'), 'a', { metaKey: true }).defaultPrevented).toBe(true);
		expect(selection.setAll).toHaveBeenCalledWith(true);
	});

	it('Ctrl+A goes by the physical key on a layout of another script, not on a Latin one', () => {
		const { selection, grid } = withSelection();

		current = grid;
		current.find('body', 1, 'c').focus();

		// Russian: the A key types `ф`.
		expect(press(current.find('body', 1, 'c'), 'ф', { ctrlKey: true, code: 'KeyA' }).defaultPrevented).toBe(true);
		expect(selection.setAll).toHaveBeenCalledTimes(1);

		// AZERTY: the key where QWERTY has A types `q`, and Ctrl+Q is not select-all.
		press(current.find('body', 1, 'c'), 'q', { ctrlKey: true, code: 'KeyA' });
		expect(selection.setAll).toHaveBeenCalledTimes(1);
	});

	it('Shift+Space on a header cell selects no row', () => {
		const { selection, grid } = withSelection();

		current = grid;
		current.find('head', 0, 'a').focus();
		press(current.find('head', 0, 'a'), ' ', { shiftKey: true });

		expect(selection.toggle).not.toHaveBeenCalled();
	});
});

describe('useGridNavigation — tree keys', () => {
	/** `r0` is a group of `r1` and `r2`; the other rows are leaves at the top. */
	function createTree() {
		const expanded = new Set(['r0']);
		const nodes: Record<string, RowNode> = {
			r0: { key: 'r0', level: 0, parent: null, group: true, expanded: true, count: 2, position: 0, setSize: 3 },
			r1: { key: 'r1', level: 1, parent: 'r0', group: false, expanded: false, count: 0, position: 0, setSize: 2 },
			r2: { key: 'r2', level: 1, parent: 'r0', group: false, expanded: false, count: 0, position: 1, setSize: 2 },
		};
		const tree = {
			getNode: (key: string) => nodes[key],
			isExpanded: (key: string) => expanded.has(key),
			setExpanded: vi.fn((key: string, value: boolean) => {
				if (value) {
					expanded.add(key);
				} else {
					expanded.delete(key);
				}
			}),
		};

		return tree;
	}

	function withTree() {
		const tree = createTree();

		return { tree, grid: setup({ options: { tree } }) };
	}

	it('in the tree column ← collapses an expanded group and → expands it again, focus staying', async () => {
		const { tree, grid } = withTree();

		current = grid;
		current.find('body', 0, 'a').focus();

		expect(press(current.find('body', 0, 'a'), 'ArrowLeft').defaultPrevented).toBe(true);
		expect(tree.setExpanded).toHaveBeenLastCalledWith('r0', false);

		press(current.find('body', 0, 'a'), 'ArrowRight');
		await settle();

		expect(tree.setExpanded).toHaveBeenLastCalledWith('r0', true);
		expect(document.activeElement).toBe(current.find('body', 0, 'a'));
	});

	it('← on a child row goes to its parent row', async () => {
		const { grid } = withTree();

		current = grid;
		current.find('body', 2, 'a').focus();
		press(current.find('body', 2, 'a'), 'ArrowLeft');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 0, 'a'));
	});

	it('→ on a leaf and the arrows outside the tree column move as always', async () => {
		const { tree, grid } = withTree();

		current = grid;
		current.find('body', 1, 'a').focus();
		press(current.find('body', 1, 'a'), 'ArrowRight');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 1, 'b'));

		press(current.find('body', 1, 'b'), 'ArrowLeft');
		await settle();

		expect(document.activeElement).toBe(current.find('body', 1, 'a'));
		expect(tree.setExpanded).not.toHaveBeenCalled();
	});

	it('the tree column can be another than the row header', async () => {
		const expanded = new Set<string>();
		const tree = {
			getNode: (key: string): RowNode => ({
				key, level: 0, parent: null, group: true, expanded: false, count: 1, position: 0, setSize: 1,
			}),
			isExpanded: (key: string) => expanded.has(key),
			setExpanded: vi.fn(),
		};

		current = setup({ options: { tree, treeColumn: 'b' } });
		current.find('body', 0, 'b').focus();
		press(current.find('body', 0, 'b'), 'ArrowRight');

		expect(tree.setExpanded).toHaveBeenCalledWith('r0', true);
	});

	it('the column marked `tree`, as `treeColumn()` marks it, is the tree column by default', () => {
		const tree = createTree();
		const marked = defineColumns({
			a: { value: (row: Row) => row.id },
			b: { value: (row: Row) => row.id },
			c: { value: (row: Row) => row.id, tree: true },
		});

		current = setup({ columns: marked, options: { tree } });
		current.find('body', 0, 'c').focus();
		press(current.find('body', 0, 'c'), 'ArrowLeft');

		expect(tree.setExpanded).toHaveBeenCalledWith('r0', false);
	});
});

describe('useGridNavigation — tab order', () => {
	it('while a cell has focus, the grid and the exit leave the tab order', () => {
		current = setup();
		current.find('body', 0, 'a').focus();

		expect(current.grid().tabIndex).toBe(-1);
		expect(current.exit().tabIndex).toBe(-1);
	});

	it('Tab from a cell leaves through the exit, and the grid returns to the tab order', () => {
		current = setup();
		current.find('body', 0, 'a').focus();
		press(current.find('body', 0, 'a'), 'Tab');

		expect(document.activeElement).toBe(current.exit());
		expect(current.grid().tabIndex).toBe(0);
		expect(current.exit().tabIndex).toBe(0);
	});

	it('Shift+Tab from past the grid enters it at the cell focus was last on', async () => {
		current = setup();
		current.find('body', 2, 'b').focus();
		press(current.find('body', 2, 'b'), 'Tab');
		(document.getElementById('after') as HTMLElement).focus();
		current.exit().focus();
		await settle();

		expect(document.activeElement).toBe(current.find('body', 2, 'b'));
	});
});

describe('useGridNavigation — scrolling', () => {
	it('a cell under the sticky header is scrolled out from under it', async () => {
		current = setup();

		const grid = current.grid();
		const head = grid.querySelector<HTMLElement>('[data-tc-grid-section="head"]') as HTMLElement;
		const target = current.find('body', 0, 'a');
		const scrollBy = vi.fn();
		const rect = (top: number, bottom: number, left = 0, right = 100) => () => ({ top, bottom, left, right, width: right - left, height: bottom - top }) as DOMRect;

		grid.scrollBy = scrollBy;
		grid.getBoundingClientRect = rect(0, 200, 0, 300);
		head.getBoundingClientRect = rect(0, 30, 0, 300);
		target.getBoundingClientRect = rect(10, 40);

		await current.navigation.focusCell({ section: 'body', row: 0, cell: 'a' });

		expect(scrollBy).toHaveBeenCalledWith({ top: -20, left: 0 });
	});
});

describe('getGridCellAttributes', () => {
	it('one frozen object per key', () => {
		expect(getGridCellAttributes('group:price')).toBe(getGridCellAttributes('group:price'));
		expect(Object.isFrozen(getGridCellAttributes('group:price'))).toBe(true);
	});
});
