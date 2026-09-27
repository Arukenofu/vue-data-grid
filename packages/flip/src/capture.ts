import type { MotionEngine, MotionMove, MotionPlayback } from './model';
import { findRuns, playMotion } from './play';

/** An element to measure, keyed by itself, or a `[key, element]` pair, for an element that re-renders. */
export type LayoutItem<Key> = Element | readonly [Key, Element];

/** What moved and what came since a `captureLayout`. */
export interface LayoutChanges {
	moves: MotionMove[];
	/** Elements whose key was not captured. */
	enters: Element[];
}

export interface LayoutCapture<Key> {
	/**
	 * Measures the items again, once the DOM has changed: an item captured under the same key is a
	 * move from where it was drawn then, an item with a new key is an enter. Elements that a running
	 * transition was moving when the capture cut it short are moves too, from where they were drawn
	 * then, so that they carry on rather than jump. Only reads the DOM.
	 */
	compare: (items: Iterable<LayoutItem<Key>>) => LayoutChanges;
	/** `compare`, then plays the changes, and `leaves`, with `engine`: see `playMotion`. */
	animate: (
		items: Iterable<LayoutItem<Key>>,
		engine: MotionEngine | null | undefined,
		change: { kind: string; leaves?: readonly Element[]; context?: unknown },
	) => MotionPlayback;
}

interface Box {
	left: number;
	top: number;
}

/** Changes of less than a pixel are not moves: they would only blur. */
const THRESHOLD = 1;

function toEntry<Key>(item: LayoutItem<Key>): readonly [Key | Element, Element] {
	return item instanceof Element ? [item, item] : item;
}

function read(element: Element): Box {
	const { left, top } = element.getBoundingClientRect();

	return { left, top };
}

/**
 * The first step of a FLIP: measures where the items are drawn now, before a change of the DOM, and
 * cuts short the transitions they are in, so that the change starts from their final state. Call it
 * before the change, then `animate` or `compare` after it:
 *
 * ```ts
 * const capture = captureLayout(list.children);
 * items.value = shuffle(items.value);
 * await nextTick();
 * capture.animate(list.children, webAnimations(), { kind: 'shuffle' });
 * ```
 *
 * Every measurement comes before any write, so the browser lays the page out once.
 */
export function captureLayout<Key = Element>(items: Iterable<LayoutItem<Key>>): LayoutCapture<Key> {
	const before = new Map<Key | Element, Box>();
	const measured = new Set<Element>();

	for (const item of items) {
		const [key, element] = toEntry(item);

		before.set(key, read(element));
		measured.add(element);
	}

	const interrupted = findRuns(measured);
	// What the cut short transitions were moving besides the items: they carry on from where they are.
	const carried = new Map<Element, Box>();

	for (const run of interrupted) {
		for (const element of run.moves) {
			if (!measured.has(element) && !carried.has(element) && element.isConnected) {
				carried.set(element, read(element));
			}
		}
	}

	for (const run of interrupted) {
		run.stop();
	}

	function compare(after: Iterable<LayoutItem<Key>>): LayoutChanges {
		const moves: MotionMove[] = [];
		const enters: Element[] = [];
		const seen = new Set<Element>();

		function push(element: Element, from: Box) {
			const to = read(element);
			const x = from.left - to.left;
			const y = from.top - to.top;

			if (Math.abs(x) >= THRESHOLD || Math.abs(y) >= THRESHOLD) {
				moves.push({ element, x, y });
			}
		}

		for (const item of after) {
			const [key, element] = toEntry(item);
			const from = before.get(key);

			seen.add(element);

			if (from) {
				push(element, from);
			} else {
				enters.push(element);
			}
		}

		for (const [element, from] of carried) {
			if (!seen.has(element) && element.isConnected) {
				push(element, from);
			}
		}

		return { moves, enters };
	}

	return {
		compare,
		animate(after, engine, { kind, leaves, context }) {
			if (!engine) {
				return playMotion(null, { kind, leaves });
			}

			return playMotion(engine, { kind, ...compare(after), leaves, context });
		},
	};
}
