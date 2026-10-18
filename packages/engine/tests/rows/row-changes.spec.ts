import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { applyRowChanges, type RowChange, type RowChangeOptions } from '../../src/rows/row-changes';

interface Row {
	id: string;
	name?: string;
	parent?: string | null;
}

interface Node {
	id: string;
	name?: string;
	children?: Node[];
}

const ids = (rows: readonly { id: string }[]) => rows.map(row => row.id);

/** Applies changes, then their undo to the result, and returns both. */
function roundTrip<TRow>(rows: readonly TRow[], changes: readonly RowChange<TRow>[], options: RowChangeOptions<TRow>) {
	const done = applyRowChanges(rows, changes, options);
	const undone = applyRowChanges(done.rows, done.undo, options);

	return { done, undone };
}

describe('applyRowChanges — flat rows', () => {
	const flat: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
	const options: RowChangeOptions<Row> = { rowKey: 'id' };

	it('moves a row to its index among the others once it is taken out, as a drop says', () => {
		expect(ids(applyRowChanges(flat, [{ type: 'move', key: 'a', parent: null, index: 2 }], options).rows)).toEqual(['b', 'c', 'a', 'd']);
		expect(ids(applyRowChanges(flat, [{ type: 'move', key: 'd', parent: null, index: 0 }], options).rows)).toEqual(['d', 'a', 'b', 'c']);
	});

	it('puts a row last for an index past the end, or without one', () => {
		expect(ids(applyRowChanges(flat, [{ type: 'move', key: 'b', index: 3 }], options).rows)).toEqual(['a', 'c', 'd', 'b']);
		expect(ids(applyRowChanges(flat, [{ type: 'move', key: 'b' }], options).rows)).toEqual(['a', 'c', 'd', 'b']);
	});

	it('takes a drop event as it is, with the fields a move does not read', () => {
		const event = { key: 'c', row: flat[2], parent: null, index: 0, external: false, source: null };
		const result = applyRowChanges(flat, [{ type: 'move', ...event }], options);

		expect(ids(result.rows)).toEqual(['c', 'a', 'b', 'd']);
		expect(result.rows[0]).toBe(flat[2]);
	});

	it('skips a move of a key no row has', () => {
		const result = applyRowChanges(flat, [{ type: 'move', key: 'x', row: { id: 'x' }, parent: null, index: 1 }], options);

		expect(result.rows).toBe(flat);
		expect(result.skipped).toHaveLength(1);
	});

	it('puts the given row at the place of a move, and keeps the references of the rest', () => {
		const moved = { id: 'b', name: 'B' };
		const result = applyRowChanges(flat, [{ type: 'move', key: 'b', row: moved, index: 3 }], options);

		expect(ids(result.rows)).toEqual(['a', 'c', 'd', 'b']);
		expect(result.rows[3]).toBe(moved);
		expect(result.rows[0]).toBe(flat[0]);
		expect(applyRowChanges(result.rows, result.undo, options).rows).toEqual(flat);
	});

	it('skips a move of a row that is not the expected one', () => {
		const result = applyRowChanges(flat, [{ type: 'move', key: 'b', index: 3, expected: { id: 'b' } }], options);

		expect(result.rows).toBe(flat);
		expect(result.skipped).toHaveLength(1);
	});

	it('adds a row last, at an index, or next to a row', () => {
		const added = { id: 'x' };

		expect(ids(applyRowChanges(flat, [{ type: 'add', row: added }], options).rows)).toEqual(['a', 'b', 'c', 'd', 'x']);
		expect(ids(applyRowChanges(flat, [{ type: 'add', row: added, index: 0 }], options).rows)).toEqual(['x', 'a', 'b', 'c', 'd']);
		expect(ids(applyRowChanges(flat, [{ type: 'add', row: added, before: 'c' }], options).rows)).toEqual(['a', 'b', 'x', 'c', 'd']);
		expect(ids(applyRowChanges(flat, [{ type: 'add', row: added, after: 'd' }], options).rows)).toEqual(['a', 'b', 'c', 'd', 'x']);
	});

	it('moves a row next to another one', () => {
		expect(ids(applyRowChanges(flat, [{ type: 'move', key: 'a', after: 'c' }], options).rows)).toEqual(['b', 'c', 'a', 'd']);
		expect(ids(applyRowChanges(flat, [{ type: 'move', key: 'd', before: 'a' }], options).rows)).toEqual(['d', 'a', 'b', 'c']);
	});

	it('skips an add of a known key, and replaces that row in place with `existing: \'replace\'`', () => {
		const replaced = { id: 'b', name: 'B' };
		const skipped = applyRowChanges(flat, [{ type: 'add', row: replaced, after: 'd' }], options);

		expect(skipped.rows).toBe(flat);
		expect(skipped.skipped).toHaveLength(1);

		const result = applyRowChanges(flat, [{ type: 'add', row: replaced, after: 'd', existing: 'replace' }], options);

		expect(result.rows).toEqual([flat[0], replaced, flat[2], flat[3]]);
		expect(applyRowChanges(result.rows, result.undo, options).rows).toEqual(flat);
	});

	it('takes a neighbour that is `null` as none, and `before` over `after`', () => {
		const added = { id: 'x' };
		const focused: string | null = null;

		expect(ids(applyRowChanges(flat, [{ type: 'add', row: added, after: focused, index: 1 }], options).rows))
			.toEqual(['a', 'x', 'b', 'c', 'd']);
		expect(ids(applyRowChanges(flat, [{ type: 'add', row: added, before: 'b', after: 'c' }], options).rows))
			.toEqual(['a', 'x', 'b', 'c', 'd']);
	});

	it('types a place with neighbours that may be `null`', () => {
		const focused = 'b' as string | null;

		expectTypeOf(applyRowChanges(flat, [{ type: 'add', row: { id: 'x' }, after: focused }], options).rows).toEqualTypeOf<readonly Row[]>();
		// @ts-expect-error: a neighbour is a key, not an index
		applyRowChanges(flat, [{ type: 'add', row: { id: 'x' }, after: 1 }], options);
		// @ts-expect-error: `existing` is `'skip'` or `'replace'`
		applyRowChanges(flat, [{ type: 'add', row: { id: 'x' }, existing: 'merge' }], options);
	});

	it('updates and removes rows by key; every other row stays the same object', () => {
		const updated = { id: 'b', name: 'B' };
		const result = applyRowChanges(flat, [{ type: 'update', row: updated }, { type: 'remove', key: 'c' }], options);

		expect(result.rows).toEqual([flat[0], updated, flat[3]]);
		expect(result.rows[0]).toBe(flat[0]);
		expect(result.rows[2]).toBe(flat[3]);
		expect(result.applied).toHaveLength(2);
	});

	it('returns the same array when nothing changed', () => {
		expect(applyRowChanges(flat, [], options).rows).toBe(flat);
		expect(applyRowChanges(flat, [{ type: 'update', row: flat[1] }], options).rows).toBe(flat);
		expect(applyRowChanges(flat, [{ type: 'move', key: 'b', index: 1 }], options).rows).toBe(flat);
	});

	it('applies changes in order, each on the rows the ones before it left', () => {
		const added = { id: 'x' };
		const result = applyRowChanges(flat, [
			{ type: 'add', row: added },
			{ type: 'move', key: 'x', index: 0 },
			{ type: 'remove', key: 'a' },
		], options);

		expect(ids(result.rows)).toEqual(['x', 'b', 'c', 'd']);
	});

	it('skips unknown keys and neighbours, a neighbour that is the row itself, and failed guards', () => {
		const changes: RowChange<Row>[] = [
			{ type: 'update', row: { id: 'x' } },
			{ type: 'remove', key: 'x' },
			{ type: 'move', key: 'x' },
			{ type: 'add', row: { id: 'y' }, before: 'x' },
			{ type: 'move', key: 'a', after: 'a' },
			{ type: 'update', row: { id: 'a', name: 'A' }, expected: { id: 'a' } },
			{ type: 'remove', key: 'a', expected: flat[1] },
			{ type: 'move', key: 'a', from: 'folder', index: 2 },
		];
		const result = applyRowChanges(flat, changes, options);

		expect(result.rows).toBe(flat);
		expect(result.applied).toEqual([]);
		expect(result.skipped).toEqual(changes);
		expect(result.undo).toEqual([]);
	});

	it('applies a guarded change while the row is the one expected', () => {
		const updated = { id: 'a', name: 'A' };
		const result = applyRowChanges(flat, [{ type: 'update', row: updated, expected: flat[0] }], options);

		expect(result.rows[0]).toBe(updated);
	});

	it('undoes changes with the changes it returns', () => {
		const changes: RowChange<Row>[] = [
			{ type: 'add', row: { id: 'x' }, index: 1 },
			{ type: 'update', row: { id: 'c', name: 'C' } },
			{ type: 'move', key: 'a', index: 3 },
			{ type: 'remove', key: 'b' },
		];
		const { done, undone } = roundTrip(flat, changes, options);

		expect(ids(done.rows)).toEqual(['x', 'c', 'a', 'd']);
		expect(undone.rows).toEqual(flat);
		expect(undone.skipped).toEqual([]);
		undone.rows.forEach((row, index) => expect(row).toBe(flat[index]));
	});

	it('removes several rows in one batch, and the undo puts each back at its place', () => {
		const { done, undone } = roundTrip(flat, [
			{ type: 'remove', key: 'b' },
			{ type: 'update', row: { id: 'c', name: 'C' } },
			{ type: 'remove', key: 'd' },
			{ type: 'remove', key: 'a' },
			{ type: 'add', row: { id: 'x' } },
		], options);

		expect(done.rows).toEqual([{ id: 'c', name: 'C' }, { id: 'x' }]);
		expect(undone.rows).toEqual(flat);
		undone.rows.forEach((row, index) => expect(row).toBe(flat[index]));
	});

	it('skips an undo step once its row changed again', () => {
		const done = applyRowChanges(flat, [{ type: 'update', row: { id: 'a', name: 'A' } }], options);
		const later = applyRowChanges(done.rows, [{ type: 'update', row: { id: 'a', name: 'Later' } }], options);
		const undone = applyRowChanges(later.rows, done.undo, options);

		expect(undone.rows).toBe(later.rows);
		expect(undone.skipped).toEqual(done.undo);
	});
});

