import type { DragGhostExit, DragPayload, DragPreview, DragPreviewPlacement } from '@vue-data-grid/drag-and-drop';
import type { RuntimeColumn } from '@vue-data-grid/engine';
import { type MaybeRefOrGetter, type Ref, toValue } from 'vue';

import type { GridDragItems } from '../components/context';
import type { DataGrid } from '../data-grid/use-data-grid';
import { CONTROL_SELECTOR, DRAGGABLE_ATTRIBUTE } from '../pointer/controls';

/**
 * The area neither the pointer nor the ghost leaves during a drag: `'grid'`, the scroll container of
 * the grid; `'window'`; or an element of your own.
 */
export type GridDragBounds = MaybeRefOrGetter<'grid' | 'window' | HTMLElement | null | undefined>;

/** Fills the ghost of a drag for item `key`; returns the cleanup, called when the ghost goes away. */
export type GridDragPreviewRender = (key: string, container: HTMLElement) => (() => void) | void;

/** How the ghost of a drag stands and goes, read when each gesture starts. */
export interface GridDragPreviewOptions {
	/** Where it stands: `'outside'` the pointer by default, `'center'` under it, or `'source'`, where the item was grabbed. */
	placement?: MaybeRefOrGetter<DragPreviewPlacement | undefined>;
	/**
	 * How it goes at the end: `'fade'` where it is by default; `'land'` flies into the item at its new
	 * place, for a ghost that looks like the item; `'none'` goes at once.
	 */
	exit?: MaybeRefOrGetter<DragGhostExit | undefined>;
}

/** What a dragged row or column carries to the grids and drop zones it passes over. */
export interface GridDragData {
	/** The grid it comes from. */
	grid: DataGrid;
	/** Its name, as screen readers hear it. */
	label: string;
}

/**
 * The row or column being dragged that a grid or a drop zone takes, as its parts show it: what it is
 * and where it comes from. A grid or a zone the bounds of the drag keep the pointer from never
 * hears of it: a drag kept to its grid shows nothing anywhere else.
 */
export interface GridDragItem {
	/** The key of the row, or the name of the column. */
	key: string;
	label: string;
	/** The dragged row; `undefined` for a column. */
	row: unknown;
	/** The dragged column; `undefined` for a row. */
	column: RuntimeColumn | undefined;
	/** The grid it comes from. */
	source: DataGrid;
	/** It comes from this very grid. */
	own: boolean;
}

/** The dragged item of a payload, seen from `grid`. */
export function describeDragItem(payload: DragPayload | null, grid: DataGrid | null): GridDragItem | null {
	const data = payload?.data as (GridDragData & { row?: unknown; column?: RuntimeColumn }) | undefined;

	if (!payload || !data?.grid) {
		return null;
	}

	return {
		key: payload.key,
		label: data.label,
		row: data.row,
		column: data.column,
		source: data.grid,
		own: data.grid === grid,
	};
}

/** What a drag list of the grid gives its parts on top of registering elements. */
export interface GridDragContext extends GridDragItems {
	/** The key of the item being dragged from this grid, or `null`. */
	readonly active: Readonly<Ref<string | null>>;
	/** The item being dragged that the grid takes, own or from another grid; `null` for none. */
	readonly item: Readonly<Ref<GridDragItem | null>>;
	/** Whether it is over the body, or the header for columns. */
	readonly over: Readonly<Ref<boolean>>;
	/** Whether it is over a place it may be dropped at. */
	readonly allowed: Readonly<Ref<boolean>>;
	/**
	 * The id of the hidden keyboard instructions, for `aria-describedby` of a drag handle; `undefined`
	 * while there is no keyboard drag to describe. It follows the text of the announcements.
	 */
	readonly describedBy: string | undefined;
	/**
	 * Whether item `key` may be dragged now. Give the row when you have it, as a part of the row does:
	 * without it the row is looked up in `rows`, which makes the caller follow every change of them.
	 */
	canDrag: (key: string, row?: unknown) => boolean;
	/** The name of item `key`, as screen readers hear it; the row as in `canDrag`. */
	getLabel: (key: string, row?: unknown) => string;
	/**
	 * Fills the ghost with `render`, as `GridDragPreview` does, until the returned function is
	 * called; without one the drag is shown by the place alone.
	 */
	setPreview: (render: GridDragPreviewRender, options?: GridDragPreviewOptions) => () => void;
}

/** What a drag never starts from: the controls, and `ignore` of your own on top. */
export function resolveIgnore(ignore: MaybeRefOrGetter<string | undefined>) {
	const own = toValue(ignore);

	return own ? `${CONTROL_SELECTOR}, ${own}` : CONTROL_SELECTOR;
}

// One frozen object each, shared by every item: the props of a part stay the same object.
const DRAGGABLE_PROPS = Object.freeze({ [DRAGGABLE_ATTRIBUTE]: '' });
const STEPPING_PROPS = Object.freeze({ [DRAGGABLE_ATTRIBUTE]: 'steps' });
const NO_PROPS = Object.freeze({});

/** The attributes of an item: `data-dg-draggable` while it may be dragged, `steps` with the step keys. */
export function getDraggableProps(draggable: boolean, steps = false): Readonly<Record<string, string>> {
	if (!draggable) {
		return NO_PROPS;
	}

	return steps ? STEPPING_PROPS : DRAGGABLE_PROPS;
}

/** The element of `bounds`: the grid's `root` for `'grid'`, `null` for the window. */
export function resolveBounds(bounds: GridDragBounds, fallback: 'grid' | 'window', root: HTMLElement | null) {
	const value = toValue(bounds) ?? fallback;

	if (value === 'grid') {
		return root;
	}

	return value === 'window' ? null : value;
}

/**
 * The ghost of a drag list as its parts fill it: a `DragPreview` while a renderer is set, none
 * otherwise, read by the list when each gesture starts.
 */
export function createPreviewHolder() {
	let current: DragPreview | null = null;

	function set(render: GridDragPreviewRender, options: GridDragPreviewOptions = {}) {
		const preview: DragPreview = {
			render,
			placement: () => toValue(options.placement) ?? 'outside',
			exit: () => toValue(options.exit) ?? 'fade',
		};

		current = preview;

		return () => {
			if (current === preview) {
				current = null;
			}
		};
	}

	return { set, get: () => current ?? undefined };
}
