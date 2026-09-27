import { effectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type AutoScrollOptions, useAutoScroll } from '../../src/scroll/use-auto-scroll';

/** Animation frames that run only when told, each a given number of ms after the last. */
function stubFrames() {
	const callbacks = new Map<number, FrameRequestCallback>();
	let id = 0;
	let now = 0;

	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		id += 1;
		callbacks.set(id, callback);

		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', (handle: number) => callbacks.delete(handle));

	return {
		pending: () => callbacks.size,
		run: (elapsed = 16) => {
			const due = [...callbacks.values()];

			now += elapsed;
			callbacks.clear();
			due.forEach(callback => callback(now));
		},
	};
}

/** A scroller of 400 × 300 px at the origin, over content of 4000 × 3000 px. */
function createScroller() {
	const element = document.createElement('div');
	let left = 0;
	let top = 0;

	Object.defineProperties(element, {
		clientWidth: { value: 400 },
		clientHeight: { value: 300 },
		scrollLeft: { get: () => left },
		scrollTop: { get: () => top },
	});
	element.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300 }) as DOMRect;
	element.scrollBy = ((x: number, y: number) => {
		left = Math.min(Math.max(left + x, 0), 3600);
		top = Math.min(Math.max(top + y, 0), 2700);
	}) as typeof element.scrollBy;

	return element;
}

let frames: ReturnType<typeof stubFrames>;
let scope: ReturnType<typeof effectScope>;

function setup(options: AutoScrollOptions = {}) {
	const element = createScroller();

	scope = effectScope();

	const scroll = scope.run(() => useAutoScroll(element, options)) as ReturnType<typeof useAutoScroll>;

	return { element, scroll };
}

beforeEach(() => {
	frames = stubFrames();
});

afterEach(() => {
	scope.stop();
	vi.unstubAllGlobals();
});

describe('useAutoScroll', () => {
	it('scrolls towards the edge the pointer is near, faster the closer it is', () => {
		const { element, scroll } = setup();

		scroll.start({ x: 200, y: 292 });
		frames.run();
		frames.run(50);

		// A quarter of the zone from the edge: three quarters of 600 px/s, for 50 ms.
		expect(element.scrollTop).toBe(22);
		expect(element.scrollLeft).toBe(0);

		scroll.move({ x: 200, y: 299 });
		frames.run(50);

		// The half pixel left over goes too.
		expect(element.scrollTop).toBe(22 + 29);
	});

	it('speeds up past the edge, and scrolls nothing away from the edges', () => {
		const { element, scroll } = setup();

		scroll.start({ x: 200, y: 332 });
		frames.run();
		frames.run(50);

		// Past the edge by a zone: twice the speed.
		expect(element.scrollTop).toBe(60);

		scroll.move({ x: 200, y: 150 });
		frames.run(50);

		expect(element.scrollTop).toBe(60);
		expect(frames.pending()).toBe(0);
	});

	it('starts the zones inside `margin`, and keeps to its `axis`', () => {
		const { element, scroll } = setup({ margin: { top: 40, left: 56 }, axis: 'y' });

		element.scrollBy(0, 500);
		scroll.start({ x: 60, y: 48 });
		frames.run();
		frames.run(50);

		expect(element.scrollTop).toBe(500 - 22);
		expect(element.scrollLeft).toBe(0);
	});

	it('follows the pointer softly with `smoothing`, and by `curve`', () => {
		const { element, scroll } = setup({ smoothing: 100, curve: depth => depth ** 2 });

		scroll.start({ x: 200, y: 300 });
		frames.run();
		frames.run(50);

		// The full speed at the edge, 1 − e^−0.5 of the way to it after 50 ms.
		expect(element.scrollTop).toBe(11);
	});

	it('tells `onScroll` where the pointer is after each frame that scrolled, and stops with `stop`', () => {
		const onScroll = vi.fn();
		const { element, scroll } = setup({ onScroll });

		scroll.start({ x: 200, y: 300 });
		frames.run();
		frames.run(50);

		expect(onScroll).toHaveBeenCalledWith({ x: 200, y: 300 });
		expect(scroll.active.value).toBe(true);

		scroll.stop();
		frames.run(50);

		expect(element.scrollTop).toBe(30);
		expect(scroll.active.value).toBe(false);
		expect(frames.pending()).toBe(0);
	});

	it('does nothing between gestures', () => {
		const { element, scroll } = setup();

		scroll.move({ x: 200, y: 300 });
		frames.run(50);

		expect(element.scrollTop).toBe(0);
		expect(frames.pending()).toBe(0);
	});
});
