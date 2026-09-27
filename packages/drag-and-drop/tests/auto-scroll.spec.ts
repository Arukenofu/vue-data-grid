import { describe, expect, it } from 'vitest';

import { createEdgeScroll, getEdgeSpeed, scrollBy, stepEdgeScroll } from '../src/auto-scroll';

const area = { left: 0, top: 0, right: 400, bottom: 300 };

describe('getEdgeSpeed', () => {
	it('is still away from the edges', () => {
		expect(getEdgeSpeed(area, { x: 200, y: 150 }, 'both')).toEqual({ x: 0, y: 0 });
	});

	it('pulls towards the edge the pointer is near, faster closer to it', () => {
		const near = getEdgeSpeed(area, { x: 200, y: 280 }, 'both');
		const nearer = getEdgeSpeed(area, { x: 200, y: 299 }, 'both');

		expect(near.y).toBeGreaterThan(0);
		expect(nearer.y).toBeGreaterThan(near.y);
		expect(getEdgeSpeed(area, { x: 2, y: 150 }, 'both').x).toBeLessThan(0);
	});

	it('an axis ignores the other one', () => {
		expect(getEdgeSpeed(area, { x: 2, y: 150 }, 'vertical')).toEqual({ x: 0, y: 0 });
		expect(getEdgeSpeed(area, { x: 200, y: 299 }, 'horizontal')).toEqual({ x: 0, y: 0 });
	});

	it('takes the zone, the speed and the curve of the settings', () => {
		// Half-way into a 40 px zone, on a straight line to 1000 px/s.
		expect(getEdgeSpeed(area, { x: 200, y: 280 }, 'both', { threshold: 40, speed: 1000, curve: depth => depth }).y).toBe(500);
	});

	it('starts the zones inside `margin`, and runs at full speed over it', () => {
		const settings = { threshold: 40, speed: 1000, curve: (depth: number) => depth, margin: { top: 50 } };

		expect(getEdgeSpeed(area, { x: 200, y: 70 }, 'both', settings).y).toBe(-500);
		expect(getEdgeSpeed(area, { x: 200, y: 20 }, 'both', settings).y).toBe(-1000);
	});
});

describe('stepEdgeScroll', () => {
	it('scrolls whole pixels, and keeps the rest for the next frame', () => {
		const state = createEdgeScroll();

		expect(stepEdgeScroll(state, { x: 0, y: 100 }, 16)).toEqual({ x: 0, y: 1 });
		expect(stepEdgeScroll(state, { x: 0, y: 100 }, 16)).toEqual({ x: 0, y: 2 });
	});

	it('follows the target over `smoothing`, and comes to rest', () => {
		const state = createEdgeScroll();

		stepEdgeScroll(state, { x: 0, y: 1000 }, 100, 100);

		expect(Math.round(state.velocity.y)).toBe(632);

		for (let frame = 0; frame < 20; frame += 1) {
			stepEdgeScroll(state, { x: 0, y: 0 }, 100, 100);
		}

		expect(state.velocity.y).toBe(0);
	});
});

describe('scrollBy', () => {
	it('says whether the area moved', () => {
		const element = document.createElement('div');
		let top = 0;

		Object.defineProperty(element, 'scrollTop', { get: () => top });
		element.scrollBy = ((_x: number, y: number) => {
			top = Math.min(top + y, 10);
		}) as typeof element.scrollBy;

		expect(scrollBy(element, { x: 0, y: 8 })).toBe(true);
		expect(scrollBy(element, { x: 0, y: 8 })).toBe(true);
		expect(scrollBy(element, { x: 0, y: 8 })).toBe(false);
	});
});
