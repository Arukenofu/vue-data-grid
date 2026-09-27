import type { DragAxis, DragPoint, DragRect } from './model';

/**
 * How an area scrolls while something is dragged near its edges: the closer to an edge, the faster.
 * The defaults are slow for most of the zone and quick right at the edge.
 */
export interface DragAutoScroll {
	/** How deep the zone at each edge is, px; `48` by default, and never more than a third of the area. */
	threshold?: number;
	/** The speed at the edge itself, px per second; `1200` by default. */
	speed?: number;
	/** The share of `speed` at a depth into the zone, `0` where it starts and `1` at the edge; a cube by default. */
	curve?: (depth: number) => number;
	/** How long the speed takes to follow the pointer, ms: a soft start and stop; `0` by default, at once. */
	smoothing?: number;
	/**
	 * What is stuck to each physical edge of the area, px, such as a sticky header: the zones start
	 * inside it, and the pointer over it scrolls at full speed.
	 */
	margin?: { top?: number; right?: number; bottom?: number; left?: number };
}

/** The speed an area scrolls at now, and the parts of a pixel it has not scrolled yet. */
export interface EdgeScroll {
	velocity: DragPoint;
	carry: DragPoint;
}

const DEFAULT_THRESHOLD = 48;
const DEFAULT_SPEED = 1200;
// Below it a soft stop is over.
const MIN_SPEED = 30;

function cube(depth: number) {
	return depth ** 3;
}

function towards(start: number, end: number, value: number, settings: DragAutoScroll) {
	const zone = Math.min(settings.threshold ?? DEFAULT_THRESHOLD, (end - start) / 3);

	if (zone <= 0) {
		return 0;
	}

	const curve = settings.curve ?? cube;
	const speed = settings.speed ?? DEFAULT_SPEED;

	if (value < start + zone) {
		return -speed * curve(Math.min(1, (start + zone - value) / zone));
	}

	if (value > end - zone) {
		return speed * curve(Math.min(1, (value - (end - zone)) / zone));
	}

	return 0;
}

/**
 * Px per second a pointer near the edges of an area asks for: the content moves towards the pointer,
 * faster the closer it is to an edge. Zero on both axes away from the edges.
 */
export function getEdgeSpeed(rect: DragRect, point: DragPoint, axis: DragAxis | 'both', settings: DragAutoScroll = {}): DragPoint {
	const margin = settings.margin ?? {};
	const left = rect.left + (margin.left ?? 0);
	const right = rect.right - (margin.right ?? 0);
	const top = rect.top + (margin.top ?? 0);
	const bottom = rect.bottom - (margin.bottom ?? 0);

	return {
		x: axis === 'vertical' ? 0 : towards(left, right, point.x, settings),
		y: axis === 'horizontal' ? 0 : towards(top, bottom, point.y, settings),
	};
}

export function createEdgeScroll(): EdgeScroll {
	return { velocity: { x: 0, y: 0 }, carry: { x: 0, y: 0 } };
}

/**
 * Whole pixels to scroll in a frame of `elapsed` ms towards `target` px per second: the speed follows
 * the target over `smoothing` ms, and the parts of a pixel wait for the next frame, so that a slow
 * speed still moves.
 */
export function stepEdgeScroll(state: EdgeScroll, target: DragPoint, elapsed: number, smoothing = 0): DragPoint {
	const follow = smoothing > 0 ? 1 - Math.exp(-elapsed / smoothing) : 1;
	const x = state.velocity.x + (target.x - state.velocity.x) * follow;
	const y = state.velocity.y + (target.y - state.velocity.y) * follow;

	state.velocity = { x: Math.abs(x) < MIN_SPEED && target.x === 0 ? 0 : x, y: Math.abs(y) < MIN_SPEED && target.y === 0 ? 0 : y };

	const carry = {
		x: state.carry.x + state.velocity.x * elapsed / 1000,
		y: state.carry.y + state.velocity.y * elapsed / 1000,
	};
	const by = { x: Math.trunc(carry.x), y: Math.trunc(carry.y) };

	state.carry = { x: carry.x - by.x, y: carry.y - by.y };

	return by;
}

function getScrollPosition(target: HTMLElement | Window): DragPoint {
	return target instanceof Window
		? { x: target.scrollX, y: target.scrollY }
		: { x: target.scrollLeft, y: target.scrollTop };
}

/** Scrolls by `velocity`; `false` when the area did not move, having nowhere left to go. */
export function scrollBy(target: HTMLElement | Window, velocity: DragPoint) {
	const before = getScrollPosition(target);

	target.scrollBy(velocity.x, velocity.y);

	const after = getScrollPosition(target);

	return after.x !== before.x || after.y !== before.y;
}
