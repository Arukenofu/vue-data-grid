import { defineComponent, effectScope, type ShallowRef, shallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';

import { type ChangeHistoryOptions, type ChangeReplay, type ChangeStep, useChangeHistory } from '../../src/cells/use-change-history';
import { useCellEditing } from '../../src/cells/use-cell-editing';
import { defineColumn, defineColumns } from '../../src/columns/define-columns';
import { useGridEngine } from '../../src/engine/use-grid-engine';
import { useRowEditing } from '../../src/rows/use-row-editing';

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

function setup(options: Omit<ChangeHistoryOptions<Row>, 'cells' | 'rows'> = {}) {
	const rows: ShallowRef<Row[]> = shallowRef([{ id: 'a', price: 1 }, { id: 'b', price: 2 }]);
	let result: {
		editing: ReturnType<typeof useCellEditing<Row>>;
		rowEditing: ReturnType<typeof useRowEditing<Row>>;
		history: ReturnType<typeof useChangeHistory<Row>>;
	} | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			const engine = useGridEngine<Row>({ columns, rows, root: shallowRef(null), rowKey: 'id', rowHeight: 30 });
			const editing = useCellEditing(engine.scope, {
				onCommit: (commit) => {
					rows.value = [...commit.apply(rows.value)];
				},
			});

			const rowEditing = useRowEditing<Row>({
				rows,
				rowKey: 'id',
				onCommit: (commit) => {
					rows.value = [...commit.rows];
				},
			});

			result = { editing, rowEditing, history: useChangeHistory({ ...options, cells: editing, rows: rowEditing }) };

			return () => null;
		},
	}));

	unmount = () => wrapper.unmount();

	return { rows, ...result! };
}

const prices = (rows: ShallowRef<Row[]>) => rows.value.map(row => row.price);

const ids = (rows: ShallowRef<Row[]>) => rows.value.map(row => row.id);

/** The write of cells a replay made. */
function cellResult(replay: ChangeReplay | null) {
	return replay?.kind === 'cells' ? replay.result : undefined;
}

describe('useChangeHistory', () => {
	it('undoes and redoes a commit, a batch as one step', () => {
		const { rows, editing, history } = setup();

		editing.write([{ key: 'a', column: 'price', value: 10 }, { key: 'b', column: 'price', value: 20 }], 'paste');

		expect(history.canUndo.value).toBe(true);
		expect(cellResult(history.undo())?.commit?.source).toBe('undo');
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
		expect(cellResult(result)?.skipped).toEqual([{ key: 'a', column: 'price', value: 1, expected: 10 }]);
	});

	it('steps follow their rows by key through a new order, and skip a row that is gone', () => {
		const { rows, editing, history } = setup();

		editing.write([{ key: 'b', column: 'price', value: 20 }], 'edit');
		rows.value = [...rows.value].reverse();
		history.undo();

		expect(rows.value[0]).toEqual({ id: 'b', price: 2 });

		history.redo();
		rows.value = rows.value.filter(row => row.id !== 'b');

		expect(cellResult(history.undo())?.skipped).toHaveLength(1);
	});

	it('keeps `limit` steps, and `clear` forgets them', () => {
		const { editing, history } = setup({ limit: 2 });

		for (const value of [10, 11, 12]) {
			editing.write([{ key: 'a', column: 'price', value }], 'edit');
		}

		expect(history.steps.value.map(step => (step.kind === 'cells' ? step.edits[0].after : null))).toEqual([11, 12]);

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

		expect(history.steps.value).toEqual([{ kind: 'cells', source: 'paste', edits: [{ key: 'a', column: 'price', before: 1, after: 10 }] }]);
	});
});

describe('useChangeHistory — types', () => {
	it('types its results by the rows of the editing, and its steps by values', () => {
		const { history } = setup();

		expectTypeOf(history.undo()).toEqualTypeOf<ChangeReplay | null>();
		expectTypeOf(history.steps.value).toEqualTypeOf<readonly ChangeStep[]>();
	});
});

