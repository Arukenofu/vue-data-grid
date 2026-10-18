import { describe, expect, it } from 'vitest';

import { applyKeyedChanges } from '../../src/rows/row-batch';
import { applyRowChanges, type RowChange, type RowChangeOptions } from '../../src/rows/row-changes';

interface Row {
	id: string;
	parent: string | null;
	version: number;
}

const KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'x', 'y'];
const BATCHES = 300;
const CHANGES_PER_BATCH = 8;

/** A deterministic sequence of numbers in [0, 1). */
function createRandom(seed: number) {
	let state = seed;

	return () => {
		state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;

		return state / 4_294_967_296;
	};
}

function createRows(random: () => number): Row[] {
	return KEYS.slice(0, 6).map((id, index) => ({
		id,
		parent: index > 0 && random() < 0.5 ? KEYS[Math.floor(random() * index)] : null,
		version: 0,
	}));
}

function createChange(rows: readonly Row[], random: () => number, version: number): RowChange<Row> {
	const id = KEYS[Math.floor(random() * KEYS.length)];
	const current = rows.find(row => row.id === id);
	const parent = random() < 0.5 ? null : KEYS[Math.floor(random() * KEYS.length)];
	const roll = random();

	if (roll < 0.3) {
		return { type: 'update', row: { id, parent, version }, expected: random() < 0.3 ? current : undefined };
	}

	if (roll < 0.6) {
		return { type: 'remove', key: id, expected: random() < 0.3 ? current : undefined };
	}

	return { type: 'add', row: { id, parent, version }, existing: random() < 0.3 ? 'replace' : undefined };
}

/** The same changes through the working list: a skipped move to a key no row has forces it. */
function inOrder(rows: readonly Row[], changes: readonly RowChange<Row>[], options: RowChangeOptions<Row>) {
	const sentinel: RowChange<Row> = { type: 'move', key: 'missing', index: 0 };
	const result = applyRowChanges(rows, [...changes, sentinel], options);

	return { rows: result.rows, applied: result.applied, skipped: result.skipped.filter(change => change !== sentinel) };
}

describe('applyKeyedChanges', () => {
	it('leaves a batch with a place or a move, and a nested tree, to the working list', () => {
		const rows: Row[] = [{ id: 'a', parent: null, version: 0 }];

		expect(applyKeyedChanges(rows, [{ type: 'move', key: 'a' }], { rowKey: 'id' })).toBeNull();
		expect(applyKeyedChanges(rows, [{ type: 'add', row: rows[0], index: 0 }], { rowKey: 'id' })).toBeNull();
		expect(applyKeyedChanges(rows, [{ type: 'remove', key: 'a' }], { rowKey: 'id', childrenField: undefined })).not.toBeNull();
	});

	for (const [name, options] of [
		['a flat list', { rowKey: 'id' }],
		['a tree by parent keys', { rowKey: 'id', parentKey: 'parent' }],
	] as const) {
		it(`gives the rows and the skips the same changes give in order, in ${name}`, () => {
			const random = createRandom(7);

			for (let batch = 0; batch < BATCHES; batch += 1) {
				const rows = createRows(random);
				const changes: RowChange<Row>[] = [];

				for (let index = 0; index < CHANGES_PER_BATCH; index += 1) {
					changes.push(createChange(rows, random, index + 1));
				}

				const keyed = applyKeyedChanges(rows, changes, options);
				const expected = inOrder(rows, changes, options);

				expect(keyed?.rows).toEqual(expected.rows);
				expect(keyed?.applied).toEqual(expected.applied);
				expect(keyed?.skipped).toEqual(expected.skipped);
				expect(keyed?.rows === rows).toBe(expected.rows === rows);
			}
		});
	}

	it('removes the rows under a row as they are at the removal', () => {
		const rows: Row[] = [
			{ id: 'a', parent: null, version: 0 },
			{ id: 'b', parent: 'a', version: 0 },
			{ id: 'c', parent: 'b', version: 0 },
			{ id: 'd', parent: null, version: 0 },
		];
		const result = applyKeyedChanges(rows, [
			{ type: 'update', row: { id: 'c', parent: 'd', version: 1 } },
			{ type: 'add', row: { id: 'x', parent: 'b', version: 1 } },
			{ type: 'remove', key: 'a' },
			{ type: 'update', row: { id: 'b', parent: null, version: 2 } },
		], { rowKey: 'id', parentKey: 'parent' });

		expect(result?.rows).toEqual([{ id: 'c', parent: 'd', version: 1 }, rows[3]]);
		expect(result?.skipped).toHaveLength(1);
	});
});
