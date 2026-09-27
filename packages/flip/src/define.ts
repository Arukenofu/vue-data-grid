import type { MotionEngine, MotionMove, MotionTransition } from './model';

/**
 * What an engine of `defineMotionEngine` starts: an animation of the Web Animations API, something
 * with a `finished` promise, such as an animation of Motion, or a thenable, such as a promise or a
 * timeline of GSAP. A thenable is loose on purpose: libraries type their `then` their own way.
 */
export type MotionAnimation =
	| Animation
	| { readonly finished: PromiseLike<unknown> }
	| { then: (onFulfilled: () => unknown, onRejected: (reason: unknown) => unknown) => unknown };

/** An animation, a list of them, or nothing to play. */
type Played<T> = T | readonly T[] | undefined | void;

/**
 * An engine for `defineMotionEngine`: how each element moves, comes and goes, or how the transition
 * plays as a whole, and how that stops. Every part is optional, and what they start plays together.
 */
export interface MotionEngineDefinition<T extends MotionAnimation> {
	/** Plays an element that moved; `index` is its place among the moves, for a stagger. */
	move?: (move: MotionMove, index: number, transition: MotionTransition) => Played<T>;
	/** Plays an element that came. */
	enter?: (element: Element, index: number, transition: MotionTransition) => Played<T>;
	/** Plays an element that goes; it is removed once the transition ends. */
	leave?: (element: Element, index: number, transition: MotionTransition) => Played<T>;
	/** Plays the transition as a whole, such as one timeline of every element. */
	play?: (transition: MotionTransition) => Played<T>;
	/**
	 * Puts an animation in its final state at once, when the transition is cut short. Without it,
	 * animations of the Web Animations API are cancelled, and others are left to the engine, which
	 * sees the `signal` of the transition.
	 */
	stop?: (animation: T) => void;
	/**
	 * Whether to play for a user who prefers reduced motion: `'skip'`, the default, plays nothing and
	 * calls nothing.
	 */
	reducedMotion?: 'skip' | 'play';
	/**
	 * Whether to play a move from farther than a screen away: `'skip'`, the default, leaves it out,
	 * since it would only flash by.
	 */
	farMoves?: 'skip' | 'play';
}

/** Whether the user asks for reduced motion. */
export function prefersReducedMotion() {
	return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isNear({ x, y }: MotionMove) {
	return Math.abs(x) <= window.innerWidth && Math.abs(y) <= window.innerHeight;
}

function cancel(animation: MotionAnimation) {
	if (typeof Animation === 'function' && animation instanceof Animation) {
		animation.cancel();
	}
}

function toFinished(animation: MotionAnimation) {
	const finished: unknown = 'finished' in animation ? animation.finished : animation;

	// A cancelled animation rejects: the transition is over all the same.
	return Promise.resolve(finished).then(() => undefined, () => undefined);
}

/**
 * Makes an engine from how each element moves, comes and goes, and keeps the rest of the contract
 * for it: a reduced motion preference of the user plays nothing, moves from farther than a screen
 * away are left out, a transition that is cut short stops every animation, and the transition ends
 * once they have all finished. A function alone plays the transition as a whole.
 *
 * ```ts
 * const engine = defineMotionEngine({
 * 	move: (move, index) => slide(move, { delay: index * 20 }),
 * 	enter: element => fadeIn(element),
 * });
 * ```
 */
export function defineMotionEngine<T extends MotionAnimation>(
	definition: MotionEngineDefinition<T> | NonNullable<MotionEngineDefinition<T>['play']>,
): MotionEngine {
	const options: MotionEngineDefinition<T> = typeof definition === 'function' ? { play: definition } : definition;
	const { stop = cancel, reducedMotion = 'skip', farMoves = 'skip' } = options;

	return (transition) => {
		if (reducedMotion === 'skip' && prefersReducedMotion()) {
			return undefined;
		}

		const moves = farMoves === 'skip' ? transition.moves.filter(isNear) : transition.moves;
		const played = moves.length === transition.moves.length ? transition : { ...transition, moves };
		const animations: T[] = [];

		function collect(result: Played<T>) {
			if (Array.isArray(result)) {
				animations.push(...(result as readonly T[]));
			} else if (result) {
				animations.push(result as T);
			}
		}

		collect(options.play?.(played));
		played.moves.forEach((move, index) => collect(options.move?.(move, index, played)));
		played.enters.forEach((element, index) => collect(options.enter?.(element, index, played)));
		played.leaves.forEach((element, index) => collect(options.leave?.(element, index, played)));

		if (animations.length === 0) {
			return undefined;
		}

		transition.signal.addEventListener('abort', () => {
			for (const animation of animations) {
				stop(animation);
			}
		}, { once: true });

		return Promise.all(animations.map(toFinished));
	};
}
