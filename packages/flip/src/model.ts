/** An element already drawn at its new place, to look as if it came from `x`, `y` px away from there. */
export interface MotionMove {
	element: Element;
	x: number;
	y: number;
}

/**
 * A change that has already happened in the DOM, for an engine to make it look continuous. Every
 * element is in its final state when the engine is called: a move stands at its new place, an enter
 * is shown, a leave is a still element standing where the thing that left was.
 */
export interface MotionTransition {
	/** What changed, named by whoever changed it: `'rows'` of a table, `'gap'` of a drag, your own. */
	kind: string;
	/** Elements that changed places. */
	moves: readonly MotionMove[];
	/** Elements that appeared. */
	enters: readonly Element[];
	/** Elements to see off; they are removed from the DOM once the transition ends. */
	leaves: readonly Element[];
	/** Whatever the one who started the change passed along, such as why it happened. */
	context: unknown;
	/**
	 * Aborted when the transition is cut short: a new change of the same elements, or its owner going
	 * away. The engine then puts every element in its final state at once, synchronously.
	 */
	signal: AbortSignal;
}

/**
 * Plays a transition: the Web Animations API, GSAP, anime.js, Motion, CSS classes, or nothing. The
 * transition ends when the returned promise settles, or at once when nothing is returned.
 *
 * The engine animates over the styles of the elements and leaves them as they were: whoever changed
 * the DOM may position the elements by their inline styles, such as `translate`.
 */
export type MotionEngine = (transition: MotionTransition) => PromiseLike<unknown> | void;

/** A transition being played. */
export interface MotionPlayback {
	/** Settles once the engine is done or the transition is stopped; never rejects. */
	readonly finished: Promise<void>;
	/** Cuts the transition short: the engine puts the elements in their final state, and leaves go. */
	stop: () => void;
}

/** What `playMotion` plays: a transition without its `signal`, and with anything left out empty. */
export interface MotionChange {
	kind: string;
	moves?: readonly MotionMove[];
	enters?: readonly Element[];
	leaves?: readonly Element[];
	context?: unknown;
}
