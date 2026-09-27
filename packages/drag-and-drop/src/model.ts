export type DragAxis = 'vertical' | 'horizontal';

/** Where the item lands relative to the target: next to it, or inside it as its first child. */
export type DropPosition = 'before' | 'after' | 'inside';

export interface DragPoint {
	x: number;
	y: number;
}

export interface DragRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/**
 * What is being dragged, the same shape for every list, so another list can accept or reject it
 * without knowing where it comes from.
 */
export interface DragPayload {
	/** What kind of thing this is, such as `'table-row'`: a list accepts only its own kind. */
	kind: string;
	key: string;
	/** The source list, one symbol for each: tells an own item from a foreign one. */
	origin: symbol;
	/** Name shared by lists that accept each other's items; `null` for a list on its own. */
	group: string | null;
	/** What the source attached to the key for other lists, which do not know that key. */
	data?: unknown;
}

/** Where the item was dropped: `index` among the children of `parent` once the item is taken out. */
export interface DragDestination {
	parent: string | null;
	index: number;
}

export interface DragDropEvent extends DragDestination {
	key: string;
	payload: DragPayload;
	/** The item came from another list: the list that took it has no such key. */
	external: boolean;
}

/** Set on the item being dragged: it stays in place, but may look lifted. */
export const DRAG_SOURCE_ATTRIBUTE = 'data-drag-source';

/** Set on the drop target; the value is the `DropPosition`. */
export const DROP_TARGET_ATTRIBUTE = 'data-drop-target';

/** Nesting level at which to draw the drop line, as an inline property of the target. */
export const DROP_LEVEL_PROPERTY = '--drop-level';

/** Set on the ghost under the pointer; the value is the payload's `kind`. */
export const DRAG_GHOST_ATTRIBUTE = 'data-drag-ghost';

/** Set on the item the ghost flies to at the end of a gesture, until it lands. */
export const DRAG_LANDING_ATTRIBUTE = 'data-drag-landing';

/** Set on the element of `indicator: 'line'` that slides between places; the value is the `DropPosition`. */
export const DROP_INDICATOR_ATTRIBUTE = 'data-drop-indicator';

/** Set on `<html>` for the duration of a gesture; the value is the payload's `kind`. */
export const DRAG_ACTIVE_ATTRIBUTE = 'data-dragging';
