import { describe, expect, it } from 'vitest';

import { createRowKeyResolver } from '../../src/rows/row-key';
import { type ChildrenField, createParentKeyResolver, getRowChildren } from '../../src/rows/row-tree';

interface Node {
	id: string;
	children?: Node[];
}

const FIELD = 'children' as ChildrenField<Node>;

const tree: Node[] = [
	{ id: 'a', children: [{ id: 'a1' }, { id: 'a2', children: [{ id: 'a2x' }] }] },
	{ id: 'b' },
];

describe('createRowKeyResolver', () => {
	it('a field name becomes a getter', () => {
		expect(createRowKeyResolver<Node>('id')({ id: 'a' })).toBe('a');
	});

	it('the field value is converted to a string', () => {
		expect(createRowKeyResolver<{ id: number }>('id')({ id: 7 })).toBe('7');
	});

	it('a function is returned as is', () => {
		const getKey = (row: Node) => `k:${row.id}`;

		expect(createRowKeyResolver<Node>(getKey)).toBe(getKey);
	});
});

describe('getRowChildren', () => {
	it('takes the array of children', () => {
		expect(getRowChildren(tree[0], FIELD)).toHaveLength(2);
	});

	it('without a children field gives `undefined`', () => {
		expect(getRowChildren(tree[0], undefined)).toBeUndefined();
	});

	it('a row without children gives `undefined`', () => {
		expect(getRowChildren<Node>({ id: 'x' }, FIELD)).toBeUndefined();
	});

	it('an empty children array is an array, not a missing value', () => {
		expect(getRowChildren({ id: 'x', children: [] }, FIELD)).toEqual([]);
	});

	it('a children field that is not an array does not pass', () => {
		expect(getRowChildren({ id: 'x', children: 'none' } as unknown as Node, FIELD)).toBeUndefined();
	});
});

describe('createParentKeyResolver', () => {
	interface Flat {
		id: number;
		parentId?: number | string | null;
	}

	it('a field becomes a getter of the parent key as a string', () => {
		expect(createParentKeyResolver<Flat>('parentId')({ id: 2, parentId: 1 })).toBe('1');
	});

	it('`null`, `undefined` and an empty string mean the top level', () => {
		const getParent = createParentKeyResolver<Flat>('parentId');

		expect([getParent({ id: 1 }), getParent({ id: 1, parentId: null }), getParent({ id: 1, parentId: '' })])
			.toEqual([null, null, null]);
	});

	it('a function works the same way', () => {
		expect(createParentKeyResolver<Flat>(row => (row.id > 1 ? 'root' : undefined))({ id: 1 })).toBeNull();
	});
});
