import { describe, expect, it } from 'vitest';

import { applyRowQueue, queueTransaction, type RowQueue } from '../../src/rows/row-stream';

interface Row {
	id: string;
	price: number;
}

const getKey = (row: Row) => row.id;

const rows: Row[] = [{ id: 'a', price: 1 }, { id: 'b', price: 2 }, { id: 'c', price: 3 }];

function apply(...transactions: Parameters<typeof queueTransaction<Row>>[1][]) {
	const queue: RowQueue<Row> = new Map();

	for (const transaction of transactions) {
		queueTransaction(queue, transaction, getKey);
	}

	return applyRowQueue(rows, queue, getKey);
}

describe('applyRowQueue', () => {
	it('an empty queue returns the rows as the same array', () => {
		expect(applyRowQueue(rows, new Map(), getKey)).toBe(rows);
	});

	it('a replacement takes the place of the old row, the others stay the same objects', () => {
		const updated = { id: 'b', price: 20 };
		const result = apply({ update: [updated] });

		expect(result).toEqual([rows[0], updated, rows[2]]);
		expect(result[0]).toBe(rows[0]);
		expect(result[2]).toBe(rows[2]);
	});

	it('adding appends, removing drops', () => {
		const added = { id: 'd', price: 4 };

		expect(apply({ add: [added], remove: ['a'] })).toEqual([rows[1], rows[2], added]);
	});

	it('replacing an unknown key is skipped', () => {
		expect(apply({ update: [{ id: 'x', price: 0 }] })).toBe(rows);
	});

	it('adding a known key replaces the row in its place', () => {
		const replaced = { id: 'a', price: 10 };

		expect(apply({ add: [replaced] })).toEqual([replaced, rows[1], rows[2]]);
	});

	it('changes to one key collapse: the last one wins', () => {
		const first = { id: 'd', price: 4 };
		const second = { id: 'd', price: 5 };

		expect(apply({ add: [first] }, { update: [second] })).toEqual([...rows, second]);
		expect(apply({ add: [first] }, { remove: ['d'] })).toBe(rows);
		expect(apply({ update: [{ id: 'a', price: 9 }] }, { remove: ['a'] })).toEqual([rows[1], rows[2]]);
	});

	it('replacing with the same object changes nothing', () => {
		expect(apply({ update: [rows[1]] })).toBe(rows);
	});
});
