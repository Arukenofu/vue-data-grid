import { defineColumns, type TableScope, useTableColumnsState, useTableEngine } from '@vue-stack/table-core';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, shallowRef, watchEffect } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ColumnResizeOptions, useColumnResize } from '../../src/columns/use-column-resize';

interface Row {
	id: string;
}

const columns = defineColumns({
	price: { value: (row: Row) => row.id, label: 'Price', width: 100, minWidth: 40, maxWidth: 300, resizable: true },
	fixed: { value: (row: Row) => row.id, width: 100 },
});

function setup(options: ColumnResizeOptions = {}) {
	const root = shallowRef<HTMLElement | null>(null);
	const state = useTableColumnsState();
	let scope: TableScope | null = null;
	let resize: ReturnType<typeof useColumnResize> | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			scope = useTableEngine<Row>({ columns, rows: [{ id: 'a' }], root, rowKey: 'id', rowHeight: 30, state }).scope;
			resize = useColumnResize(scope, options);

			return () => h('div', { ref: root }, [
				h('div', { 'data-tc-column': 'price' }, [h('span', 'a much longer text')]),
				h('span', { class: 'handle', ...resize?.getHandleProps('price') }),
			]);
		},
	}), { attachTo: document.body });

	return {
		wrapper,
		state,
		scope: scope as unknown as TableScope,
		resize: resize as unknown as ReturnType<typeof useColumnResize>,
		handle: () => wrapper.get('.handle'),
	};
}

let current: ReturnType<typeof setup> | null = null;

let inCell: { scope: TableScope; unmount: () => void } | null = null;

/**
 * A handle inside the header cell of `price`, declared with `extra` on top, as the parts render it;
 * the cell is drawn 100 px wide unless a test says otherwise.
 */
function mountInCell(extra: Record<string, unknown>) {
	const root = shallowRef<HTMLElement | null>(null);
	const declared = defineColumns({
		price: { value: (row: Row) => row.id, label: 'Price', width: 100, minWidth: 40, maxWidth: 300, resizable: true, ...extra },
	});
	let scope: TableScope | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			scope = useTableEngine<Row>({ columns: declared, rows: [{ id: 'a' }], root, rowKey: 'id', rowHeight: 30 }).scope;

			const resize = useColumnResize(scope);

			return () => h('div', { ref: root }, [
				h('div', { 'data-tc-column': 'price' }, [h('span', { class: 'handle', ...resize.getHandleProps('price') })]),
			]);
		},
	}), { attachTo: document.body });
	const cell = wrapper.get('[data-tc-column]').element;

	vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({ width: 100 } as DOMRect);
	inCell = { scope: scope as unknown as TableScope, unmount: () => wrapper.unmount() };

	return wrapper.get('.handle').element as HTMLElement;
}

beforeEach(() => {
	// Widths apply at once instead of in the next animation frame.
	vi.stubGlobal('requestAnimationFrame', undefined);
});

afterEach(() => {
	current?.wrapper.unmount();
	current = null;
	inCell?.unmount();
	inCell = null;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

function pointer(type: string, clientX: number) {
	return new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, pointerId: 1 });
}

describe('useColumnResize — the handle', () => {
	it('is a focusable separator that tells the width and its limits', () => {
		current = setup();

		expect(current.handle().attributes()).toMatchObject({
			role: 'separator',
			'aria-orientation': 'vertical',
			'aria-label': 'Resize Price',
			'aria-valuenow': '100',
			'aria-valuemin': '40',
			'aria-valuemax': '300',
			'aria-valuetext': '100 px',
			tabindex: '0',
			'data-tc-part': 'resize-handle',
		});
	});

	it('gives nothing for a column that is not resizable', () => {
		current = setup();

		expect(current.resize.getHandleProps('fixed')).toEqual({});
	});

	it('takes its name and text from the options', () => {
		current = setup({ label: column => `Width of ${column.label}`, valueText: width => `${width} pixels` });

		expect(current.handle().attributes()).toMatchObject({ 'aria-label': 'Width of Price', 'aria-valuetext': '100 pixels' });
	});

	it('stops the click, so the header cell under it does not sort', async () => {
		current = setup();

		const click = new MouseEvent('click', { bubbles: true, cancelable: true });

		current.handle().element.dispatchEvent(click);

		expect(click.defaultPrevented).toBe(true);
	});
});