describe('applyRowChanges — rows with parent keys', () => {
	const rows: Row[] = [
		{ id: 'folder', parent: null },
		{ id: 'one', parent: 'folder' },
		{ id: 'two', parent: 'folder' },
		{ id: 'top', parent: null },
	];
	const options: RowChangeOptions<Row> = { rowKey: 'id', parentKey: 'parent' };

	it('moves among the children of the parent, before the sibling that stands there', () => {
		const result = applyRowChanges(rows, [{ type: 'move', key: 'two', parent: 'folder', index: 0 }], options);

		expect(ids(result.rows)).toEqual(['folder', 'two', 'one', 'top']);
		// The parent did not change: the row keeps its object.
		expect(result.rows[1]).toBe(rows[2]);
	});

	it('writes the new parent into the moved row only', () => {
		const result = applyRowChanges(rows, [{ type: 'move', key: 'top', parent: 'folder', index: 2 }], options);

		expect(ids(result.rows)).toEqual(['folder', 'one', 'two', 'top']);
		expect(result.rows[3]).toEqual({ id: 'top', parent: 'folder' });
		expect(rows[3].parent).toBeNull();
		expect(result.rows[0]).toBe(rows[0]);
	});

	it('moves a child to the top level', () => {
		const result = applyRowChanges(rows, [{ type: 'move', key: 'one', parent: null, index: 0 }], options);

		expect(ids(result.rows)).toEqual(['one', 'folder', 'two', 'top']);
		expect(result.rows[0].parent).toBeNull();
	});

	it('puts the first child of an empty parent right after it', () => {
		const result = applyRowChanges(rows, [{ type: 'move', key: 'one', parent: 'top', index: 0 }], options);

		expect(ids(result.rows)).toEqual(['folder', 'two', 'top', 'one']);
		expect(result.rows[3].parent).toBe('top');
		expect(ids(applyRowChanges(rows, [{ type: 'move', key: 'top', parent: 'two' }], options).rows)).toEqual(['folder', 'one', 'two', 'top']);
	});

	it('puts a row after the last sibling and the rows under it', () => {
		const result = applyRowChanges(rows.slice(0, 3), [{ type: 'add', row: { id: 'x', parent: null }, parent: null, index: 1 }], options);

		expect(ids(result.rows)).toEqual(['folder', 'one', 'two', 'x']);
	});

	it('keeps the parent a row has when a place leaves it out', () => {
		const result = applyRowChanges(rows, [{ type: 'move', key: 'two', index: 0 }], options);

		expect(ids(result.rows)).toEqual(['folder', 'two', 'one', 'top']);
	});

	it('puts a row next to another one under that one’s parent', () => {
		const result = applyRowChanges(rows, [{ type: 'move', key: 'top', before: 'two' }], options);

		expect(ids(result.rows)).toEqual(['folder', 'one', 'top', 'two']);
		expect(result.rows[2].parent).toBe('folder');
	});

	it('adds a row under a parent, and a row without a place under the parent it names', () => {
		const result = applyRowChanges(rows, [
			{ type: 'add', row: { id: 'x' }, parent: 'folder', index: 0 },
			{ type: 'add', row: { id: 'y', parent: 'folder' } },
		], options);

		expect(ids(result.rows)).toEqual(['folder', 'x', 'one', 'two', 'top', 'y']);
		expect(result.rows[1]).toEqual({ id: 'x', parent: 'folder' });
	});

	it('takes a parent no row has as a value like any other, for rows split into lists by a field', () => {
		const board: Row[] = [{ id: 'a', parent: 'todo' }, { id: 'b', parent: 'done' }, { id: 'c', parent: 'todo' }];
		const result = applyRowChanges(board, [{ type: 'move', key: 'b', parent: 'todo', index: 1 }], options);

		expect(ids(result.rows)).toEqual(['a', 'b', 'c']);
		expect(result.rows[1]).toEqual({ id: 'b', parent: 'todo' });
		expect(ids(applyRowChanges(board, [{ type: 'move', key: 'a', parent: 'later', index: 0 }], options).rows)).toEqual(['b', 'c', 'a']);
	});

	it('skips a move into the row itself or its subtree', () => {
		const changes: RowChange<Row>[] = [
			{ type: 'move', key: 'folder', parent: 'folder', index: 0 },
			{ type: 'move', key: 'folder', parent: 'one', index: 0 },
			{ type: 'move', key: 'folder', before: 'one' },
		];
		const result = applyRowChanges(rows, changes, options);

		expect(result.rows).toBe(rows);
		expect(result.skipped).toEqual(changes);
	});

	it('moves only while the row is under `from`', () => {
		expect(applyRowChanges(rows, [{ type: 'move', key: 'one', from: 'top', parent: null }], options).skipped).toHaveLength(1);
		expect(ids(applyRowChanges(rows, [{ type: 'move', key: 'one', from: 'folder', parent: null }], options).rows))
			.toEqual(['folder', 'two', 'top', 'one']);
	});

	it('removes a row with the rows under it, and puts them back on undo', () => {
		const nested: Row[] = [...rows.slice(0, 3), { id: 'deep', parent: 'two' }, rows[3]];
		const { done, undone } = roundTrip(nested, [{ type: 'remove', key: 'folder' }], options);

		expect(ids(done.rows)).toEqual(['top']);
		expect(undone.skipped).toEqual([]);
		expect(undone.rows).toEqual(nested);
		undone.rows.forEach((row, index) => expect(row).toBe(nested[index]));
	});

	it('removes rows whose parents form a cycle once each', () => {
		const cycle: Row[] = [{ id: 'p', parent: 'q' }, { id: 'q', parent: 'p' }, { id: 'top', parent: null }];
		const result = applyRowChanges(cycle, [{ type: 'remove', key: 'p' }, { type: 'move', key: 'top', index: 0 }], options);

		expect(ids(result.rows)).toEqual(['top']);
	});

	it('undoes a move with the row as it was, its parent included', () => {
		const { done, undone } = roundTrip(rows, [{ type: 'move', key: 'top', parent: 'folder', index: 0 }], options);

		expect(done.rows[1]).toEqual({ id: 'top', parent: 'folder' });
		expect(undone.rows).toEqual(rows);
		expect(undone.rows[3]).toBe(rows[3]);
	});

	it('gives a row a new parent through `setParent`, which a function `parentKey` needs', () => {
		const result = applyRowChanges(rows, [{ type: 'move', key: 'top', parent: 'folder' }], {
			rowKey: 'id',
			parentKey: row => row.parent,
			setParent: (row, parent) => ({ ...row, parent, name: 'moved' }),
		});

		expect(result.rows[3]).toEqual({ id: 'top', parent: 'folder', name: 'moved' });
		expect(() => applyRowChanges(rows, [{ type: 'move', key: 'top', parent: 'folder' }], { rowKey: 'id', parentKey: row => row.parent }))
			.toThrow('needs `setParent`');
	});
});

