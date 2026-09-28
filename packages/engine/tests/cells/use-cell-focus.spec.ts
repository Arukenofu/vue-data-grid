import { defineComponent, shallowRef, watchEffect } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCellFocus } from '../../src/cells/use-cell-focus';
import { type AnyColumn, type ColumnsInput, toColumnList } from '../../src/columns/column';
import { defineColumns } from '../../src/columns/define-columns';
import { useGridEngine } from '../../src/engine/use-grid-engine';
import { createScroller } from '../support/dom';

interface Row {
	id: string;
}

const value = (row: Row) => row.id;

const allColumns = defineColumns({ x: { value }, y: { value }, z: { value } });

function setup(ids: readonly string[] = ['a', 'b', 'c'], count = ids.length) {
	const rows = shallowRef<Row[]>([...ids, ...Array.from({ length: count - ids.length }, (_, index) => `r${index}`)]
		.map(id => ({ id })));
	const columns = shallowRef<ColumnsInput | readonly AnyColumn[]>(allColumns);
	const onFocus = vi.fn();
	const root = shallowRef<HTMLElement | null>(null);
	let focus: ReturnType<typeof useCellFocus> | null = null;
	let engine: ReturnType<typeof useGridEngine<Row>> | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			engine = useGridEngine({ columns, rows, root, rowKey: 'id', rowHeight: 36, virtual: { overscan: 0 } });
			focus = useCellFocus(engine.scope, { onFocus });

			return () => null;
		},
	}));

	return {
		rows,
		columns,
		root,
		onFocus,
		focus: focus as unknown as ReturnType<typeof useCellFocus>,
		engine: engine as unknown as ReturnType<typeof useGridEngine<Row>>,
		unmount: () => wrapper.unmount(),
	};
}

let current: ReturnType<typeof setup> | null = null;

afterEach(() => {
	current?.unmount();
	current = null;
});

describe('useCellFocus', () => {
	it('the first move without focus lands on the first cell', () => {
		current = setup();

		expect(current.focus.move('down')).toBe(true);
		expect(current.focus.focused.value).toEqual({ key: 'a', column: 'x', index: 0 });
	});

	it('moves go along rows and shown columns', () => {
		current = setup();

		const { focus } = current;

		focus.focus({ key: 'a', column: 'x' });
		focus.move('down');
		focus.move('right');
		focus.move('rowEnd');

		expect(focus.focused.value).toMatchObject({ key: 'b', column: 'z' });
	});

	it('every move scrolls to the cell and calls `onFocus`', () => {
		current = setup();

		const scrollToRow = vi.spyOn(current.engine.scope, 'scrollToRow');
		const scrollToColumn = vi.spyOn(current.engine.scope, 'scrollToColumn');

		current.focus.focus({ key: 'c', column: 'y' });

		expect(scrollToRow).toHaveBeenCalledWith(2, 'auto');
		expect(scrollToColumn).toHaveBeenCalledWith('y', 'auto');
		expect(current.onFocus).toHaveBeenCalledWith({ key: 'c', column: 'y', index: 2 });
	});

	it('focus follows its row when rows are re-sorted', () => {
		current = setup();
		current.focus.focus({ key: 'a', column: 'x' });
		current.rows.value = [...current.rows.value].reverse();

		expect(current.focus.focused.value?.index).toBe(2);
	});

	it('when the row is removed `focused` is empty and the next move starts from the old place', () => {
		current = setup();
		current.focus.focus({ key: 'b', column: 'y' });
		current.rows.value = current.rows.value.filter(row => row.id !== 'b');

		expect(current.focus.focused.value).toBeNull();

		current.focus.move('right');

		expect(current.focus.focused.value).toMatchObject({ key: 'c', column: 'z' });
	});

	it('a move skips a hidden column', () => {
		current = setup();
		current.focus.focus({ key: 'a', column: 'x' });
		current.columns.value = toColumnList(allColumns).filter(column => column.name !== 'y');
		current.focus.move('right');

		expect(current.focus.focused.value?.column).toBe('z');
	});

	it('an unknown address is not focused, `null` clears focus', () => {
		current = setup();

		const { focus } = current;

		expect(focus.focus({ key: 'nope', column: 'x' })).toBe(false);

		focus.focus({ key: 'a', column: 'x' });
		focus.focus(null);

		expect(focus.focused.value).toBeNull();
		expect(focus.isFocused({ key: 'a', column: 'x' })).toBe(false);
	});

	it('keeps the focused row rendered under the row window, with no wiring to the engine', () => {
		current = setup(['a'], 1000);
		current.root.value = createScroller({ width: 500, height: 360 });
		current.focus.focus({ key: 'r900', column: 'x' }, { reveal: false });

		expect(current.engine.items.value.at(-1)?.key).toBe('r900');

		current.focus.focus(null);

		expect(current.engine.items.value.at(-1)?.key).toBe('r8');
	});
});

describe('useCellFocus — per-row reactivity', () => {
	it('a move wakes the rows it leaves and enters, not the others', () => {
		current = setup();

		const { focus } = current;
		const runs = { a: 0, b: 0, c: 0 };

		for (const key of ['a', 'b', 'c'] as const) {
			watchEffect(() => {
				focus.isFocused({ key: key, column: 'x' });
				runs[key] += 1;
			}, { flush: 'sync' });
		}

		focus.focus({ key: 'a', column: 'x' });
		focus.move('right');
		focus.move('down');

		expect(runs).toEqual({ a: 4, b: 2, c: 1 });
	});

	it('`getFocusedColumn` is the focused column of the row, a memo token', () => {
		current = setup();

		const { focus } = current;

		focus.focus({ key: 'b', column: 'y' });

		expect(focus.getFocusedColumn('b')).toBe('y');
		expect(focus.getFocusedColumn('a')).toBeUndefined();
	});

	it('focus follows its row by key through sorting, and so does the row check', () => {
		current = setup();

		const { focus, rows } = current;

		focus.focus({ key: 'c', column: 'z' });
		rows.value = [...rows.value].reverse();

		expect(focus.isFocused({ key: 'c', column: 'z' })).toBe(true);
		expect(focus.focused.value).toMatchObject({ key: 'c', index: 0 });
	});
});
