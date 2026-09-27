import { describe, expect, it } from 'vitest';

import { compareValues, isEmptyValue } from '../../src/rows/compare';

describe('compareValues', () => {
	it('numbers by magnitude', () => {
		expect(compareValues(2, 10)).toBeLessThan(0);
		expect(compareValues(-1, -5)).toBeGreaterThan(0);
		expect(compareValues(3, 3)).toBe(0);
	});

	it('strings with numbers inside compare by number, not by character', () => {
		expect(compareValues('A9', 'A10')).toBeLessThan(0);
		expect(compareValues('b', 'a')).toBeGreaterThan(0);
	});

	it('dates by time', () => {
		expect(compareValues(new Date('2026-01-02'), new Date('2026-01-01'))).toBeGreaterThan(0);
	});

	it('`false` before `true`', () => {
		expect(compareValues(false, true)).toBeLessThan(0);
	});

	it('bigints by magnitude', () => {
		expect(compareValues(10n, 9n)).toBeGreaterThan(0);
		expect(compareValues(1n, 1n)).toBe(0);
	});

	it('different types as strings', () => {
		expect(compareValues(2, 'b')).toBeLessThan(0);
	});
});

describe('isEmptyValue', () => {
	it('empty means `null`, `undefined` and `NaN`', () => {
		expect([null, undefined, Number.NaN].every(isEmptyValue)).toBe(true);
	});

	it('zero, an empty string and `false` are values', () => {
		expect([0, '', false].some(isEmptyValue)).toBe(false);
	});
});
