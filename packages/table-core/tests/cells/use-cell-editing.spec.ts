import { defineComponent, nextTick, type ShallowRef, shallowRef, watchEffect } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CellEdit } from '../../src/cells/cell-edit';
import {
	type CellCommit,
	type CellCommitRequest,
	type CellEditingOptions,
	type CellWriteResult,
	useCellEditing,
} from '../../src/cells/use-cell-editing';
import { defineColumn, defineColumns } from '../../src/columns/define-columns';
import { useTableEngine } from '../../src/engine/use-table-engine';

interface Row {
	id: string;
	name: string;
	price: number;
	locked?: boolean;
	title?: string;
	stock?: number;
}

const column = defineColumn<Row>();

const columns = defineColumns({
	id: column(row => row.id, { label: 'Id' }),
	name: column(row => row.name, {
		label: 'Name',
		hideable: true,
		editable: true,
		setValue: (row, name) => ({ ...row, name }),
		validate: name => (name.trim() === '' ? 'A name is required' : undefined),
	}),
	price: column(row => row.price, {
		label: 'Price',
		editable: row => !row.locked,
		parse: text => Number(text),
		setValue: (row, price) => ({ ...row, price }),
		validate: price => (Number.isNaN(price) ? 'Not a number' : undefined),
	}),
	number: column(row => row.id, { kind: 'service', editable: true, setValue: row => row }),
	title: column(row => row.title ?? '', {
		editable: true,
		setValue: (row, title) => ({ ...row, title: title.trim() }),
	}),
	stock: column(row => row.stock ?? 0, { editable: true, setValue: (row, stock) => ({ ...row, stock }) }),
});

const initial: Row[] = [
	{ id: 'a', name: 'Alpha', price: 1 },
	{ id: 'b', name: 'Beta', price: 2, locked: true },
	{ id: 'c', name: 'Gamma', price: 3 },
];

let unmount: (() => void) | null = null;

afterEach(() => {
	unmount?.();
	unmount = null;
});

function setup(options: Partial<CellEditingOptions<Row>> = {}) {
	const rows: ShallowRef<Row[]> = shallowRef(initial);
	const commits: CellCommit<Row>[] = [];
	let editing: ReturnType<typeof useCellEditing<Row>> | null = null;
	let scope: ReturnType<typeof useTableEngine<Row>>['scope'] | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			const engine = useTableEngine<Row>({ columns, rows, root: shallowRef(null), rowKey: 'id', rowHeight: 30 });

			scope = engine.scope;

			editing = useCellEditing(engine.scope, {
				onCommit: (commit) => {
					commits.push(commit);
					rows.value = [...commit.apply(rows.value)];
				},
				...options,
			});

			return () => null;
		},
	}));

	unmount = () => wrapper.unmount();

	return {
		rows,
		commits,
		editing: editing as unknown as ReturnType<typeof useCellEditing<Row>>,
		scope: scope as unknown as ReturnType<typeof useTableEngine<Row>>['scope'],
	};
}

describe('useCellEditing — what can be edited', () => {
	it('a cell is editable by its column, for its row, and only with `setValue` on a data column', () => {
		const { editing } = setup();

		expect(editing.canEdit({ key: 'a', column: 'name' })).toBe(true);
		expect(editing.canEdit({ key: 'a', column: 'price' })).toBe(true);
		expect(editing.canEdit({ key: 'b', column: 'price' })).toBe(false);
		expect(editing.canEdit({ key: 'a', column: 'id' })).toBe(false);
		expect(editing.canEdit({ key: 'a', column: 'number' })).toBe(false);
		expect(editing.canEdit({ key: 'x', column: 'name' })).toBe(false);
	});
});

