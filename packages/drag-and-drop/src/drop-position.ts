import type { DragDestination, DropPosition } from './model';

/** Nesting of a list's items: it decides whose sibling or child a dropped item becomes. */
export interface DragTree {
	/** Parent of an item; `null` at the top level. Only keys of this list come here. */
	getParent: (key: string) => string | null;
	getLevel: (key: string) => number;
	/** Children of `parent` (`null` for the top level) in display order, collapsed or not. */
	getChildren: (parent: string | null) => readonly string[];
	/** The item takes children: an item can be dropped inside it. */
	canNest: (key: string) => boolean;
	/** The item's children are shown under it: the place right below it is the first among them. */
	isExpanded: (key: string) => boolean;
}

/** A drop place in a list, as the keyboard steps through them. */
export interface DropSlot extends DragDestination {
	/** The item the place is shown at. */
	key: string;
	position: DropPosition;
	/** Nesting level at which the place is drawn. */
	level: number;
}

/** The share of an item, around its middle, over which a drop goes inside it. */
const NEST_ZONE = { start: 0.25, end: 0.75 };

/** Where each position stands relative to its item, so slots sort in display order. */
const SLOT_OFFSET: Record<DropPosition, number> = { before: -0.4, inside: 0.2, after: 0.4 };

/** A tree of one level: every key at the top, nothing nests. */
export function createFlatTree(getKeys: () => readonly string[]): DragTree {
	return {
		getParent: () => null,
		getLevel: () => 0,
		getChildren: parent => (parent === null ? getKeys() : []),
		canNest: () => false,
		isExpanded: () => false,
	};
}

/** Whether `key` is somewhere under `ancestor`: an item cannot be dropped into its own subtree. */
export function isInside(tree: DragTree, key: string, ancestor: string) {
	for (let parent = tree.getParent(key); parent !== null; parent = tree.getParent(parent)) {
		if (parent === ancestor) {
			return true;
		}
	}

	return false;
}

/**
 * The position over an item by how far along it the pointer is: `ratio` is `0` at the item's start
 * edge and `1` at its end edge. The middle of an item that nests means inside, and the second half of
 * an expanded item means its first child.
 */
export function resolvePosition(tree: DragTree, key: string, ratio: number): DropPosition {
	if (tree.canNest(key) && ratio >= NEST_ZONE.start && ratio < NEST_ZONE.end) {
		return 'inside';
	}

	if (ratio >= 0.5 && tree.isExpanded(key)) {
		return 'inside';
	}

	return ratio < 0.5 ? 'before' : 'after';
}

/**
 * The index among the children of `parent` once the source is taken out; `null` when the drop would
 * leave the source where it is.
 */
export function resolveSiblingIndex(
	tree: DragTree,
	source: string,
	parent: string | null,
	targetIndex: number,
	position: DropPosition,
) {
	const start = tree.getChildren(parent).indexOf(source);
	let index = position === 'before' ? targetIndex : targetIndex + 1;

	if (start === -1) {
		return index;
	}

	if (start < index) {
		index -= 1;
	}

	return index === start ? null : index;
}

/** Where `source` lands when dropped at `position` of `target`; `null` when nothing would change. */
export function resolveDestination(
	tree: DragTree,
	source: string,
	target: string,
	position: DropPosition,
): DragDestination | null {
	if (position === 'inside') {
		return tree.getChildren(target)[0] === source ? null : { parent: target, index: 0 };
	}

	const parent = tree.getParent(target);
	const targetIndex = tree.getChildren(parent).indexOf(target);

	if (targetIndex === -1) {
		return null;
	}

	const index = resolveSiblingIndex(tree, source, parent, targetIndex, position);

	return index === null ? null : { parent, index };
}

/**
 * Every place `source` can go, in display order of `keys` (the shown items): before an item, inside
 * it and after it. Places that lead to the same destination, such as after one item and before the
 * next, come once; places inside the source's own subtree and places `canDrop` rejects do not come.
 */
export function collectDropSlots(
	tree: DragTree,
	keys: readonly string[],
	source: string,
	canDrop?: (slot: DropSlot) => boolean,
) {
	const slots: (DropSlot & { order: number })[] = [];
	const seen = new Set<string>();

	keys.forEach((key, order) => {
		if (key === source || isInside(tree, key, source)) {
			return;
		}

		const expanded = tree.isExpanded(key);
		const positions: DropPosition[] = ['before'];

		if (tree.canNest(key) || expanded) {
			positions.push('inside');
		}

		if (!expanded) {
			positions.push('after');
		}

		for (const position of positions) {
			const destination = resolveDestination(tree, source, key, position);
			const id = destination ? `${destination.parent ?? ''}\u0000${destination.index}` : '';

			if (!destination || seen.has(id)) {
				continue;
			}

			const slot: DropSlot = {
				...destination,
				key,
				position,
				level: tree.getLevel(key) + (position === 'inside' ? 1 : 0),
			};

			if (canDrop?.(slot) ?? true) {
				seen.add(id);
				slots.push({ ...slot, order: order + SLOT_OFFSET[position] });
			}
		}
	});

	return slots;
}

/** The place of `source` itself: its parent and index, for "position 3 of 10". */
export function getOwnDestination(tree: DragTree, source: string): DragDestination {
	const parent = tree.getParent(source);

	return { parent, index: Math.max(tree.getChildren(parent).indexOf(source), 0) };
}

/** A destination as a 1-based position among the siblings it will have. */
export function describeDestination(tree: DragTree, source: string, destination: DragDestination) {
	const siblings = tree.getChildren(destination.parent);

	return {
		position: destination.index + 1,
		total: siblings.includes(source) ? siblings.length : siblings.length + 1,
	};
}