describe('useChangeHistory — rows', () => {
	it('undoes and redoes an add, a removal and a move of rows', () => {
		const { rows, rowEditing, history } = setup();

		rowEditing.write([{ type: 'add', row: { id: 'c', price: 3 }, index: 0 }], 'add');
		rowEditing.write([{ type: 'remove', key: 'a' }], 'remove');
		rowEditing.write([{ type: 'move', key: 'b', index: 0 }], 'move');

		expect(ids(rows)).toEqual(['b', 'c']);
		expect(history.steps.value.map(step => step.source)).toEqual(['add', 'remove', 'move']);

		history.undo();
		history.undo();

		expect(ids(rows)).toEqual(['c', 'a', 'b']);

		history.undo();

		expect(ids(rows)).toEqual(['a', 'b']);

		history.redo();
		history.redo();
		history.redo();

		expect(ids(rows)).toEqual(['b', 'c']);
	});

	it('keeps cell edits and row changes in one stack, in order', () => {
		const { rows, editing, rowEditing, history } = setup();

		editing.write([{ key: 'b', column: 'price', value: 20 }], 'edit');
		rowEditing.write([{ type: 'remove', key: 'b' }], 'remove');

		expect(history.steps.value.map(step => step.kind)).toEqual(['cells', 'rows']);

		history.undo();

		expect(rows.value).toEqual([{ id: 'a', price: 1 }, { id: 'b', price: 20 }]);

		history.undo();

		expect(prices(rows)).toEqual([1, 2]);
	});

	it('skips a row change that a stream made out of date, rather than overwrite the row', () => {
		const { rows, rowEditing, history } = setup();

		rowEditing.write([{ type: 'add', row: { id: 'c', price: 3 } }], 'add');
		rows.value = rows.value.map(row => (row.id === 'c' ? { ...row, price: 4 } : row));

		const replay = history.undo();

		expect(ids(rows)).toEqual(['a', 'b', 'c']);
		expect(replay?.kind === 'rows' ? replay.results[0].skipped : []).toEqual([expect.objectContaining({ type: 'remove', key: 'c' })]);
	});

	it('makes one step of linked commits of several row editings, such as of a drop between grids', () => {
		const scope = effectScope();
		const first = shallowRef<Row[]>([{ id: 'a', price: 1 }, { id: 'b', price: 2 }]);
		const second = shallowRef<Row[]>([{ id: 'x', price: 9 }]);
		const created = scope.run(() => {
			const create = (rows: ShallowRef<Row[]>) => useRowEditing<Row>({
				rows,
				rowKey: 'id',
				onCommit: (commit) => {
					rows.value = [...commit.rows];
				},
			});
			const editings = { from: create(first), to: create(second) };

			return { ...editings, history: useChangeHistory<Row>({ rows: [editings.from, editings.to] }) };
		});

		if (!created) {
			throw new Error('The scope did not run.');
		}

		const { from, to, history } = created;
		const added = to.write([{ type: 'add', row: first.value[1], index: 0 }], 'drop');

		from.write([{ type: 'remove', key: 'b', expected: first.value[1] }], 'drop', { link: added.commit });

		expect(history.steps.value).toHaveLength(1);
		expect(second.value.map(row => row.id)).toEqual(['b', 'x']);

		history.undo();

		expect(first.value.map(row => row.id)).toEqual(['a', 'b']);
		expect(second.value.map(row => row.id)).toEqual(['x']);

		history.redo();

		expect(first.value.map(row => row.id)).toEqual(['a']);
		expect(second.value.map(row => row.id)).toEqual(['b', 'x']);
		scope.stop();
	});

	it('keeps the array of `steps` while no step comes or goes', () => {
		const { rowEditing, history } = setup();

		rowEditing.write([{ type: 'remove', key: 'a' }], 'remove');

		const steps = history.steps.value;

		rowEditing.write([{ type: 'remove', key: 'missing' }], 'remove');

		expect(history.steps.value).toBe(steps);
	});

	it('needs the editing it records', () => {
		expect(() => useChangeHistory({})).toThrow('needs `cells`, `rows` or both');
	});
});
