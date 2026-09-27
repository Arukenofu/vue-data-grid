import { computed, defineComponent, shallowRef, watchEffect } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridSection } from '../../src/cells/grid-move';
import { type GridFocusOptions, useGridFocus } from '../../src/cells/use-grid-focus';
import { type AnyColumn, type ColumnsInput, toColumnList } from '../../src/columns/column';
import { defineColumns } from '../../src/columns/define-columns';
import { useTableEngine } from '../../src/engine/use-table-engine';
import { createScroller } from '../support/dom';

interface Row {
	id: string;
}

const value = (row: Row) => row.id;

const allColumns = defineColumns({ x: { value }, y: { value }, z: { value } });

type Engine = ReturnType<typeof useTableEngine<Row>>;

function setup(ids: readonly string[] = ['a', 'b', 'c'], options: Omit<GridFocusOptions, 'onFocus'> = {}) {
	const rows = shallowRef<Row[]>(ids.map(id => ({ id })));
	const columns = shallowRef<ColumnsInput | readonly AnyColumn[]>(allColumns);
	const onFocus = vi.fn();
	const root = shallowRef<HTMLElement | null>(null);
	let focus: ReturnType<typeof useGridFocus> | null = null;
	let engine: Engine | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			engine = useTableEngine({ columns, rows, root, rowKey: 'id', rowHeight: 36, virtual: { overscan: 0 } });
			focus = useGridFocus(engine.scope, { ...options, onFocus });

			return () => null;
		},
	}));

	return {
		rows,
		columns,
		root,
		onFocus,
		focus: focus as unknown as ReturnType<typeof useGridFocus>,
		engine: engine as unknown as Engine,
		unmount: () => wrapper.unmount(),
	};
}

/** A header row, the body and a footer row over the shown columns of the engine. */
function sectionsOf(current: { engine: Engine; rows: { value: readonly Row[] } }) {
	return computed<readonly GridSection[]>(() => {
		const cells = current.engine.scope.columns.value.flatMap(item => (item.column ? [{ key: item.column.name }] : []));

		return [
			{ name: 'head', rows: 1, cells },
			{ name: 'body', rows: current.rows.value.length, cells },
			{ name: 'foot', rows: 1, cells },
		];
	});
}

function setupSections(ids: readonly string[] = ['a', 'b', 'c']) {
	let sections: ReturnType<typeof sectionsOf> | null = null;
	const current = setup(ids, { sections: () => sections?.value ?? [] });

	sections = sectionsOf(current);

	return current;
}

let current: ReturnType<typeof setup> | null = null;

afterEach(() => {
	current?.unmount();
	current = null;
});

describe('useGridFocus — the body alone', () => {
	it('without sections the grid is the rows of the scope by its shown columns', () => {
		current = setup();

		expect(current.focus.move('down')).toBe(true);
		expect(current.focus.focused.value).toEqual({ section: 'body', row: 0, cell: 'x', key: 'a' });
	});

	it('a body cell follows its row through a re-sort', () => {
		current = setup();
		current.focus.focus({ section: 'body', row: 0, cell: 'x' });
		current.rows.value = [...current.rows.value].reverse();

		expect(current.focus.focused.value).toEqual({ section: 'body', row: 2, cell: 'x', key: 'a' });
	});

	it('when the row is removed, `focused` is empty and the next move starts from the old place', () => {
		current = setup();
		current.focus.focus({ section: 'body', row: 1, cell: 'y' });
		current.rows.value = current.rows.value.filter(row => row.id !== 'b');

		expect(current.focus.focused.value).toBeNull();

		current.focus.move('right');

		expect(current.focus.focused.value).toMatchObject({ key: 'c', cell: 'z' });
	});

	it('when its column is hidden, the next move starts from the cell that took its place', () => {
		current = setup();
		current.focus.focus({ section: 'body', row: 0, cell: 'y' });
		current.columns.value = toColumnList(allColumns).filter(column => column.name !== 'y');

		expect(current.focus.focused.value).toBeNull();

		current.focus.move('left');

		expect(current.focus.focused.value).toMatchObject({ key: 'a', cell: 'x' });
	});

	it('an unknown section, row or cell is not focused, and `null` clears focus', () => {
		current = setup();

		const { focus } = current;

		expect(focus.focus({ section: 'head', row: 0, cell: 'x' })).toBe(false);
		expect(focus.focus({ section: 'body', row: 5, cell: 'x' })).toBe(false);
		expect(focus.focus({ section: 'body', row: 0, cell: 'nope' })).toBe(false);

		focus.focus({ section: 'body', row: 0, cell: 'x' });
		expect(focus.isFocused({ section: 'body', row: 0, cell: 'x' })).toBe(true);

		focus.focus(null);
		expect(focus.focused.value).toBeNull();
	});
});

describe('useGridFocus — sections', () => {
	it('moves cross from the header into the body and on into the footer', () => {
		current = setupSections();

		const { focus } = current;

		focus.focus({ section: 'body', row: 0, cell: 'y' });
		focus.move('up');
		expect(focus.focused.value).toEqual({ section: 'head', row: 0, cell: 'y', key: undefined });

		focus.move('last');
		expect(focus.focused.value).toEqual({ section: 'foot', row: 0, cell: 'z', key: undefined });

		focus.move('up');
		expect(focus.focused.value).toEqual({ section: 'body', row: 2, cell: 'z', key: 'c' });
	});

	it('a header cell keeps its place when the rows change', () => {
		current = setupSections();
		current.focus.focus({ section: 'head', row: 0, cell: 'x' });

		const before = current.focus.focused.value;

		current.rows.value = [...current.rows.value].reverse();

		expect(current.focus.focused.value).toBe(before);
	});

	it('`step` moves a page of rows at once', () => {
		current = setupSections(['a', 'b', 'c', 'd', 'e']);
		current.focus.focus({ section: 'head', row: 0, cell: 'x' });
		current.focus.move('down', 3);

		expect(current.focus.focused.value).toMatchObject({ section: 'body', row: 2, key: 'c' });
	});
});

