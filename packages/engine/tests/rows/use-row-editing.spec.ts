import { effectScope, shallowRef } from 'vue';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { RowChange } from '../../src/rows/row-changes';
import { type RowCommit, type RowEditingOptions, useRowEditing } from '../../src/rows/use-row-editing';

interface Task {
	id: string;
	name: string;
	parent?: string | null;
	children?: Task[];
}

const tasks: Task[] = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }];

function setup(options: Partial<RowEditingOptions<Task>> = {}, initial: Task[] = tasks) {
	const rows = shallowRef<readonly Task[]>(initial);
	const commits: RowCommit<Task>[] = [];
	const scope = effectScope();
	const editing = scope.run(() => useRowEditing<Task>({
		rows,
		rowKey: 'id',
		onCommit: (commit) => {
			commits.push(commit);
			rows.value = commit.apply(rows.value);
		},
		...options,
	}))!;

	return { rows, commits, editing };
}

const ids = (rows: readonly Task[]) => rows.map(row => row.id);

describe('useRowEditing', () => {
	it('writes changes as one commit with their source, the new rows and the undo', () => {
		const { rows, commits, editing } = setup();
		const result = editing.write([{ type: 'add', row: { id: 'x', name: 'New' }, after: 'a' }, { type: 'remove', key: 'c' }], 'add');

		expect(ids(rows.value)).toEqual(['a', 'x', 'b']);
		expect(commits).toHaveLength(1);
		expect(result.commit).toBe(commits[0]);
		expect(result.commit?.source).toBe('add');
		expect(result.commit?.changes).toHaveLength(2);
		expect(result.commit?.undo).toEqual([
			{ type: 'add', row: tasks[2], parent: null, index: 3 },
			{ type: 'remove', key: 'x', expected: { id: 'x', name: 'New' } },
		]);
		expect(editing.lastCommit.value).toBe(commits[0]);
	});

	it('commits nothing when no change applies, and says which were skipped', () => {
		const { commits, editing } = setup();
		const change: RowChange<Task> = { type: 'remove', key: 'missing' };
		const result = editing.write([change], 'remove');

		expect(result).toEqual({ source: 'remove', commit: null, skipped: [change] });
		expect(commits).toEqual([]);
		expect(editing.lastCommit.value).toBeNull();
	});

	it('commits nothing for changes that leave the rows as they are', () => {
		const { commits, editing } = setup();

		expect(editing.write([{ type: 'move', key: 'b', index: 1 }], 'move').commit).toBeNull();
		expect(commits).toEqual([]);
	});

	it('lets `onBeforeCommit` replace the changes or refuse them', () => {
		const onBeforeCommit = vi.fn((request: { changes: readonly RowChange<Task>[] }) => request.changes.filter(change => change.type !== 'remove'));
		const { rows, editing } = setup({ onBeforeCommit });

		editing.write([{ type: 'remove', key: 'a' }, { type: 'move', key: 'c', index: 0 }], 'drop');

		expect(onBeforeCommit).toHaveBeenCalledWith({ changes: [{ type: 'remove', key: 'a' }, { type: 'move', key: 'c', index: 0 }], source: 'drop' });
		expect(ids(rows.value)).toEqual(['c', 'a', 'b']);

		const refusing = setup({ onBeforeCommit: () => false });

		expect(refusing.editing.write([{ type: 'remove', key: 'a' }], 'remove').commit).toBeNull();
		expect(refusing.rows.value).toBe(tasks);
	});

	it('does not call `onBeforeCommit` when nothing applies', () => {
		const onBeforeCommit = vi.fn();
		const { editing } = setup({ onBeforeCommit });

		editing.write([{ type: 'remove', key: 'missing' }], 'remove');

		expect(onBeforeCommit).not.toHaveBeenCalled();
	});

	it('`apply` gives the rows of the commit for the array it was made from, and applies the changes to another', () => {
		const { editing } = setup({ onCommit: () => undefined });
		const commit = editing.write([{ type: 'move', key: 'a', index: 2 }], 'move').commit!;

		expect(commit.apply(tasks)).toBe(commit.rows);

		const streamed = [tasks[0], { id: 'b', name: 'Changed' }, tasks[2]];

		expect(commit.apply(streamed)).toEqual([streamed[1], tasks[2], tasks[0]]);
	});

	it('undoes a commit through a write of its undo', () => {
		const { rows, editing } = setup();
		const commit = editing.write([{ type: 'remove', key: 'b' }], 'remove').commit!;

		editing.write(commit.undo, 'undo');

		expect(rows.value).toEqual(tasks);
	});

	it('takes the tree from `parentKey` or a `childrenField` that may change', () => {
		const flat: Task[] = [{ id: 'folder', name: 'Folder', parent: null }, { id: 'file', name: 'File', parent: null }];
		const { rows, editing } = setup({ parentKey: 'parent' }, flat);

		editing.write([{ type: 'move', key: 'file', parent: 'folder' }], 'drop');

		expect(rows.value[1]).toEqual({ id: 'file', name: 'File', parent: 'folder' });

		const field = shallowRef<'children' | undefined>(undefined);
		const nested = setup({ childrenField: field }, [{ id: 'group', name: 'Group', children: [{ id: 'leaf', name: 'Leaf' }] }]);

		expect(nested.editing.write([{ type: 'remove', key: 'leaf' }], 'remove').commit).toBeNull();

		field.value = 'children';
		nested.editing.write([{ type: 'remove', key: 'leaf' }], 'remove');

		expect(nested.rows.value).toEqual([{ id: 'group', name: 'Group', children: [] }]);
	});

	it('types commits by the rows', () => {
		const { editing } = setup();

		expectTypeOf(editing.write).parameter(0).toEqualTypeOf<readonly RowChange<Task>[]>();
		expectTypeOf(editing.lastCommit.value).toEqualTypeOf<RowCommit<Task> | null>();
		// @ts-expect-error: a change of rows of another type does not fit
		editing.write([{ type: 'update', row: { other: 1 } }], 'add');
	});
});
