import { captureLayout, type MotionEngine, stopMotion } from '@vue-stack/flip';

import { type DragTree, isInside } from './drop-position';
import { formatTranslate, measureLayout } from './layout';
import type { DragAxis, DragPoint, DropPosition } from './model';

/** An item's extent along the list, growing in display order: right-to-left rows run negative. */
interface Span {
	start: number;
	end: number;
}

/** The dragged item with the part of its subtree that is shown: they move as one block. */
interface Block {
	/** Display indexes: from the item to past its last shown descendant. */
	start: number;
	end: number;
	/** How far items after the block stand from it: its size and the spacing between items. */
	stride: number;
	spacing: number;
}

interface GapState {
	key: string;
	/** `null` for an item of another list: nothing here makes way for it but the gap. */
	block: Block | null;
	/** The display index the gap opens before; `null` for no gap. */
	index: number | null;
	/** How far the items past the gap move. */
	stride: number;
	/** How far the block moves to stand in the gap; `null` until the items that tell are rendered. */
	blockOffset: number | null;
	/** The gesture is over: items that mount now belong to the drop's re-render, not to the gap. */
	frozen: boolean;
}

export interface GapPlace {
	key: string | null;
	position: DropPosition;
}

export interface GapOptions {
	axis: DragAxis;
	tree: DragTree;
	/** Keys of the shown items in display order. */
	keys: () => readonly string[];
	/** Rendered items by key. */
	elements: ReadonlyMap<string, HTMLElement>;
	/** A horizontal list in a right-to-left container runs from the right edge. */
	isRtl: () => boolean;
	/**
	 * Draws the shifts of items instead of setting the `translate` of their elements, all that changed
	 * at once; see `DragListOptions.shift`.
	 */
	draw?: (shifts: ReadonlyMap<string, DragPoint>, engine: MotionEngine | null) => void;
}

interface Shift {
	element: HTMLElement;
	offset: number;
}

/**
 * Items moving apart where the dragged one would go. Every shift is a function of an item's display
 * index, never of what is in the DOM: an item that mounts mid-gesture, under a virtual window, takes
 * its place at once. The DOM only tells the sizes: of the dragged block when the gesture starts, and
 * of the items at the gap. Items that are not rendered are taken as the size of the dragged one.
 *
 * Shifts go to the `translate` of items, so layout never changes: hit testing measures items
 * without it, and a drop re-renders them exactly where the gap showed them.
 */
