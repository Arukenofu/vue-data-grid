import { defineColumns, useTableColumnsState, useTableEngine } from '@vue-data-grid/engine';
import { defineComponent, effectScope, h, nextTick, shallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHeaderCell } from '../../src/header/use-header-cell';

interface Row {
	id: string;
	price: number;
}

const columns = defineColumns({
	symbol: { value: (row: Row) => row.id, width: 100, sortable: true, movable: true },
	price: { value: (row: Row) => row.price, width: 80, minWidth: 60, maxWidth: 120, sortable: true, movable: true, resizable: true },
	cap: { value: (row: Row) => row.price * 2, width: 90, movable: true },
	fixed: { value: (row: Row) => row.id, width: 50 },
	volume: { value: (row: Row) => row.price, width: 70, movable: true },
});

let frames: FrameRequestCallback[] = [];

function runFrames() {
	const pending = frames;

	frames = [];
	pending.forEach(callback => callback(0));
}

beforeEach(() => {
	frames = [];
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
	vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

function setup(rtl = false) {
	const state = useTableColumnsState({ columns, multiSort: true });
	let engine: ReturnType<typeof useTableEngine<Row>> | null = null;
	let header: ReturnType<typeof useHeaderCell> | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			engine = useTableEngine<Row>({ columns, rows: [], root: shallowRef(null), rowKey: 'id', rowHeight: 30, state });
			header = useHeaderCell(engine.scope);

			const { renderedColumns } = engine.scope;

			return () => h('div', { style: rtl ? 'direction: rtl' : undefined }, renderedColumns.value.map((item) => {
				const name = item.column?.name ?? '';

				return h('div', { ...item.headerProps, ...header?.getHandlers(name), tabindex: 0 }, [
					name,
					h('button', { type: 'button', 'data-control': name }, 'menu'),
				]);
			}));
		},
	}), { attachTo: document.body });

	const scope = (engine as unknown as ReturnType<typeof useTableEngine<Row>>).scope;

	function cell(name: string) {
		return document.querySelector<HTMLElement>(`[data-dg-column="${name}"]`) as HTMLElement;
	}

	function press(name: string, key: string, init: KeyboardEventInit = {}) {
		const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });

		cell(name).dispatchEvent(event);

		return event;
	}

	function order() {
		return scope.columns.value.map(item => item.column?.name);
	}

	return { wrapper, state, scope, cell, press, order };
}

let current: ReturnType<typeof setup> | null = null;

afterEach(() => {
	current?.wrapper.unmount();
	current = null;
	vi.unstubAllGlobals();
	document.body.innerHTML = '';
});

describe('useHeaderCell — sorting', () => {
	it('Enter and Space sort, and Shift adds the column to the sort', () => {
		current = setup();

		expect(current.press('price', 'Enter').defaultPrevented).toBe(true);
		expect(current.state.sort.value).toEqual([{ name: 'price', direction: 'desc' }]);

		current.press('symbol', ' ', { shiftKey: true });

		expect(current.state.sort.value.map(item => item.name)).toEqual(['price', 'symbol']);
	});

	it('Ctrl+Space and ⌘+Space are left to the navigation, which selects the column', () => {
		current = setup();

		expect(current.press('price', ' ', { ctrlKey: true }).defaultPrevented).toBe(false);
		expect(current.press('price', ' ', { metaKey: true }).defaultPrevented).toBe(false);
		expect(current.state.sort.value).toEqual([]);

		current.press('price', 'Enter', { ctrlKey: true });

		expect(current.state.sort.value).toEqual([{ name: 'price', direction: 'desc' }]);
	});

	it('a click sorts, and Shift adds the column to the sort', () => {
		current = setup();
		current.cell('price').click();
		current.cell('symbol').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));

		expect(current.state.sort.value.map(item => item.name)).toEqual(['price', 'symbol']);
	});

	it('a click on a control inside the cell belongs to the control, and so does a handled one', () => {
		current = setup();
		document.querySelector<HTMLElement>('[data-control="price"]')?.click();

		const handled = new MouseEvent('click', { bubbles: true, cancelable: true });

		handled.preventDefault();
		current.cell('price').dispatchEvent(handled);

		expect(current.state.sort.value).toEqual([]);
	});

	it('gives each column one frozen set of handlers', () => {
		const scope = effectScope();
		const first = scope.run(() => {
			const engine = useTableEngine<Row>({ columns, rows: [], root: shallowRef(null), rowKey: 'id', rowHeight: 30 });

			return useHeaderCell(engine.scope);
		});

		expect(first?.getHandlers('price')).toBe(first?.getHandlers('price'));
		expect(Object.isFrozen(first?.getHandlers('price'))).toBe(true);
		scope.stop();
	});

	it('a column that does not sort leaves Enter alone', () => {
		current = setup();

		expect(current.press('cap', 'Enter').defaultPrevented).toBe(false);
		expect(current.state.sort.value).toEqual([]);
	});
});