describe('useColumnResize — the pointer', () => {
	it('a drag changes the width within its limits and writes it to the layout on release', async () => {
		current = setup();

		const handle = current.handle().element;

		handle.dispatchEvent(pointer('pointerdown', 500));
		handle.dispatchEvent(pointer('pointermove', 550));

		expect(current.scope.getWidth('price')).toBe(150);
		expect(current.resize.resizing.value).toBe('price');
		expect(current.state.layout.value).toBeNull();

		handle.dispatchEvent(pointer('pointermove', 1000));
		expect(current.scope.getWidth('price')).toBe(300);

		handle.dispatchEvent(pointer('pointerup', 1000));

		expect(current.state.layout.value?.widths.price).toBe(300);
		expect(current.resize.resizing.value).toBeNull();
	});

	it('a second pointer neither takes the drag over nor ends it', () => {
		current = setup();

		const handle = current.handle().element;
		const second = (type: string, clientX: number) => new PointerEvent(type, { bubbles: true, button: 0, clientX, pointerId: 2 });

		handle.dispatchEvent(pointer('pointerdown', 500));
		handle.dispatchEvent(second('pointerdown', 800));
		handle.dispatchEvent(second('pointermove', 900));
		handle.dispatchEvent(pointer('pointermove', 550));
		handle.dispatchEvent(second('pointerup', 900));

		expect(current.scope.getWidth('price')).toBe(150);
		expect(current.resize.resizing.value).toBe('price');

		handle.dispatchEvent(pointer('pointerup', 550));

		expect(current.state.layout.value?.widths.price).toBe(150);
	});

	it('a key released during a drag does not end it', () => {
		current = setup();

		const handle = current.handle().element;

		handle.dispatchEvent(pointer('pointerdown', 500));
		handle.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
		handle.dispatchEvent(pointer('pointermove', 530));

		expect(current.resize.resizing.value).toBe('price');
		expect(current.scope.getWidth('price')).toBe(130);
	});

	it('the handle props wake at the start and the end of a drag, not on every move', () => {
		current = setup();

		const resize = current.resize;
		const values: unknown[] = [];

		watchEffect(() => {
			values.push(resize.getHandleProps('price')['aria-valuenow']);
		}, { flush: 'sync' });

		const handle = current.handle().element;

		handle.dispatchEvent(pointer('pointerdown', 500));
		handle.dispatchEvent(pointer('pointermove', 520));
		handle.dispatchEvent(pointer('pointermove', 540));
		handle.dispatchEvent(pointer('pointermove', 550));

		// Once for the handle itself and once as the drag starts; the moves wake nothing.
		expect(values).toEqual([100, 100]);

		handle.dispatchEvent(pointer('pointerup', 550));

		expect(values.at(-1)).toBe(150);
	});

	it('in a right-to-left table a drag toward the start widens the column', () => {
		current = setup();

		const handle = current.handle().element as HTMLElement;

		handle.style.direction = 'rtl';
		handle.dispatchEvent(pointer('pointerdown', 500));
		handle.dispatchEvent(pointer('pointermove', 450));

		expect(current.scope.getWidth('price')).toBe(150);
	});

	it('starts from the width the column is drawn at, so a flex column does not jump', () => {
		const handle = mountInCell({ flex: 1 });
		const cell = handle.closest('[data-tc-column]') as HTMLElement;

		vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({ width: 240 } as DOMRect);
		handle.dispatchEvent(pointer('pointerdown', 500));
		handle.dispatchEvent(pointer('pointermove', 501));

		expect(inCell?.scope.getWidth('price')).toBe(241);
	});

	it('widens a column pinned to the end towards the start, where its handle is', () => {
		const handle = mountInCell({ pinned: 'end' });

		handle.dispatchEvent(pointer('pointerdown', 500));
		handle.dispatchEvent(pointer('pointermove', 450));

		expect(inCell?.scope.getWidth('price')).toBe(150);
	});

	it('a gesture still in progress is written when the handle goes away', () => {
		current = setup();

		const handle = current.handle().element;

		handle.dispatchEvent(pointer('pointerdown', 500));
		handle.dispatchEvent(pointer('pointermove', 520));
		current.wrapper.unmount();

		expect(current.state.layout.value?.widths.price).toBe(120);
		current = null;
	});

	it('a double click fits the column to its content', () => {
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function measure(this: HTMLElement) {
			return { width: (this.textContent?.length ?? 0) * 10 } as DOMRect;
		});
		current = setup();

		current.handle().element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		expect(current.state.layout.value?.widths.price).toBe(180);
	});

	it('`autosize: false` leaves the double click alone', () => {
		current = setup({ autosize: false });

		current.handle().element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		expect(current.state.layout.value).toBeNull();
	});
});

describe('useColumnResize — the keys', () => {
	function press(key: string) {
		const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

		current?.handle().element.dispatchEvent(event);

		return event;
	}

	it('arrows change the width by the step, held presses add up, and release writes it', () => {
		current = setup({ step: 10 });

		expect(press('ArrowRight').defaultPrevented).toBe(true);
		press('ArrowRight');
		press('ArrowLeft');
		press('ArrowRight');

		expect(current.scope.getWidth('price')).toBe(120);
		expect(current.state.layout.value).toBeNull();

		current.handle().element.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));

		expect(current.state.layout.value?.widths.price).toBe(120);
	});

	it('reads the step when a key comes, so a ref or a getter can change it', () => {
		const step = shallowRef(10);

		current = setup({ step });
		press('ArrowRight');
		step.value = 30;
		press('ArrowRight');

		expect(current.scope.getWidth('price')).toBe(140);
	});

	it('marks the handle `resizing` while a key resizes, `idle` otherwise', async () => {
		current = setup();

		expect(current.handle().attributes('data-tc-state')).toBe('idle');

		press('ArrowRight');
		await nextTick();

		expect(current.handle().attributes('data-tc-state')).toBe('resizing');
	});

	it('Home and End take the width to its limits', () => {
		current = setup();

		press('End');
		expect(current.scope.getWidth('price')).toBe(300);

		press('Home');
		expect(current.scope.getWidth('price')).toBe(40);
	});

	it('other keys pass through to the grid around the handle', () => {
		current = setup();

		expect(press('ArrowUp').defaultPrevented).toBe(false);
		expect(press('Enter').defaultPrevented).toBe(false);
	});
});