describe('useCellEditing — a session', () => {
	it('starts with the value as the draft, and a commit writes the draft into a new row', () => {
		const { editing, rows, commits } = setup();
		const before = rows.value[0];

		expect(editing.start({ key: 'a', column: 'name' })).toBe(true);
		expect(editing.cell.value).toMatchObject({ key: 'a', column: 'name', value: 'Alpha', draft: 'Alpha', error: null });

		editing.setDraft('Apex');

		expect(editing.commit()).toBe(true);
		expect(editing.cell.value).toBeNull();
		expect(rows.value[0]).toEqual({ ...before, name: 'Apex' });
		expect(before.name).toBe('Alpha');
		expect(commits[0]).toMatchObject({ source: 'edit', edits: [{ key: 'a', column: 'name', before: 'Alpha', after: 'Apex' }] });
	});

	it('text typed on the cell starts it through `parse`, and `text` keeps it as typed', () => {
		const { editing } = setup();

		editing.start({ key: 'c', column: 'price' }, { text: '7' });

		expect(editing.cell.value).toMatchObject({ draft: 7, text: '7', value: 3 });

		editing.setText('7.');

		expect(editing.cell.value).toMatchObject({ draft: 7, text: '7.' });

		editing.setDraft(8);

		expect(editing.cell.value).toMatchObject({ draft: 8, text: undefined });
	});

	it('an invalid draft keeps the cell in editing with its error; with `revert` editing ends', () => {
		const { editing, commits } = setup();

		editing.start({ key: 'a', column: 'name' });
		editing.setDraft('  ');

		expect(editing.cell.value?.error).toBe('A name is required');
		expect(editing.commit()).toBe(false);
		expect(editing.cell.value).not.toBeNull();

		const reverting = setup({ invalid: 'revert' });

		reverting.editing.start({ key: 'a', column: 'name' });
		reverting.editing.setDraft('');

		expect(reverting.editing.commit()).toBe(false);
		expect(reverting.editing.cell.value).toBeNull();
		expect(commits).toEqual([]);
	});

	it('starting another cell over an invalid draft: refused under `block`, the draft dropped under `revert`', () => {
		const blocking = setup();

		blocking.editing.start({ key: 'a', column: 'name' });
		blocking.editing.setDraft('');

		expect(blocking.editing.start({ key: 'b', column: 'name' })).toBe(false);
		expect(blocking.editing.cell.value?.key).toBe('a');

		const reverting = setup({ invalid: 'revert' });

		reverting.editing.start({ key: 'a', column: 'name' });
		reverting.editing.setDraft('');

		expect(reverting.editing.start({ key: 'b', column: 'name' })).toBe(true);
		expect(reverting.editing.cell.value?.key).toBe('b');
		expect(reverting.commits).toEqual([]);
	});

	it('`cancel` ends editing without a write, and an unchanged draft commits nothing', () => {
		const { editing, commits } = setup();

		editing.start({ key: 'a', column: 'name' });
		editing.setDraft('Apex');
		editing.cancel();
		editing.start({ key: 'a', column: 'name' });
		editing.commit();

		expect(commits).toEqual([]);
	});

	it('starting another cell commits the one being edited', () => {
		const { editing, rows } = setup();

		editing.start({ key: 'a', column: 'name' });
		editing.setDraft('Apex');
		editing.start({ key: 'c', column: 'name' });

		expect(rows.value[0].name).toBe('Apex');
		expect(editing.cell.value?.key).toBe('c');
	});

	it('editing ends once its row is gone', () => {
		const { editing, rows } = setup();

		editing.start({ key: 'c', column: 'name' });
		rows.value = rows.value.slice(0, 2);

		expect(editing.cell.value).toBeNull();
		expect(editing.isEditing({ key: 'c', column: 'name' })).toBe(false);
	});

	it('`isEditing` wakes only the rows editing enters and leaves', () => {
		const { editing } = setup();
		const runs = { a: 0, c: 0 };

		for (const key of ['a', 'c'] as const) {
			watchEffect(() => {
				editing.getEditingColumn(key);
				runs[key] += 1;
			}, { flush: 'sync' });
		}

		editing.start({ key: 'a', column: 'name' });
		editing.setDraft('Apex');
		editing.cancel();

		expect(runs).toEqual({ a: 3, c: 1 });
	});
});

