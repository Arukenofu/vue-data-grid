import { describe, expect, it } from 'vitest';

import type { ColumnOrder } from '../../src/columns/column';
import { keepsFixedColumns, moveColumn } from '../../src/columns/column-order';

function movable(name: string): ColumnOrder {
	return { name, movable: true };
}

function fixed(name: string): ColumnOrder {
	return { name, movable: false };
}

const names = (columns: readonly ColumnOrder[] | null) => columns?.map(column => column.name) ?? null;

describe('moveColumn', () => {
	const columns = [movable('a'), movable('b'), movable('c'), movable('d')];

	it('moves the column before the named one', () => {
		expect(names(moveColumn(columns, 'd', 'b'))).toEqual(['a', 'd', 'b', 'c']);
	});

	it('`before: null` moves the column to the end', () => {
		expect(names(moveColumn(columns, 'a', null))).toEqual(['b', 'c', 'd', 'a']);
	});

	it('moves left to right, counting the place without the moved column', () => {
		expect(names(moveColumn(columns, 'a', 'c'))).toEqual(['b', 'a', 'c', 'd']);
	});

	it('a move to the neighbour swaps two columns', () => {
		expect(names(moveColumn(columns, 'b', 'a'))).toEqual(['b', 'a', 'c', 'd']);
	});

	it('returns a new array instead of modifying the source', () => {
		const snapshot = names(columns);

		moveColumn(columns, 'd', 'a');

		expect(names(columns)).toEqual(snapshot);
	});

	it('moves the same column object, not a copy', () => {
		const next = moveColumn(columns, 'd', 'b');

		expect(next?.[1]).toBe(columns[3]);
	});
});

describe('moveColumn — when there is no move', () => {
	const columns = [movable('a'), movable('b'), fixed('c')];

	it('an unknown column gives `null`', () => {
		expect(moveColumn(columns, 'zzz', 'a')).toBeNull();
	});

	it('a column that is not movable gives `null`', () => {
		expect(moveColumn(columns, 'c', 'a')).toBeNull();
	});

	it('an unknown target gives `null`', () => {
		expect(moveColumn(columns, 'a', 'zzz')).toBeNull();
	});

	it('before itself gives `null`', () => {
		expect(moveColumn(columns, 'a', 'a')).toBeNull();
	});

	it('before the next neighbour changes nothing and gives `null`', () => {
		expect(moveColumn(columns, 'a', 'b')).toBeNull();
	});

	it('the last column to the end changes nothing and gives `null`', () => {
		expect(moveColumn([movable('a'), movable('b')], 'b', null)).toBeNull();
	});

	it('the only column to the end gives `null`', () => {
		expect(moveColumn([movable('a')], 'a', null)).toBeNull();
	});

	it('an empty set gives `null`', () => {
		expect(moveColumn([], 'a', null)).toBeNull();
	});
});

describe('keepsFixedColumns', () => {
	it('a move of movable columns passes', () => {
		const columns = [fixed('pin'), movable('a'), movable('b')];
		const next = [fixed('pin'), movable('b'), movable('a')];

		expect(keepsFixedColumns(columns, next)).toBe(true);
	});

	it('a shifted column that is not movable fails', () => {
		const columns = [fixed('pin'), movable('a')];
		const next = [movable('a'), fixed('pin')];

		expect(keepsFixedColumns(columns, next)).toBe(false);
	});

	it('a column that is not movable and missing from the new set fails', () => {
		expect(keepsFixedColumns([fixed('pin'), movable('a')], [movable('a')])).toBe(false);
	});

	it('a set without fixed columns passes any move', () => {
		const columns = [movable('a'), movable('b'), movable('c')];

		expect(keepsFixedColumns(columns, [movable('c'), movable('b'), movable('a')])).toBe(true);
	});

	it('a fixed column in the middle holds only its own place', () => {
		const columns = [movable('a'), fixed('pin'), movable('b')];

		expect(keepsFixedColumns(columns, [movable('b'), fixed('pin'), movable('a')])).toBe(true);
		expect(keepsFixedColumns(columns, [fixed('pin'), movable('a'), movable('b')])).toBe(false);
	});

	it('an empty set passes', () => {
		expect(keepsFixedColumns([], [])).toBe(true);
	});
});

describe('moveColumn and keepsFixedColumns together', () => {
	it('a movable column cannot jump over a fixed one: the check catches it, not the move itself', () => {
		const columns = [fixed('pin'), movable('a'), movable('b')];
		const next = moveColumn(columns, 'b', 'pin');

		expect(names(next)).toEqual(['b', 'pin', 'a']);
		expect(keepsFixedColumns(columns, next ?? [])).toBe(false);
	});
});
