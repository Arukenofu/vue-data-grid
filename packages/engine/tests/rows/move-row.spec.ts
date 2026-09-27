import { describe, expect, it } from 'vitest';

import { moveRow } from '../../src/rows/move-row';

interface Row {
	id: string;
	parent?: string | null;
}

const flat: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

const ids = (rows: readonly Row[]) => rows.map(row => row.id);

describe('moveRow — flat rows', () => {
	it('puts the row at its index among the others once it is taken out', () => {
		expect(ids(moveRow(flat, { key: 'a', row: flat[0], parent: null, index: 2 }, { rowKey: 'id' }))).toEqual(['b', 'c', 'a', 'd']);
		expect(ids(moveRow(flat, { key: 'd', row: flat[3], parent: null, index: 0 }, { rowKey: 'id' }))).toEqual(['d', 'a', 'b', 'c']);
	});

	it('puts the row last for an index past the end', () => {
		expect(ids(moveRow(flat, { key: 'b', row: flat[1], parent: null, index: 3 }, { rowKey: 'id' }))).toEqual(['a', 'c', 'd', 'b']);
	});

	it('inserts a row from elsewhere, and keeps the references of the rest', () => {
		const incoming = { id: 'x' };
		const result = moveRow(flat, { key: 'x', row: incoming, parent: null, index: 1 }, { rowKey: 'id' });

		expect(ids(result)).toEqual(['a', 'x', 'b', 'c', 'd']);
		expect(result[1]).toBe(incoming);
		expect(result[0]).toBe(flat[0]);
		expect(flat).toHaveLength(4);
	});
});

describe('moveRow — rows of a tree', () => {
	const tree: Row[] = [
		{ id: 'folder', parent: null },
		{ id: 'one', parent: 'folder' },
		{ id: 'two', parent: 'folder' },
		{ id: 'top', parent: null },
	];

	it('moves among the children of the parent, before the sibling that stands there', () => {
		const result = moveRow(tree, { key: 'two', row: tree[2], parent: 'folder', index: 0 }, { rowKey: 'id', parentKey: 'parent' });

		expect(ids(result)).toEqual(['folder', 'two', 'one', 'top']);
		// The parent did not change: the row keeps its object.
		expect(result[1]).toBe(tree[2]);
	});

	it('writes the new parent into the moved row only', () => {
		const result = moveRow(tree, { key: 'top', row: tree[3], parent: 'folder', index: 2 }, { rowKey: 'id', parentKey: 'parent' });

		expect(ids(result)).toEqual(['folder', 'one', 'two', 'top']);
		expect(result[3]).toEqual({ id: 'top', parent: 'folder' });
		expect(tree[3].parent).toBeNull();
	});

	it('moves a child to the top level', () => {
		const result = moveRow(tree, { key: 'one', row: tree[1], parent: null, index: 0 }, { rowKey: 'id', parentKey: 'parent' });

		expect(ids(result)).toEqual(['one', 'folder', 'two', 'top']);
		expect(result[0].parent).toBeNull();
	});

	it('puts the first child of an empty parent at the end', () => {
		const result = moveRow(tree, { key: 'one', row: tree[1], parent: 'top', index: 0 }, { rowKey: 'id', parentKey: 'parent' });

		expect(ids(result)).toEqual(['folder', 'two', 'top', 'one']);
		expect(result[3].parent).toBe('top');
	});
});
