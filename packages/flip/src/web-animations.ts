import { defineMotionEngine } from './define';
import type { MotionEngine, MotionMove } from './model';

export interface WebAnimationsOptions {
	/** How long a transition takes, ms; `200` by default. `0` plays nothing. */
	duration?: number;
	/** A CSS easing of the moves; a quick start that slows into place by default. */
	easing?: string;
	/** Whether enters fade in and leaves fade out; `true` by default. Without it they appear and go at once. */
	fade?: boolean;
}

const DEFAULT_DURATION = 200;
const DEFAULT_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

function animate(element: Element, keyframes: Keyframe[], timing: KeyframeAnimationOptions) {
	return typeof element.animate === 'function' ? element.animate(keyframes, timing) : undefined;
}

/**
 * Slides a move from where it was drawn to its place, by `translate` layered over the element's own
 * with `composite: 'add'`. It stands at the start during a `delay`, for a stagger.
 */
export function slide({ element, x, y }: MotionMove, timing: KeyframeAnimationOptions = {}) {
	return animate(
		element,
		[{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }],
		{ duration: DEFAULT_DURATION, easing: DEFAULT_EASING, fill: 'backwards', ...timing, composite: 'add' },
	);
}

/** Fades an element in to its own opacity. It stays hidden during a `delay`. */
export function fadeIn(element: Element, timing: KeyframeAnimationOptions = {}) {
	return animate(element, [{ opacity: 0, offset: 0 }], { duration: DEFAULT_DURATION, easing: 'linear', fill: 'backwards', ...timing });
}

/**
 * Fades an element out from its own opacity, and holds it hidden: a leave goes once the transition
 * ends, not a frame after it shows again.
 */
export function fadeOut(element: Element, timing: KeyframeAnimationOptions = {}) {
	return animate(element, [{ opacity: 0 }], { duration: DEFAULT_DURATION, easing: 'linear', fill: 'forwards', ...timing });
}

/**
 * The engine of the Web Animations API, the default of the packages: moves `slide`, enters
 * `fadeIn`, leaves `fadeOut`. A move from farther than a screen away is not played: it would only
 * flash by. A reduced motion preference of the user plays nothing.
 */
export function webAnimations(options: WebAnimationsOptions = {}): MotionEngine {
	const { duration = DEFAULT_DURATION, easing = DEFAULT_EASING, fade = true } = options;

	if (duration <= 0) {
		return () => undefined;
	}

	return defineMotionEngine({
		move: move => slide(move, { duration, easing }),
		enter: fade ? element => fadeIn(element, { duration }) : undefined,
		// Without a fade, gone at once rather than when the moves end.
		leave: fade ? element => fadeOut(element, { duration }) : element => element.remove(),
		stop: animation => animation.cancel(),
	});
}
