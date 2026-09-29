import { describe, expect, it } from 'vitest';

import { resolveAnchorShift } from '../../src/virtual/anchor';
import { createItemMetrics } from '../../src/virtual/item-metrics';

function snapshot(keys: readonly string[], size: number | ((index: number) => number) = 10) {
	return {
		metrics: createItemMetrics(keys.length, size),
		getKey: (index: number) => keys[index],
		getIndex: (key: string) => keys.indexOf(key),
	};
}

function range(from: number, to: number) {
	return Array.from({ length: to - from }, (_, index) => `r${from + index}`);
}

describe('resolveAnchorShift', () => {
	it('shifts by the height of the rows inserted above the ones in view', () => {
		expect(resolveAnchorShift(snapshot(range(10, 30)), snapshot(range(0, 30)), 50, 40)).toBe(100);
	});

	it('follows the rows in view at the very top too', () => {
		expect(resolveAnchorShift(snapshot(range(10, 30)), snapshot(range(5, 30)), 0, 40)).toBe(50);
	});

	it('shifts back by the rows removed above the ones in view', () => {
		expect(resolveAnchorShift(snapshot(range(0, 30)), snapshot(range(4, 30)), 100, 40)).toBe(-40);
	});

	it('counts the heights of the inserted rows, not their number', () => {
		const next = snapshot(range(0, 30), index => (index < 10 ? 25 : 10));

		expect(resolveAnchorShift(snapshot(range(10, 30)), next, 50, 40)).toBe(250);
	});

	it('keeps a row cut by the top edge cut at the same place', () => {
		expect(resolveAnchorShift(snapshot(range(10, 30)), snapshot(range(0, 30)), 55, 40)).toBe(100);
	});

	it('follows a page added at the top while one is dropped at the bottom, as with a page limit', () => {
		expect(resolveAnchorShift(snapshot(range(10, 40)), snapshot(range(0, 30)), 50, 40)).toBe(100);
		expect(resolveAnchorShift(snapshot(range(10, 40)), snapshot(range(0, 35)), 50, 40)).toBe(100);
	});

	it('scrolls nothing for rows added below the ones in view', () => {
		expect(resolveAnchorShift(snapshot(range(0, 30)), snapshot(range(0, 60)), 50, 40)).toBe(0);
	});

	it('scrolls nothing once the rows in view are in another order', () => {
		const reversed = [...range(0, 28)].reverse();

		expect(resolveAnchorShift(snapshot(range(0, 30)), snapshot(reversed), 50, 40)).toBe(0);
	});

	it('follows a filter that takes only rows above the ones in view', () => {
		const filtered = range(0, 30).filter(key => key !== 'r1' && key !== 'r3');

		expect(resolveAnchorShift(snapshot(range(0, 30)), snapshot(filtered), 50, 40)).toBe(-20);
	});

	it('scrolls nothing when a row in view is gone or another one came between them', () => {
		const gone = range(0, 30).filter(key => key !== 'r7');
		const between = [...range(0, 6), 'new', ...range(6, 30)];

		expect(resolveAnchorShift(snapshot(range(0, 30)), snapshot(gone), 50, 40)).toBe(0);
		expect(resolveAnchorShift(snapshot(range(0, 30)), snapshot(between), 50, 40)).toBe(0);
	});

	it('scrolls nothing for a row in view it has no key for, as one that was not rendered', () => {
		const previous = { ...snapshot(range(10, 30)), getKey: (index: number) => (index === 6 ? undefined : `r${index + 10}`) };

		expect(resolveAnchorShift(previous, snapshot(range(0, 30)), 50, 40)).toBe(0);
	});

	it('scrolls nothing for a first page, or rows that went', () => {
		expect(resolveAnchorShift(snapshot([]), snapshot(range(0, 30)), 0, 40)).toBe(0);
		expect(resolveAnchorShift(snapshot(range(0, 30)), snapshot([]), 50, 40)).toBe(0);
		expect(resolveAnchorShift(snapshot(range(0, 30)), snapshot(range(100, 110)), 50, 40)).toBe(0);
	});
});