describe('useHeaderCell — moving', () => {
	it('Alt+→ moves the column one place once the frame comes', () => {
		current = setup();

		expect(current.press('symbol', 'ArrowRight', { altKey: true }).defaultPrevented).toBe(true);
		expect(current.order()).toEqual(['symbol', 'price', 'cap', 'fixed', 'volume']);

		runFrames();

		expect(current.order()).toEqual(['price', 'symbol', 'cap', 'fixed', 'volume']);
	});

	it('presses within one frame collapse into one move', () => {
		current = setup();
		current.press('symbol', 'ArrowRight', { altKey: true });
		current.press('symbol', 'ArrowRight', { altKey: true });
		runFrames();

		expect(current.order()).toEqual(['price', 'cap', 'symbol', 'fixed', 'volume']);
	});

	it('a move stops before a column that does not move', () => {
		current = setup();

		for (let press = 0; press < 4; press += 1) {
			current.press('symbol', 'ArrowRight', { altKey: true });
		}

		runFrames();

		expect(current.order()).toEqual(['price', 'cap', 'symbol', 'fixed', 'volume']);
	});

	it('in a right-to-left header Alt+← moves toward the end', () => {
		current = setup(true);
		current.press('symbol', 'ArrowLeft', { altKey: true });
		runFrames();

		expect(current.order()).toEqual(['price', 'symbol', 'cap', 'fixed', 'volume']);
	});

	it('focus stays on the moved cell', async () => {
		current = setup();
		current.cell('symbol').focus();
		current.press('symbol', 'ArrowRight', { altKey: true });
		runFrames();
		await nextTick();

		expect(document.activeElement).toBe(current.cell('symbol'));
	});

	it('a column that does not move leaves Alt+→ alone', () => {
		current = setup();

		expect(current.press('fixed', 'ArrowRight', { altKey: true }).defaultPrevented).toBe(false);
	});
});

describe('useHeaderCell — resizing', () => {
	it('Shift+→ widens by a step and the width reaches the layout when the key is released', () => {
		current = setup();

		expect(current.press('price', 'ArrowRight', { shiftKey: true }).defaultPrevented).toBe(true);

		current.press('price', 'ArrowRight', { shiftKey: true });
		runFrames();

		expect(current.scope.getWidth('price')).toBe(112);
		expect(current.state.layout.value?.widths.price).toBeUndefined();

		current.cell('price').dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));

		expect(current.state.layout.value?.widths.price).toBe(112);
	});

	it('the width stays within `minWidth` and `maxWidth`, so the way back is as long as the way there', () => {
		current = setup();

		for (let press = 0; press < 5; press += 1) {
			current.press('price', 'ArrowRight', { shiftKey: true });
		}

		current.press('price', 'ArrowLeft', { shiftKey: true });
		runFrames();

		expect(current.scope.getWidth('price')).toBe(104);
	});

	it('leaving the cell ends the change', () => {
		current = setup();
		current.press('price', 'ArrowLeft', { shiftKey: true });
		current.cell('price').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

		expect(current.state.layout.value?.widths.price).toBe(64);
	});

	it('a column that does not resize leaves Shift+→ alone', () => {
		current = setup();

		expect(current.press('symbol', 'ArrowRight', { shiftKey: true }).defaultPrevented).toBe(false);
	});
});
