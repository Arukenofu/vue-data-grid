import type { DragGhostExit, DragPayload, DragPreview, DragPreviewPlacement } from '@vue-data-grid/drag-and-drop';
import type { RuntimeColumn } from '@vue-data-grid/engine';
import { type MaybeRefOrGetter, type Ref, toValue } from 'vue';

import type { TableDragItems } from '../components/context';
import type { DataTable } from '../data-table/use-data-table';
import { CONTROL_SELECTOR, DRAGGABLE_ATTRIBUTE } from '../pointer/controls';

/**
 * The area neither the pointer nor the ghost leaves during a drag: `'table'`, the scroll container of
 * the table; `'window'`; or an element of your own.
 */
export type TableDragBounds = MaybeRefOrGetter<'table' | 'window' | HTMLElement | null | undefined>;

/** Fills the ghost of a drag for item `key`; returns the cleanup, called when the ghost goes away. */
export type TableDragPreviewRender = (key: string, container: HTMLElement) => (() => void) | void;

/** How the ghost of a drag stands and goes, read when each gesture starts. */
export interface TableDragPreviewOptions {
	/** Where it stands: `'outside'` the pointer by default, `'center'` under it, or `'source'`, where the item was grabbed. */
	placement?: MaybeRefOrGetter<DragPreviewPlacement | undefined>;
	/**
	 * How it goes at the end: `'fade'` where it is by default; `'land'` flies into the item at its new
	 * place, for a ghost that looks like the item; `'none'` goes at once.
	 */
	exit?: MaybeRefOrGetter<DragGhostExit | undefined>;
}

/** What a dragged row or column carries to the tables and drop zones it passes over. */
export interface TableDragData {
	/** The table it comes from. */
	table: DataTable;
	/** Its name, as screen readers hear it. */
	label: string;
}

/**
 * The row or column being dragged that a table or a drop zone takes, as its parts show it: what it is
 * and where it comes from. A table or a zone the bounds of the drag keep the pointer from never
 * hears of it: a drag kept to its table shows nothing anywhere else.
 */
export interface TableDragItem {
	/** The key of the row, or the name of the column. */
	key: string;
	label: string;
	/** The dragged row; `undefined` for a column. */
	row: unknown;
	/** The dragged column; `undefined` for a row. */
	column: RuntimeColumn | undefined;
	/** The table it comes from. */
	source: DataTable;
	/** It comes from this very table. */
	own: boolean;
}

/** The dragged item of a payload, seen from `table`. */
export function describeDragItem(payload: DragPayload | null, table: DataTable | null): TableDragItem | null {
	const data = payload?.data as (TableDragData & { row?: unknown; column?: RuntimeColumn }) | undefined;

	if (!payload || !data?.table) {
		return null;
	}

	return {
		key: payload.key,
		label: data.label,
		row: data.row,
		column: data.column,
		source: data.table,
		own: data.table === table,
	};
}

/** What a drag list of the table gives its parts on top of registering elements. */
export interface TableDragContext extends TableDragItems {
	/** The key of the item being dragged from this table, or `null`. */
	readonly active: Readonly<Ref<string | null>>;
	/** The item being dragged that the table takes, own or from another table; `null` for none. */
	readonly item: Readonly<Ref<TableDragItem | null>>;
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
	 * Fills the ghost with `render`, as `TableDragPreview` does, until the returned function is
	 * called; without one the drag is shown by the place alone.
	 */
	setPreview: (render: TableDragPreviewRender, options?: TableDragPreviewOptions) => () => void;
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

/** The element of `bounds`: the table's `root` for `'table'`, `null` for the window. */
export function resolveBounds(bounds: TableDragBounds, fallback: 'table' | 'window', root: HTMLElement | null) {
	const value = toValue(bounds) ?? fallback;

	if (value === 'table') {
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

	function set(render: TableDragPreviewRender, options: TableDragPreviewOptions = {}) {
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
