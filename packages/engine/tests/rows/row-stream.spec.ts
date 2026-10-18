import { describe, expect, it } from 'vitest';

import { applyRowChanges, type RowChange } from '../../src/rows/row-changes';
import { getQueuedChanges, indexRows, queueRowChanges, type RowQueue } from '../../src/rows/row-stream';

interface Row {
	id: string;
	price: number;
	children?: Row[];
}

const getKey = (row: Row) => row.id;

const rows: Row[] = [{ id: 'a', price: 1 }, { id: 'b', price: 2 }, { id: 'c', price: 3 }];

function queue(...batches: RowChange<Row>[][]) {
	const pending: RowQueue<Row> = [];

	for (const changes of batches) {
		queueRowChanges(pending, changes, getKey);
	}

	return pending;
}

function apply(...batches: RowChange<Row>[][]) {
	return applyRowChanges(rows, getQueuedChanges(queue(...batches)), { rowKey: 'id' }).rows;
}

describe('queueRowChanges', () => {
	it('merges updates, removals and adds without a place into one run by key', () => {
		const pending = queue(
			[{ type: 'update', row: { id: 'a', price: 10 } }, { type: 'add', row: { id: 'd', price: 4 } }],
			[{ type: 'update', row: { id: 'a', price: 11 } }, { type: 'remove', key: 'b' }],
		);

		expect(pending).toHaveLength(1);
		expect(getQueuedChanges(pending)).toEqual([
			{ type: 'update', row: { id: 'a', price: 11 } },
			{ type: 'add', row: { id: 'd', price: 4 } },
			{ type: 'remove', key: 'b' },
		]);
	});

	it('keeps a move, an add at a place and a guarded change in order, and starts a new run after them', () => {
		const pending = queue([
			{ type: 'update', row: { id: 'a', price: 10 } },
			{ type: 'move', key: 'a', index: 2 },
			{ type: 'update', row: { id: 'a', price: 11 } },
			{ type: 'add', row: { id: 'd', price: 4 }, index: 0 },
			{ type: 'remove', key: 'c', expected: rows[2] },
		]);

		expect(pending).toHaveLength(5);
		expect(getQueuedChanges(pending).map(change => change.type)).toEqual(['update', 'move', 'update', 'add', 'remove']);
	});
});

describe('the changes of a queue', () => {
	it('an empty queue returns the rows as the same array', () => {
		expect(apply()).toBe(rows);
	});

	it('a replacement takes the place of the old row, the others stay the same objects', () => {
		const updated = { id: 'b', price: 20 };
		const result = apply([{ type: 'update', row: updated }]);

		expect(result).toEqual([rows[0], updated, rows[2]]);
		expect(result[0]).toBe(rows[0]);
		expect(result[2]).toBe(rows[2]);
	});

	it('adding appends, removing drops', () => {
		const added = { id: 'd', price: 4 };

		expect(apply([{ type: 'add', row: added }, { type: 'remove', key: 'a' }])).toEqual([rows[1], rows[2], added]);
	});

	it('replacing an unknown key is skipped', () => {
		expect(apply([{ type: 'update', row: { id: 'x', price: 0 } }])).toBe(rows);
	});

	it('changes to one key collapse: the last one wins', () => {
		const first = { id: 'd', price: 4 };
		const second = { id: 'd', price: 5 };

		expect(apply([{ type: 'add', row: first }], [{ type: 'update', row: second }])).toEqual([...rows, second]);
		expect(apply([{ type: 'add', row: first }], [{ type: 'remove', key: 'd' }])).toBe(rows);
		expect(apply([{ type: 'update', row: { id: 'a', price: 9 } }], [{ type: 'remove', key: 'a' }])).toEqual([rows[1], rows[2]]);
	});

	it('an update after a move applies to the moved row, in order', () => {
		const updated = { id: 'a', price: 10 };

		expect(apply([{ type: 'move', key: 'a', index: 2 }, { type: 'update', row: updated }])).toEqual([rows[1], rows[2], updated]);
	});
});

describe('indexRows', () => {
	it('finds the rows of a nested tree by key', () => {
		const child = { id: 'child', price: 0 };
		const tree: Row[] = [{ id: 'group', price: 0, children: [child] }];
		const index = indexRows(tree, getKey, 'children');

		expect(index.get('child')).toEqual({ row: child, parent: 'group' });
		expect(index.get('child')?.row).toBe(child);
		expect([...index.keys()]).toEqual(['group', 'child']);
	});
});
