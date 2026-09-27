import { describe, expect, it } from 'vitest';

import { getColumnIndexProps, getGroupIndexProps } from '../../src/props/index-props';

describe('getColumnIndexProps', () => {
	it('gives the 1-based `aria-colindex` of a position', () => {
		expect(getColumnIndexProps(0)).toEqual({ 'aria-colindex': 1 });
		expect(getColumnIndexProps(7)).toEqual({ 'aria-colindex': 8 });
	});

	it('one frozen object per position, shared by every caller', () => {
		expect(getColumnIndexProps(3)).toBe(getColumnIndexProps(3));
		expect(Object.isFrozen(getColumnIndexProps(3))).toBe(true);
	});

	it('gives nothing for a spacer', () => {
		expect(getColumnIndexProps(-1)).toEqual({});
	});
});

describe('getGroupIndexProps', () => {
	it('gives `aria-colindex` of the first column and `aria-colspan`', () => {
		expect(getGroupIndexProps({ index: 2, span: 3 })).toEqual({ 'aria-colindex': 3, 'aria-colspan': 3 });
	});

	it('one frozen object per pair', () => {
		expect(getGroupIndexProps({ index: 2, span: 3 })).toBe(getGroupIndexProps({ index: 2, span: 3 }));
		expect(getGroupIndexProps({ index: 2, span: 3 })).not.toBe(getGroupIndexProps({ index: 2, span: 2 }));
		expect(Object.isFrozen(getGroupIndexProps({ index: 0, span: 1 }))).toBe(true);
	});

	it('gives nothing for a spacer', () => {
		expect(getGroupIndexProps({ index: -1, span: 0 })).toEqual({});
	});
});