describe('applyRowChanges — a nested tree', () => {
	const docs: Node = { id: 'docs', children: [{ id: 'a' }, { id: 'b' }] };
	const pics: Node = { id: 'pics', children: [{ id: 'c' }] };
	const top: Node = { id: 'top' };
	const tree: Node[] = [docs, pics, top];
	const options: RowChangeOptions<Node> = { rowKey: 'id', childrenField: 'children' };

	it('copies only the rows above a changed row', () => {
		const updated = { id: 'b', name: 'B' };
		const result = applyRowChanges(tree, [{ type: 'update', row: updated }], options);

		expect(result.rows[0]).toEqual({ id: 'docs', children: [{ id: 'a' }, updated] });
		expect(result.rows[0]).not.toBe(docs);
		expect(result.rows[0].children?.[0]).toBe(docs.children?.[0]);
		expect(result.rows[1]).toBe(pics);
		expect(result.rows[2]).toBe(top);
		expect(docs.children?.[1]).toEqual({ id: 'b' });
	});

	it('moves a row from one parent to another at the index a drop says', () => {
		const result = applyRowChanges(tree, [{ type: 'move', key: 'a', parent: 'pics', index: 1 }], options);

		expect(result.rows).toEqual([
			{ id: 'docs', children: [{ id: 'b' }] },
			{ id: 'pics', children: [{ id: 'c' }, { id: 'a' }] },
			top,
		]);
		expect(result.rows[1].children?.[1]).toBe(docs.children?.[0]);
		expect(result.rows[2]).toBe(top);
	});

	it('moves a group with its subtree, and gives a leaf its first child', () => {
		const result = applyRowChanges(tree, [{ type: 'move', key: 'pics', parent: 'top' }], options);

		expect(result.rows).toEqual([docs, { id: 'top', children: [pics] }]);
		expect(result.rows[1].children?.[0]).toBe(pics);
	});

	it('adds a row with its children, and removes a row with its subtree', () => {
		const added: Node = { id: 'new', children: [{ id: 'inner' }] };
		const result = applyRowChanges(tree, [
			{ type: 'add', row: added, parent: 'docs', index: 0 },
			{ type: 'remove', key: 'pics' },
			{ type: 'move', key: 'b', parent: 'new' },
		], options);

		expect(result.rows).toEqual([
			{ id: 'docs', children: [{ id: 'new', children: [{ id: 'inner' }, { id: 'b' }] }, { id: 'a' }] },
			top,
		]);
	});

	it('keeps the children the tree has when an update gives others', () => {
		const result = applyRowChanges(tree, [{ type: 'update', row: { id: 'docs', name: 'Docs', children: [] } }], options);

		expect(result.rows[0]).toEqual({ id: 'docs', name: 'Docs', children: docs.children });
		expect(result.rows[0].children?.[1]).toBe(docs.children?.[1]);
	});

	it('compares an expected row apart from its children, which the changes rebuild', () => {
		const moved = applyRowChanges(tree, [{ type: 'move', key: 'c', parent: 'docs' }], options);
		const renamed = applyRowChanges(moved.rows, [{ type: 'update', row: { ...pics, name: 'Pics' }, expected: pics }], options);

		expect(renamed.applied).toHaveLength(1);
		expect(renamed.rows[1]).toEqual({ id: 'pics', name: 'Pics', children: [] });
	});

	it('skips a move into the row’s own subtree, and under a parent no row has', () => {
		const changes: RowChange<Node>[] = [
			{ type: 'move', key: 'docs', parent: 'a' },
			{ type: 'move', key: 'top', parent: 'gone' },
			{ type: 'add', row: { id: 'x' }, parent: 'gone' },
		];
		const result = applyRowChanges(tree, changes, options);

		expect(result.rows).toBe(tree);
		expect(result.skipped).toEqual(changes);
	});

	it('undoes a batch of changes back to the same tree', () => {
		const { done, undone } = roundTrip(tree, [
			{ type: 'add', row: { id: 'x' }, parent: 'top' },
			{ type: 'move', key: 'a', parent: 'x' },
			{ type: 'update', row: { id: 'c', name: 'C' } },
			{ type: 'remove', key: 'docs' },
		], options);

		expect(done.rows).toEqual([
			{ id: 'pics', children: [{ id: 'c', name: 'C' }] },
			{ id: 'top', children: [{ id: 'x', children: [{ id: 'a' }] }] },
		]);
		expect(undone.skipped).toEqual([]);
		expect(undone.rows).toEqual(tree);
		// The leaf that got a child is a leaf again, without an empty children array.
		expect(undone.rows[2]).toBe(top);
	});
});

