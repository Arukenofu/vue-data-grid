import { getCurrentScope, type MaybeRefOrGetter, onScopeDispose, shallowReadonly, shallowRef, toValue } from 'vue';

/** A point in viewport coordinates, such as `clientX` and `clientY` of a pointer event. */
export interface AutoScrollPoint {
	x: number;
	y: number;
}

/** Sizes at the physical edges of the scroller, px. */
export interface AutoScrollEdges {
	top?: number;
	right?: number;
	bottom?: number;
	left?: number;
}

export interface AutoScrollOptions {
	/**
	 * What is stuck to the edges of the scroller, px, such as the header and pinned columns: the zones
	 * start inside it, where the content that scrolls is seen. Physical sides, as the pointer is.
	 */
	margin?: MaybeRefOrGetter<AutoScrollEdges | undefined>;
	/** How deep the zone at each edge is, px; `32` by default, and never more than a third of the scroller. */
	threshold?: MaybeRefOrGetter<number | undefined>;
	/** The speed at the edge itself, px per second; `600` by default. */
	speed?: MaybeRefOrGetter<number | undefined>;
	/**
	 * The share of `speed` at a depth into the zone: `0` where it starts, `1` at the edge, and more past
	 * the edge, up to `3`, as a browser speeds up the farther the pointer goes. Linear by default.
	 */
	curve?: (depth: number) => number;
	/**
	 * How long the speed takes to follow the pointer, ms: a soft start, a soft stop and no jerk when the
	 * pointer twitches. `0` by default, at once.
	 */
	smoothing?: MaybeRefOrGetter<number | undefined>;
	/** Which way it scrolls; both by default. */
	axis?: MaybeRefOrGetter<'x' | 'y' | 'both' | undefined>;
	/**
	 * The scroller moved while the pointer stood still over it: what is under the pointer changed, such
	 * as the cell a selection reaches. Called after each frame that scrolled.
	 */
	onScroll?: (point: AutoScrollPoint) => void;
}

const DEFAULT_THRESHOLD = 32;
const DEFAULT_SPEED = 600;
const MAX_DEPTH = 3;
// Below it a soft stop is over: the last crawl of a decaying speed would read as a drift.
const MIN_SPEED = 30;
// A frame after a long pause, such as a hidden tab, would scroll by a whole second at once.
const MAX_FRAME = 64;

function linear(depth: number) {
	return depth;
}

/**
 * Scrolls a container while the pointer is near its edges during a gesture of your own, such as
 * selecting cells by dragging: the closer to an edge, the faster, and faster still past it. Call
 * `start` when the gesture starts, `move` with every pointer move, and `stop` when it ends; `onScroll`
 * tells when the content moved under a pointer that stood still.
 *
 * The defaults behave as a browser does when it selects text; `curve`, `speed` and `smoothing` give it
 * a feel of your own. Frames run only while it scrolls.
 */
