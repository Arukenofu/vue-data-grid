import { describe, expect, it } from 'vitest';

import { resolveScrollPosition, type ScrollTarget } from '../../src/virtual/scroll';

const base: ScrollTarget = {
	start: 0,
	end: 100,
	insetStart: 0,
	insetEnd: 0,
	viewport: 300,
	scroll: 0,
	max: 1000,
	align: 'auto',
};

describe('resolveScrollPosition', () => {
	it('`auto`: a visible target needs no scrolling', () => {
		expect(resolveScrollPosition({ ...base, start: 100, end: 200 })).toBeNull();
	});

	it('`auto`: a target past the far edge is brought to it', () => {
		expect(resolveScrollPosition({ ...base, start: 400, end: 500 })).toBe(200);
	});

	it('`auto`: a target past the near edge goes to the start', () => {
		expect(resolveScrollPosition({ ...base, start: 100, end: 200, scroll: 150 })).toBe(100);
	});

	it('`auto`: a target under the sticky start is brought out from under it', () => {
		expect(resolveScrollPosition({ ...base, start: 180, end: 260, scroll: 100, insetStart: 120 })).toBe(60);
	});

	it('`auto`: a target under the sticky end is brought out from under it', () => {
		expect(resolveScrollPosition({ ...base, start: 200, end: 280, insetEnd: 50 })).toBe(30);
	});

	it('`auto`: a target larger than the uncovered part is aligned to the start', () => {
		expect(resolveScrollPosition({ ...base, start: 400, end: 800, insetStart: 100 })).toBe(300);
	});

	it('`start`, `center` and `end`', () => {
		const target = { ...base, start: 500, end: 600, insetStart: 100 };

		expect(resolveScrollPosition({ ...target, align: 'start' })).toBe(400);
		expect(resolveScrollPosition({ ...target, align: 'end' })).toBe(300);
		expect(resolveScrollPosition({ ...target, align: 'center' })).toBe(350);
	});

	it('scrolling stays within bounds', () => {
		expect(resolveScrollPosition({ ...base, start: 950, end: 1000, max: 700, align: 'start' })).toBe(700);
		expect(resolveScrollPosition({ ...base, start: 0, end: 50, scroll: 40, align: 'end' })).toBe(0);
	});
});