describe('applyRowChanges — undo in trees and edge cases', () => {
	const options: RowChangeOptions<Row> = { rowKey: 'id', parentKey: 'parent' };
	const nested: RowChangeOptions<Node> = { rowKey: 'id', childrenField: 'children' };

	it('skips the undo of an add once rows came under the added row, and loses none of them', () => {
		const rows: Row[] = [{ id: 'a', parent: null }, { id: 'b', parent: 'a' }];
		const done = applyRowChanges(rows, [{ type: 'update', row: { id: 'a', parent: 'g' } }, { type: 'add', row: { id: 'g', parent: null } }], options);
		const undone = applyRowChanges(done.rows, done.undo, options);

		expect(ids(undone.rows)).toEqual(expect.arrayContaining(['a', 'b', 'g']));
		expect(undone.rows).toHaveLength(3);
		expect(undone.rows.find(row => row.id === 'a')?.parent).toBeNull();
		expect(undone.skipped).toEqual([expect.objectContaining({ type: 'remove', key: 'g' })]);
	});

	it('skips the undo of an add once another commit put a row under it', () => {
		const rows: Row[] = [{ id: 'a', parent: null }];
		const added = applyRowChanges(rows, [{ type: 'add', row: { id: 'g', parent: null } }], options);
		const moved = applyRowChanges(added.rows, [{ type: 'move', key: 'a', parent: 'g' }], options);
		const undone = applyRowChanges(moved.rows, added.undo, options);

		expect(undone.rows).toBe(moved.rows);
		expect(undone.skipped).toHaveLength(1);
	});

	it('removes an added nested row with the children it brought, and skips it once others came under it', () => {
		const tree: Node[] = [{ id: 'x' }];
		const added = applyRowChanges(tree, [{ type: 'add', row: { id: 'g', children: [{ id: 'h' }] } }], nested);

		expect(applyRowChanges(added.rows, added.undo, nested).rows).toEqual(tree);

		const moved = applyRowChanges(added.rows, [{ type: 'move', key: 'x', parent: 'h' }], nested);

		expect(applyRowChanges(moved.rows, added.undo, nested).rows).toBe(moved.rows);
	});

	it('undoes an update that gives a row another parent as a move back to its place among its siblings', () => {
		const rows: Row[] = [
			{ id: 'p', parent: null },
			{ id: 'w', parent: 'p' },
			{ id: 'x', parent: 'p' },
			{ id: 'y', parent: 'p' },
		];
		const { done, undone } = roundTrip(rows, [{ type: 'update', row: { id: 'x', parent: null } }, { type: 'remove', key: 'y' }], options);

		expect(done.undo.at(-1)).toMatchObject({ type: 'move', key: 'x', row: rows[2], parent: 'p', index: 1 });
		expect(undone.rows).toEqual(rows);
		expect(undone.rows[2]).toBe(rows[2]);
	});

	it('puts back a removed row that names itself as it was', () => {
		const rows: Row[] = [{ id: 'a', parent: 'a' }, { id: 'b', parent: null }];
		const { undone } = roundTrip(rows, [{ type: 'remove', key: 'a' }], options);

		expect(undone.rows[0]).toBe(rows[0]);
	});

	it('counts a row whose parent is not a row among the top level, where the tree shows it', () => {
		const rows: Row[] = [{ id: 'o', parent: 'gone' }, { id: 'a', parent: null }, { id: 'b', parent: null }];
		const { done, undone } = roundTrip(rows, [{ type: 'move', key: 'b', parent: null, index: 0 }], options);

		expect(ids(done.rows)).toEqual(['b', 'o', 'a']);
		expect(done.rows[1]).toBe(rows[0]);
		expect(undone.rows).toEqual(rows);

		const top = applyRowChanges(rows, [{ type: 'move', key: 'o', parent: null, index: 2 }], options);

		expect(ids(top.rows)).toEqual(['a', 'b', 'o']);
		// It stays at the top level as it is: its parent field is not written.
		expect(top.rows[2]).toBe(rows[0]);
	});

	it('warns once in development about rows that share a key a change names', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const rows: Row[] = [{ id: 'twin' }, { id: 'twin', name: 'second' }];

		applyRowChanges(rows, [{ type: 'remove', key: 'twin' }], { rowKey: 'id' });
		applyRowChanges(rows, [{ type: 'move', key: 'twin', index: 1 }], { rowKey: 'id' });

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('"twin"');
		warn.mockRestore();
	});
});
