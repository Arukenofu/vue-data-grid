import { describe, expect, it } from 'vitest';

import { type TableSort, toggleSort } from '../../src/columns/sort';

const asc = (name: string): TableSort => ({ name, direction: 'asc' });
const desc = (name: string): TableSort => ({ name, direction: 'desc' });

describe('toggleSort — single sort', () => {
	it('the first click sets desc', () => {
		expect(toggleSort([], 'price', false)).toEqual([desc('price')]);
	});

	it('the second click on the same column flips it to asc', () => {
		expect(toggleSort([desc('price')], 'price', false)).toEqual([asc('price')]);
	});

	it('the third click clears the sort', () => {
		expect(toggleSort([asc('price')], 'price', false)).toEqual([]);
	});

	it('a click on another column replaces the whole sort', () => {
		expect(toggleSort([asc('price')], 'cap', false)).toEqual([desc('cap')]);
	});

	it('without additive the column becomes the only one, even if there were several', () => {
		expect(toggleSort([asc('price'), desc('cap')], 'volume', false)).toEqual([desc('volume')]);
	});

	it('clearing the sort does not drag the other columns along', () => {
		expect(toggleSort([asc('price'), desc('cap')], 'price', false)).toEqual([]);
	});
});

describe('toggleSort — multi-sort', () => {
	it('a new column goes to the end of the list', () => {
		expect(toggleSort([asc('price')], 'cap', true)).toEqual([asc('price'), desc('cap')]);
	});

	it('a column that already sorts changes direction in place', () => {
		const sort = [asc('price'), desc('cap'), asc('volume')];

		expect(toggleSort(sort, 'cap', true)).toEqual([asc('price'), asc('cap'), asc('volume')]);
	});

	it('the third click removes the column and keeps the order of the others', () => {
		const sort = [asc('price'), asc('cap'), asc('volume')];

		expect(toggleSort(sort, 'cap', true)).toEqual([asc('price'), asc('volume')]);
	});

	it('removing the last column leaves an empty list', () => {
		expect(toggleSort([asc('price')], 'price', true)).toEqual([]);
	});
});

describe('toggleSort — direction order', () => {
	it('steps through the directions of order and clears after the last one', () => {
		const order = ['asc', 'desc'] as const;

		expect(toggleSort([], 'name', false, order)).toEqual([asc('name')]);
		expect(toggleSort([asc('name')], 'name', false, order)).toEqual([desc('name')]);
		expect(toggleSort([desc('name')], 'name', false, order)).toEqual([]);
	});

	it('a single direction turns on and then clears', () => {
		expect(toggleSort([], 'rank', false, ['asc'])).toEqual([asc('rank')]);
		expect(toggleSort([asc('rank')], 'rank', false, ['asc'])).toEqual([]);
	});

	it('a direction missing from order is replaced by its first one', () => {
		expect(toggleSort([desc('rank')], 'rank', false, ['asc'])).toEqual([asc('rank')]);
	});

	it('an empty order does not sort at all', () => {
		expect(toggleSort([], 'rank', false, [])).toEqual([]);
	});
});

describe('toggleSort — input immutability', () => {
	it('the source array is not modified in any branch', () => {
		const sort = [asc('price'), desc('cap')];
		const snapshot = structuredClone(sort);

		toggleSort(sort, 'price', false);
		toggleSort(sort, 'price', true);
		toggleSort(sort, 'cap', true);
		toggleSort(sort, 'volume', true);

		expect(sort).toEqual(snapshot);
	});

	it('every call returns a new array', () => {
		const sort = [asc('price')];

		expect(toggleSort(sort, 'volume', true)).not.toBe(sort);
		expect(toggleSort(sort, 'price', true)).not.toBe(sort);
	});

	it('items the change did not touch stay the same objects', () => {
		const untouched = asc('price');
		const sort = [untouched, asc('cap')];

		const next = toggleSort(sort, 'cap', true);

		expect(next[0]).toBe(untouched);
	});
});
