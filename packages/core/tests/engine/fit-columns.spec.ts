import { describe, expect, it } from 'vitest';

import { fitColumnWidths } from '../../src/engine/fit-columns';

const sum = (widths: Record<string, number>) => Object.values(widths).reduce((total, width) => total + width, 0);

describe('fitColumnWidths', () => {
	it('shares the space in proportion to current widths', () => {
		const widths = fitColumnWidths([
			{ name: 'a', width: 100, minWidth: 10 },
			{ name: 'b', width: 300, minWidth: 10 },
		], 800);

		expect(widths).toEqual({ a: 200, b: 600 });
	});

	it('widths are whole and add up to the space', () => {
		const widths = fitColumnWidths([
			{ name: 'a', width: 100, minWidth: 10 },
			{ name: 'b', width: 100, minWidth: 10 },
			{ name: 'c', width: 100, minWidth: 10 },
		], 1000);

		expect(Object.values(widths).every(Number.isInteger)).toBe(true);
		expect(sum(widths)).toBe(1000);
	});

	it('a column that hits `maxWidth` stops there and the others share the rest', () => {
		const widths = fitColumnWidths([
			{ name: 'a', width: 100, minWidth: 10, maxWidth: 150 },
			{ name: 'b', width: 100, minWidth: 10 },
		], 600);

		expect(widths).toEqual({ a: 150, b: 450 });
	});

	it('when space runs short a column does not shrink below `minWidth`', () => {
		const widths = fitColumnWidths([
			{ name: 'a', width: 100, minWidth: 80 },
			{ name: 'b', width: 300, minWidth: 10 },
		], 200);

		expect(widths).toEqual({ a: 80, b: 120 });
	});

	it('no columns give nothing', () => {
		expect(fitColumnWidths([], 500)).toEqual({});
	});
});