describe('useCellEditing — writes', () => {
	it('writes many cells as one commit; a row with several edits gets them all', () => {
		const { editing, rows, commits } = setup();

		const result = editing.write([
			{ key: 'a', column: 'name', value: 'Apex' },
			{ key: 'a', column: 'price', value: 10 },
			{ key: 'c', column: 'price', value: 30 },
		], 'paste');

		expect(result.commit?.edits).toHaveLength(3);
		expect(rows.value[0]).toMatchObject({ name: 'Apex', price: 10 });
		expect(rows.value[2].price).toBe(30);
		expect(commits).toHaveLength(1);
	});

	it('cells that cannot be edited are skipped, invalid values are left out with their errors', () => {
		const { editing } = setup();

		const result = editing.write([
			{ key: 'b', column: 'price', value: 5 },
			{ key: 'a', column: 'id', value: 'z' },
			{ key: 'a', column: 'price', value: Number.NaN },
			{ key: 'c', column: 'price', value: 4 },
		], 'paste');

		expect(result.skipped.map(write => `${write.key}:${write.column}`)).toEqual(['b:price', 'a:id']);
		expect(result.invalid).toEqual([{ write: { key: 'a', column: 'price', value: Number.NaN }, error: 'Not a number' }]);
		expect(result.commit?.edits.map(edit => edit.key)).toEqual(['c']);
	});

	it('`writeText` goes through the column\'s `parse`', () => {
		const { editing, rows } = setup();

		editing.writeText([{ key: 'a', column: 'price', text: '12.5' }, { key: 'a', column: 'name', text: 'Apex' }], 'paste');

		expect(rows.value[0]).toMatchObject({ price: 12.5, name: 'Apex' });
	});

	it('a write with `expected` skips a cell that changed since', () => {
		const { editing, rows } = setup();

		rows.value = [{ ...rows.value[0], price: 99 }, ...rows.value.slice(1)];

		const result = editing.write([{ key: 'a', column: 'price', value: 1, expected: 5 }], 'undo');

		expect(result.commit).toBeNull();
		expect(result.skipped).toHaveLength(1);
		expect(rows.value[0].price).toBe(99);
	});

	it('`onBeforeCommit` sees the edits and their source, and can change them or refuse them all', () => {
		const onBeforeCommit = vi.fn((request: CellCommitRequest<Row>) => request.edits.map(edit => ({ ...edit, after: String(edit.after).toUpperCase() })));
		const { editing, rows } = setup({ onBeforeCommit });

		editing.write([{ key: 'a', column: 'name', value: 'apex' }], 'paste');

		expect(onBeforeCommit).toHaveBeenCalledWith({ edits: [expect.objectContaining({ after: 'apex' })], source: 'paste' });
		expect(rows.value[0].name).toBe('APEX');

		const refusing = setup({ onBeforeCommit: () => false });

		expect(refusing.editing.write([{ key: 'a', column: 'name', value: 'x' }], 'edit').commit).toBeNull();
		expect(refusing.rows.value[0].name).toBe('Alpha');
	});

	it('`apply` replaces the changed rows in any array holding them, and leaves others as they are', () => {
		const { editing } = setup();
		const other = [initial[1]];
		const { commit } = editing.write([{ key: 'a', column: 'name', value: 'Apex' }], 'edit');

		expect(commit?.apply(other)).toBe(other);
		expect(commit?.rows.get('a')).toMatchObject({ name: 'Apex' });
		expect(editing.lastCommit.value).toBe(commit);
	});
});


