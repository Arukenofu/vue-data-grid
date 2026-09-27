import { defineComponent, type ShallowRef, shallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';

import type { CellWriteResult } from '../../src/cells/use-cell-editing';
import { type ChangeHistoryOptions, type ChangeStep, useChangeHistory } from '../../src/cells/use-change-history';
import { useCellEditing } from '../../src/cells/use-cell-editing';
import { defineColumn, defineColumns } from '../../src/columns/define-columns';
import { useTableEngine } from '../../src/engine/use-table-engine';

interface Row {
	id: string;
	price: number;
	name?: string;
}

const column = defineColumn<Row>();

const columns = defineColumns({
	price: column(row => row.price, { editable: true, setValue: (row, price) => ({ ...row, price }) }),
	name: column(row => row.name ?? 'Alpha', { editable: true, setValue: (row, name) => ({ ...row, name: name.trim() }) }),
});

let unmount: (() => void) | null = null;

afterEach(() => {
	unmount?.();
	unmount = null;
});

function setup(options: ChangeHistoryOptions = {}) {
	const rows: ShallowRef<Row[]> = shallowRef([{ id: 'a', price: 1 }, { id: 'b', price: 2 }]);
	let result: { editing: ReturnType<typeof useCellEditing<Row>>; history: ReturnType<typeof useChangeHistory<Row>> } | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			const engine = useTableEngine<Row>({ columns, rows, root: shallowRef(null), rowKey: 'id', rowHeight: 30 });
			const editing = useCellEditing(engine.scope, {
				onCommit: (commit) => {
					rows.value = [...commit.apply(rows.value)];
				},
			});

			result = { editing, history: useChangeHistory(editing, options) };

			return () => null;
		},
	}));

	unmount = () => wrapper.unmount();

	return { rows, ...result! };
}

const prices = (rows: ShallowRef<Row[]>) => rows.value.map(row => row.price);

describe('useChangeHistory', () => {
	it('undoes and redoes a commit, a batch as one step', () => {
		const { rows, editing, history } = setup();

		editing.write([{ key: 'a', column: 'price', value: 10 }, { key: 'b', column: 'price', value: 20 }], 'paste');

		expect(history.canUndo.value).toBe(true);
		expect(history.undo()?.commit?.source).toBe('undo');
		expect(prices(rows)).toEqual([1, 2]);
		expect(history.canRedo.value).toBe(true);

		history.redo();

		expect(prices(rows)).toEqual([10, 20]);
		expect(history.canRedo.value).toBe(false);
	});

	it('a new commit after an undo drops the steps to redo', () => {
		const { editing, history } = setup();

		editing.write([{ key: 'a', column: 'price', value: 10 }], 'edit');
		history.undo();
		editing.write([{ key: 'b', column: 'price', value: 20 }], 'edit');

		expect(history.canRedo.value).toBe(false);
		expect(history.steps.value).toHaveLength(1);
	});

	it('a cell changed since the step is skipped rather than overwritten; the rest is undone', () => {
		const { rows, editing, history } = setup();

		editing.write([{ key: 'a', column: 'price', value: 10 }, { key: 'b', column: 'price', value: 20 }], 'paste');
		// A stream updates row `a` after the paste.
		rows.value = [{ id: 'a', price: 11 }, rows.value[1]];

		const result = history.undo();

		expect(prices(rows)).toEqual([11, 2]);
		expect(result?.skipped).toEqual([{ key: 'a', column: 'price', value: 1, expected: 10 }]);
	});

	it('steps follow their rows by key through a new order, and skip a row that is gone', () => {
		const { rows, editing, history } = setup();

		editing.write([{ key: 'b', column: 'price', value: 20 }], 'edit');
		rows.value = [...rows.value].reverse();
		history.undo();

		expect(rows.value[0]).toEqual({ id: 'b', price: 2 });

		history.redo();
		rows.value = rows.value.filter(row => row.id !== 'b');

		expect(history.undo()?.skipped).toHaveLength(1);
	});

	it('keeps `limit` steps, and `clear` forgets them', () => {
		const { editing, history } = setup({ limit: 2 });

		for (const value of [10, 11, 12]) {
			editing.write([{ key: 'a', column: 'price', value }], 'edit');
		}

		expect(history.steps.value.map(step => step.edits[0].after)).toEqual([11, 12]);

		history.clear();

		expect(history.canUndo.value).toBe(false);
		expect(history.undo()).toBeNull();
	});
});

describe('useChangeHistory — what a step keeps', () => {
	it('undoes an edit that `setValue` changed on its way in, such as trimmed text', () => {
		const { rows, editing, history } = setup();

		editing.write([{ key: 'a', column: 'name', value: ' Omega ' }], 'edit');

		expect(rows.value[0].name).toBe('Omega');

		history.undo();

		expect(rows.value[0].name).toBe('Alpha');

		history.redo();

		expect(rows.value[0].name).toBe('Omega');
	});

	it('keeps no steps with `limit: 0`', () => {
		const { editing, history } = setup({ limit: 0 });

		editing.write([{ key: 'a', column: 'price', value: 10 }], 'edit');

		expect(history.steps.value).toEqual([]);
		expect(history.canUndo.value).toBe(false);
	});

	it('a step keeps the values it changed, not the rows', () => {
		const { editing, history } = setup();

		editing.write([{ key: 'a', column: 'price', value: 10 }], 'paste');

		expect(history.steps.value).toEqual([{ source: 'paste', edits: [{ key: 'a', column: 'price', before: 1, after: 10 }] }]);
	});
});

describe('useChangeHistory — types', () => {
	it('types its results by the rows of the editing, and its steps by values', () => {
		const { history } = setup();

		expectTypeOf(history.undo()).toEqualTypeOf<CellWriteResult<Row> | null>();
		expectTypeOf(history.steps.value).toEqualTypeOf<readonly ChangeStep[]>();
	});
});