describe('useGridFocus — scrolling and windows', () => {
	it('focusing scrolls to the row and the column and calls `onFocus`; `reveal: false` only records', () => {
		current = setupSections();

		const scrollToRow = vi.spyOn(current.engine.scope, 'scrollToRow');
		const scrollToColumn = vi.spyOn(current.engine.scope, 'scrollToColumn');

		current.focus.focus({ section: 'body', row: 2, cell: 'y' });

		expect(scrollToRow).toHaveBeenCalledWith(2, 'auto');
		expect(scrollToColumn).toHaveBeenCalledWith('y', 'auto');
		expect(current.onFocus).toHaveBeenCalledWith({ section: 'body', row: 2, cell: 'y', key: 'c' });

		scrollToRow.mockClear();
		current.focus.focus({ section: 'head', row: 0, cell: 'z' });
		expect(scrollToRow).not.toHaveBeenCalled();

		current.onFocus.mockClear();
		current.focus.focus({ section: 'body', row: 0, cell: 'x' }, { reveal: false });
		expect(current.onFocus).not.toHaveBeenCalled();
		expect(current.focus.focused.value).toMatchObject({ key: 'a' });
	});

	it('keeps the focused body row rendered under the row window, and a header cell keeps none', () => {
		current = setupSections(Array.from({ length: 1000 }, (_, index) => `r${index}`));
		current.root.value = createScroller({ width: 500, height: 360 });
		current.focus.focus({ section: 'body', row: 900, cell: 'x' }, { reveal: false });

		expect(current.engine.items.value.at(-1)?.key).toBe('r900');

		current.focus.focus({ section: 'head', row: 0, cell: 'x' }, { reveal: false });

		expect(current.engine.items.value.at(-1)?.key).toBe('r9');
	});

	it('keeps the focused column rendered under the column window, in every section', () => {
		current = setupSections();
		current.columns.value = defineColumns(Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`c${index}`, { value }])));
		current.root.value = createScroller({ width: 300, height: 360 });

		const rendered = () => current?.engine.scope.renderedColumns.value.flatMap(item => (item.column ? [item.column.name] : []));

		expect(rendered()).not.toContain('c20');

		current.focus.focus({ section: 'head', row: 0, cell: 'c20' }, { reveal: false });
		expect(rendered()).toContain('c20');

		current.focus.focus(null);
		expect(rendered()).not.toContain('c20');
	});

	it('hands the windows the same kept rows and columns while the focused row and column hold', () => {
		let keep: { rows: () => readonly number[]; columns: () => readonly string[] } | null = null;
		let focus: ReturnType<typeof useGridFocus> | null = null;

		const wrapper = mount(defineComponent({
			setup() {
				const rows = shallowRef<Row[]>([{ id: 'a' }, { id: 'b' }]);
				const engine = useTableEngine({ columns: allColumns, rows, root: shallowRef(null), rowKey: 'id', rowHeight: 36 });
				const keepRendered = engine.scope.keepRendered;

				engine.scope.keepRendered = (options) => {
					keep = options as typeof keep;

					return keepRendered(options);
				};
				focus = useGridFocus(engine.scope);

				return () => null;
			},
		}));
		const grid = focus as unknown as ReturnType<typeof useGridFocus>;
		const kept = keep as unknown as { rows: () => readonly number[]; columns: () => readonly string[] };

		grid.focus({ section: 'body', row: 1, cell: 'x' });
		const rows = kept.rows();
		const columns = kept.columns();

		grid.focus({ section: 'body', row: 1, cell: 'y' });
		expect(kept.rows()).toBe(rows);

		grid.focus({ section: 'body', row: 0, cell: 'y' });
		expect(kept.rows()).toEqual([0]);
		expect(kept.columns()).not.toBe(columns);

		const nextColumns = kept.columns();

		grid.focus({ section: 'body', row: 1, cell: 'y' });
		expect(kept.columns()).toBe(nextColumns);

		wrapper.unmount();
	});
});

describe('useGridFocus — per-row reactivity', () => {
	it('a move wakes the rows it leaves and enters, in any section', () => {
		current = setupSections();

		const { focus } = current;
		const positions = [
			{ section: 'head', row: 0, cell: 'x' },
			{ section: 'body', row: 0, cell: 'x' },
			{ section: 'body', row: 1, cell: 'x' },
		];
		const runs = positions.map(() => 0);

		positions.forEach((position, index) => {
			watchEffect(() => {
				focus.isFocused(position);
				runs[index] += 1;
			}, { flush: 'sync' });
		});

		focus.focus({ section: 'head', row: 0, cell: 'x' });
		focus.move('down');
		focus.move('right');

		expect(runs).toEqual([3, 3, 1]);
	});

	it('the row check follows a body row to its new index', () => {
		current = setup();

		const { focus, rows } = current;

		focus.focus({ section: 'body', row: 2, cell: 'y' });
		rows.value = [...rows.value].reverse();

		expect(focus.isFocused({ section: 'body', row: 0, cell: 'y' })).toBe(true);
		expect(focus.isFocused({ section: 'body', row: 2, cell: 'y' })).toBe(false);
	});
});