export function useAutoScroll(scroller: MaybeRefOrGetter<HTMLElement | null>, options: AutoScrollOptions = {}) {
	const active = shallowRef(false);

	let point: AutoScrollPoint | null = null;
	let frame: number | null = null;
	let last: number | null = null;
	// Px per second now, which follows the target speed with `smoothing`.
	let velocity = { x: 0, y: 0 };
	// Parts of a pixel not scrolled yet: a slow speed still moves.
	let carry = { x: 0, y: 0 };

	function getSpeed(position: number, start: number, end: number) {
		const zone = Math.min(toValue(options.threshold) ?? DEFAULT_THRESHOLD, (end - start) / 3);

		if (zone <= 0) {
			return 0;
		}

		const curve = options.curve ?? linear;
		const speed = toValue(options.speed) ?? DEFAULT_SPEED;

		if (position < start + zone) {
			return -speed * curve(Math.min((start + zone - position) / zone, MAX_DEPTH));
		}

		if (position > end - zone) {
			return speed * curve(Math.min((position - (end - zone)) / zone, MAX_DEPTH));
		}

		return 0;
	}

	/** Px per second the pointer asks for, towards the edges it is near. */
	function getTarget(element: HTMLElement, at: AutoScrollPoint) {
		const rect = element.getBoundingClientRect();
		const margin = toValue(options.margin) ?? {};
		const axis = toValue(options.axis) ?? 'both';
		// The inside of the scroller, without its borders and scrollbars, and without what is stuck to it.
		const left = rect.left + element.clientLeft + (margin.left ?? 0);
		const top = rect.top + element.clientTop + (margin.top ?? 0);
		const right = rect.left + element.clientLeft + element.clientWidth - (margin.right ?? 0);
		const bottom = rect.top + element.clientTop + element.clientHeight - (margin.bottom ?? 0);

		return {
			x: axis === 'y' ? 0 : getSpeed(at.x, left, right),
			y: axis === 'x' ? 0 : getSpeed(at.y, top, bottom),
		};
	}

	function schedule() {
		frame ??= requestAnimationFrame(step);
	}

	function step(now: number) {
		frame = null;

		const element = toValue(scroller);

		if (!active.value || !element || !point) {
			return;
		}

		// The first frame of a run only starts the clock: the time before it was not spent scrolling.
		if (last === null) {
			last = now;
			schedule();

			return;
		}

		const elapsed = Math.min(now - last, MAX_FRAME);
		const smoothing = toValue(options.smoothing) ?? 0;
		const follow = smoothing > 0 ? 1 - Math.exp(-elapsed / smoothing) : 1;
		const target = getTarget(element, point);

		last = now;
		velocity = {
			x: velocity.x + (target.x - velocity.x) * follow,
			y: velocity.y + (target.y - velocity.y) * follow,
		};
		carry = { x: carry.x + velocity.x * elapsed / 1000, y: carry.y + velocity.y * elapsed / 1000 };

		const by = { x: Math.trunc(carry.x), y: Math.trunc(carry.y) };

		carry = { x: carry.x - by.x, y: carry.y - by.y };

		if (by.x !== 0 || by.y !== 0) {
			const before = { left: element.scrollLeft, top: element.scrollTop };

			element.scrollBy(by.x, by.y);

			// At the end of the content the speed has nowhere to go: it builds up again from the start.
			if (element.scrollLeft === before.left) {
				velocity.x = 0;
				carry.x = 0;
			}

			if (element.scrollTop === before.top) {
				velocity.y = 0;
				carry.y = 0;
			}

			if (element.scrollLeft !== before.left || element.scrollTop !== before.top) {
				options.onScroll?.(point);
			}
		}

		const moving = Math.abs(velocity.x) >= MIN_SPEED || Math.abs(velocity.y) >= MIN_SPEED;

		if (moving || target.x !== 0 || target.y !== 0) {
			schedule();
		} else {
			last = null;
			velocity = { x: 0, y: 0 };
		}
	}

	/** A gesture starts at `at`. */
	function start(at: AutoScrollPoint) {
		active.value = true;
		point = at;
		schedule();
	}

	/** The pointer moved to `at`; it scrolls towards the edge it is near. */
	function move(at: AutoScrollPoint) {
		if (active.value) {
			point = at;
			schedule();
		}
	}

	/** The gesture ended: it stops at once. */
	function stop() {
		active.value = false;
		point = null;
		last = null;
		velocity = { x: 0, y: 0 };
		carry = { x: 0, y: 0 };

		if (frame !== null) {
			cancelAnimationFrame(frame);
			frame = null;
		}
	}

	if (getCurrentScope()) {
		onScopeDispose(stop);
	}

	return {
		start,
		move,
		stop,
		/** Whether a gesture is in progress, between `start` and `stop`. */
		active: shallowReadonly(active),
	};
}

/** Scrolling near the edges as `useAutoScroll` gives it. */
export type AutoScroll = ReturnType<typeof useAutoScroll>;