export function createGap(options: GapOptions) {
	const shifted = new Map<HTMLElement, number>();
	const drawn = new Map<string, number>();

	let state: GapState | null = null;
	let engine: MotionEngine | null = null;
	let indexedKeys: readonly string[] | null = null;
	let indexes = new Map<string, number>();

	function readKeys() {
		const keys = options.keys();

		if (keys === indexedKeys) {
			return keys;
		}

		indexedKeys = keys;
		indexes = new Map(keys.map((key, index) => [key, index]));

		const start = state?.block ? indexes.get(state.key) : undefined;

		// The shown items changed mid-gesture: the block finds its new place, and keeps its size unless
		// its own subtree was shown or hidden, such as a dragged group that collapses.
		if (state?.block && start !== undefined) {
			const end = skipSubtree(keys, start);
			const resized = end - start !== state.block.end - state.block.start;

			state.block = (resized ? measureBlock(keys, start) : null) ?? { ...state.block, start, end };
		}

		return keys;
	}

	function measure(key: string | undefined): Span | null {
		const element = key === undefined ? undefined : options.elements.get(key);

		if (!element) {
			return null;
		}

		const rect = measureLayout(element);

		if (options.axis === 'vertical') {
			return { start: rect.top, end: rect.bottom };
		}

		return options.isRtl() ? { start: -rect.right, end: -rect.left } : { start: rect.left, end: rect.right };
	}

	function toPoint(offset: number): DragPoint {
		if (options.axis === 'vertical') {
			return { x: 0, y: offset };
		}

		return { x: options.isRtl() ? -offset : offset, y: 0 };
	}

	/** The display index past an item and the part of its subtree that is shown. */
	function skipSubtree(keys: readonly string[], index: number) {
		let end = index + 1;

		while (end < keys.length && isInside(options.tree, keys[end], keys[index])) {
			end += 1;
		}

		return end;
	}

	function measureBlock(keys: readonly string[], start: number): Block | null {
		const end = skipSubtree(keys, start);
		const first = measure(keys[start]);

		if (!first) {
			return null;
		}

		let last = first.end;
		let missing = 0;

		for (let index = start + 1; index < end; index += 1) {
			const span = measure(keys[index]);

			if (span) {
				last = Math.max(last, span.end);
			} else {
				missing += 1;
			}
		}

		const next = measure(keys[end]);
		const previous = start > 0 ? measure(keys[start - 1]) : null;
		const spacing = next && missing === 0 ? next.start - last : previous ? first.start - previous.end : 0;
		const size = last - first.start + missing * (first.end - first.start + spacing);

		return { start, end, stride: size + spacing, spacing };
	}

	function findGapIndex(keys: readonly string[], place: GapPlace | null) {
		const at = place?.key === null || place?.key === undefined ? undefined : indexes.get(place.key);

		if (!place || at === undefined) {
			return null;
		}

		if (place.position === 'before') {
			return at;
		}

		if (place.position === 'inside') {
			// Into a collapsed item the dragged one disappears: there is no place in the list to open.
			return options.tree.isExpanded(keys[at]) ? at + 1 : null;
		}

		return skipSubtree(keys, at);
	}

	/** The block stands where the gap is, measured from items that do not move themselves. */
	function resolveBlockOffset(keys: readonly string[], block: Block, index: number) {
		if (index >= block.start && index <= block.end) {
			return 0;
		}

		const own = measure(keys[block.start]);
		const at = measure(keys[index]);
		const before = index > 0 ? measure(keys[index - 1]) : null;
		const landing = at ? at.start : before ? before.end + block.spacing : null;

		if (!own || landing === null) {
			return null;
		}

		return landing - (index > block.end ? block.stride : 0) - own.start;
	}

	/** An item of another list is taken as the size of the items at the gap. */
	function measureForeignStride(keys: readonly string[], index: number) {
		const at = measure(keys[index]);
		const before = index > 0 ? measure(keys[index - 1]) : null;
		const reference = at ?? before;
		const spacing = at && before ? at.start - before.end : 0;

		return reference ? reference.end - reference.start + spacing : 0;
	}

	function resolve(current: GapState) {
		const keys = readKeys();

		if (current.index === null) {
			current.blockOffset = 0;
			current.stride = current.block?.stride ?? 0;
		} else if (current.block) {
			current.blockOffset = resolveBlockOffset(keys, current.block, current.index);
			current.stride = current.block.stride;
		} else {
			current.blockOffset = 0;
			current.stride = measureForeignStride(keys, current.index);
		}
	}

	function offsetOf(key: string) {
		const index = indexes.get(key);

		if (!state || state.index === null || index === undefined) {
			return 0;
		}

		const { block, index: gap, stride } = state;

		if (!block) {
			return index >= gap ? stride : 0;
		}

		if (index >= block.start && index < block.end) {
			return state.blockOffset ?? 0;
		}

		if (gap > block.end && index >= block.end && index < gap) {
			return -stride;
		}

		return gap < block.start && index >= gap && index < block.start ? stride : 0;
	}

	/** Items drawn by their owner move by key: the owner puts elements that mount later in place. */
	function draw(offsets: Iterable<readonly [string, number]>, animated: boolean) {
		const shifts = new Map<string, DragPoint>();

		for (const [key, offset] of offsets) {
			if ((drawn.get(key) ?? 0) === offset) {
				continue;
			}

			if (offset === 0) {
				drawn.delete(key);
			} else {
				drawn.set(key, offset);
			}

			shifts.set(key, toPoint(offset));
		}

		if (shifts.size > 0) {
			options.draw?.(shifts, animated ? engine : null);
		}
	}

	/** Every read before the first write: a read after a write would make the browser restyle for each item. */
	function shift(items: Iterable<readonly [string, HTMLElement]>, animated: boolean) {
		if (options.draw) {
			draw([...items].map(([key]) => [key, offsetOf(key)] as const), animated);

			return;
		}

		const changes: Shift[] = [];

		for (const [key, element] of items) {
			const offset = offsetOf(key);

			if ((shifted.get(element) ?? 0) !== offset) {
				changes.push({ element, offset });
			}
		}

		if (changes.length === 0) {
			return;
		}

		const elements = changes.map(change => change.element);
		// Where they are drawn now, a movement in progress included, which the capture cuts short.
		const capture = animated && engine ? captureLayout(elements) : null;

		if (!capture) {
			stopMotion(elements);
		}

		for (const { element, offset } of changes) {
			if (offset === 0) {
				shifted.delete(element);
				element.style.removeProperty('translate');
			} else {
				shifted.set(element, offset);
				element.style.setProperty('translate', formatTranslate(toPoint(offset)));
			}
		}

		capture?.animate(elements, engine, { kind: 'gap' });
	}

	function apply() {
		readKeys();
		shift(options.elements, true);
	}

	return {
		/** A payload is dragged: `own` when it is this list's item, whose block is measured now. */
		begin(key: string, own: boolean, movement: MotionEngine | null) {
			const keys = readKeys();
			const start = own ? indexes.get(key) : undefined;
			const block = start === undefined ? null : measureBlock(keys, start);

			engine = movement;
			// An own item that is not rendered cannot be measured: the list then only marks the place.
			state = own && !block
				? null
				: { key, block, index: null, stride: block?.stride ?? 0, blockOffset: 0, frozen: false };
		},

		/** The place changed: items move apart there, or back together for `null`. */
		place(place: GapPlace | null) {
			if (!state || state.frozen) {
				return;
			}

			state.index = findGapIndex(readKeys(), place);
			resolve(state);
			apply();
		},

		/** An item mounted mid-gesture: it takes its place at once. */
		mount(key: string, element: HTMLElement) {
			if (!state || state.frozen) {
				return;
			}

			readKeys();

			const unresolved = state.blockOffset === null || (state.index !== null && state.stride === 0);

			if (unresolved) {
				resolve(state);
			}

			shift([[key, element]], false);

			if (unresolved) {
				apply();
			}
		},

		unmount(element: HTMLElement) {
			if (shifted.delete(element)) {
				element.style.removeProperty('translate');
			}

			stopMotion([element]);
		},

		/** The gesture ended: the items stay apart until `clear`, whatever mounts meanwhile. */
		freeze() {
			if (state) {
				state.frozen = true;
			}
		},

		/** Takes every shift off without movement: the drop re-rendered the items where they were drawn. */
		clear() {
			state = null;

			stopMotion(shifted.keys());

			for (const element of shifted.keys()) {
				element.style.removeProperty('translate');
			}

			shifted.clear();
			draw([...drawn.keys()].map(key => [key, 0] as const), false);
		},
	};
}

export type Gap = ReturnType<typeof createGap>;