describe('useCellEditing — what a commit holds', () => {
	it('`after` is the value the new row holds, so a `setValue` that trims is seen', () => {
		const { editing } = setup();
		const { commit } = editing.write([{ key: 'a', column: 'title', value: ' Omega ' }], 'edit');

		expect(commit?.edits[0]).toMatchObject({ before: '', after: 'Omega' });
	});

	it('an edit that `setValue` turns back into the old value commits nothing', () => {
		const { editing, commits } = setup();

		expect(editing.write([{ key: 'a', column: 'title', value: '   ' }], 'edit').commit).toBeNull();
		expect(commits).toEqual([]);
	});

	it('a cell written twice in one write takes the last value, once', () => {
		const { editing } = setup();
		const { commit } = editing.write([
			{ key: 'a', column: 'name', value: 'First' },
			{ key: 'c', column: 'name', value: 'Other' },
			{ key: 'a', column: 'name', value: 'Last' },
		], 'clear');

		expect(commit?.edits.map(edit => `${edit.key}:${edit.after}`)).toEqual(['a:Last', 'c:Other']);
	});

	it('edits `onBeforeCommit` returns for a cell that cannot be edited are skipped, not written', () => {
		const foreign = [
			{ key: 'a', column: 'missing', row: initial[0], before: 1, after: 2 },
			{ key: 'b', column: 'price', row: initial[1], before: 2, after: 5 },
			{ key: 'x', column: 'name', row: initial[0], before: 'Alpha', after: 'Ghost' },
		] satisfies CellEdit<Row>[];
		const { editing, rows } = setup({ onBeforeCommit: ({ edits }) => [...edits, ...foreign] });
		const result = editing.write([{ key: 'c', column: 'name', value: 'Gem' }], 'paste');

		expect(result.commit?.edits.map(edit => `${edit.key}:${edit.column}`)).toEqual(['c:name']);
		expect(result.skipped.map(write => `${write.key}:${write.column}`)).toEqual(['a:missing', 'b:price', 'x:name']);
		expect(rows.value[1].price).toBe(2);
	});

	it('`onWrite` hears every write, with what it skipped and refused', () => {
		const results: CellWriteResult<Row>[] = [];
		const { editing } = setup({ onWrite: result => results.push(result) });

		editing.write([{ key: 'b', column: 'price', value: 5 }, { key: 'a', column: 'price', value: Number.NaN }], 'paste');

		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ source: 'paste', commit: null });
		expect(results[0].skipped).toHaveLength(1);
		expect(results[0].invalid).toHaveLength(1);
	});
});

describe('useCellEditing — sessions and the table', () => {
	it('starting the cell being edited again starts from the value its commit wrote', () => {
		const { editing } = setup();

		editing.start({ key: 'a', column: 'name' });
		editing.setDraft('Apex');

		expect(editing.start({ key: 'a', column: 'name' })).toBe(true);
		expect(editing.cell.value).toMatchObject({ value: 'Apex', draft: 'Apex' });
	});

	it('editing ends when its column is hidden, and holds when columns move', async () => {
		const { editing, scope } = setup();

		editing.start({ key: 'a', column: 'name' });
		scope.moveColumnTo('name', 2);
		await nextTick();

		expect(editing.cell.value).toMatchObject({ key: 'a', column: 'name' });

		scope.toggleColumn('name');
		await nextTick();

		expect(editing.cell.value).toBeNull();
	});

	it('`cell` stays the same object while nothing of it changes', () => {
		const { editing, rows } = setup();

		editing.start({ key: 'a', column: 'name' });

		const before = editing.cell.value;

		rows.value = [...rows.value.slice(0, 2), { ...rows.value[2], price: 42 }];

		expect(editing.cell.value).toBe(before);
	});

	it('`findEditable` goes along the rows to the next cell that can be edited, as Tab does', () => {
		const { editing } = setup();
		const grid = { keys: ['a', 'b', 'c'], columns: ['name', 'price'] };

		expect(editing.findEditable({ key: 'a', column: 'price' }, 1, grid)).toEqual({ key: 'b', column: 'name' });
		expect(editing.findEditable({ key: 'b', column: 'name' }, 1, grid)).toEqual({ key: 'c', column: 'name' });
		expect(editing.findEditable({ key: 'c', column: 'name' }, -1, grid)).toEqual({ key: 'b', column: 'name' });
		expect(editing.findEditable({ key: 'c', column: 'price' }, 1, grid)).toBeNull();
	});

	it('warns once in development when text goes into a column of other values without `parse`', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const { editing, rows } = setup();

		editing.writeText([{ key: 'a', column: 'stock', text: '5' }], 'paste');
		editing.writeText([{ key: 'c', column: 'stock', text: '6' }], 'paste');

		expect(rows.value[0].stock).toBe('5');
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('Column "stock" has no `parse`');
		warn.mockRestore();
	});
});
