import {
	type DragAnnouncements,
	type DragAutoScroll,
	type DragIndicator,
	type DragListTarget,
	type DragPayload,
	type DragTree,
	type DropPosition,
	useDragList,
} from '@vue-stack/drag-and-drop';
import type { MotionEngine } from '@vue-stack/flip';
import { getCellText } from '@vue-stack/table-core';
import { computed, getCurrentInstance, type MaybeRef, type MaybeRefOrGetter, type Ref, toValue, watch } from 'vue';

import { createRowDragContext } from '../components/context';
import type { DataTable } from '../data-table/use-data-table';
import { DRAG_HANDLE_SELECTOR } from '../pointer/controls';
import {
	createPreviewHolder,
	describeDragItem,
	getDraggableProps,
	resolveBounds,
	resolveIgnore,
	type TableDragBounds,
	type TableDragContext,
	type TableDragData,
} from './shared';

/** The kind of the payload a table row is dragged as: tables and drop zones take only this kind. */
export const TABLE_ROW_KIND = '@vue-stack/table:row';

/** What a dragged row carries to other tables and drop zones. */
export interface TableRowDragData<TRow = unknown> extends TableDragData {
	/** The table the row comes from. */
	table: DataTable<TRow>;
	row: TRow;
}

/** A place a row may be dropped at, for `canDrop`. */
export interface TableRowDropTarget<TRow> {
	/** The key of the dragged row. */
	key: string;
	row: TRow;
	/** The new parent; `null` for the top level. */
	parent: string | null;
	/** The place among the children of `parent`, counted once the row is taken out. */
	index: number;
	/** The row the place is next to or inside; `null` over an empty body. */
	over: string | null;
	position: DropPosition;
}

/** A row dropped on the table. */
export interface TableRowDropEvent<TRow> {
	/** The key of the dropped row. */
	key: string;
	row: TRow;
	/** The new parent; `null` for the top level, and always in a flat table. */
	parent: string | null;
	/** The place among the children of `parent`, counted once the row is taken out: what `moveRow` takes. */
	index: number;
	/** The row comes from another table of the group. */
	external: boolean;
	/** The table the row comes from: this one, or another of the group. */
	source: DataTable<TRow>;
}

/** A row of another table dragged over this one, for `canAccept`. */
export interface TableRowOffer<TRow = unknown> {
	row: TRow;
	/** The table it comes from. */
	source: DataTable<TRow>;
}

export interface TableRowDragOptions<TRow> {
	/**
	 * Drags start only on a `TableDragHandle` in the row, which also gives the keyboard a way to drag.
	 * Without it the whole row drags with a pointer, and controls in its cells keep their clicks.
	 */
	handle?: MaybeRefOrGetter<boolean | undefined>;
	/** A name shared by tables that take each other's rows; without it the table takes only its own. */
	group?: MaybeRefOrGetter<string | null | undefined>;
	/**
	 * What neither the pointer nor the ghost leaves: `'table'` by default, `'window'` in a `group`, so
	 * that a row can reach another table.
	 */
	bounds?: TableDragBounds;
	/** Whether rows can be dragged now; while the rows are not sorted by default, as order is then the sort's. */
	enabled?: MaybeRefOrGetter<boolean | undefined>;
	/**
	 * Whether a row can be dragged; every row by default. Asked when a drag would start and when a row
	 * renders its `data-tc-draggable`, so a change of what it reads renders only the rows it concerns.
	 */
	canDrag?: (row: TRow, key: string) => boolean;
	/** Whether a row may be dropped at a place; a place it may not is not shown. */
	canDrop?: (target: TableRowDropTarget<TRow>) => boolean;
	/** Whether to take a row from another table of the group; any by default. */
	canAccept?: (offer: TableRowOffer<TRow>) => boolean;
	/** In a tree: whether a row takes children dropped inside it; a group row by default. */
	canNest?: (row: TRow, key: string) => boolean;
	/**
	 * What inside a row never starts a drag, a selector, on top of the controls: links, buttons,
	 * fields, and the elements and roles of widgets with gestures or arrow keys of their own.
	 */
	ignore?: MaybeRefOrGetter<string | undefined>;
	/**
	 * How the place is shown, read when a drag starts: `'gap'` by default, where the rows move apart
	 * and the dragged one stands at its new place; `'line'` at the place; or `'mark'`, attributes alone.
	 */
	indicator?: MaybeRefOrGetter<DragIndicator | undefined>;
	/**
	 * The engine of the place, the ghost and the rows after a drop, read when a drag starts:
	 * `webAnimations()` by default, `false` for none. With `useTableMotion` a row still moves once: the
	 * later transition cuts the earlier short. A ref rather than a getter: an engine is a function
	 * itself.
	 */
	motion?: MaybeRef<MotionEngine | false | undefined>;
	/**
	 * Alt+↑ and Alt+↓ on a cell move its row one place among its siblings at once, through `onDrop`,
	 * with a handle or without. `true` by default.
	 */
	stepKeys?: MaybeRefOrGetter<boolean | undefined>;
	/** How long a finger rests on a row before it drags, ms; `250` by default. */
	touchDelay?: MaybeRefOrGetter<number | undefined>;
	/**
	 * How the table scrolls while a row nears its top or bottom, `false` for not at all. The zones
	 * start inside the sticky header and footer unless `margin` says otherwise.
	 */
	autoScroll?: MaybeRefOrGetter<DragAutoScroll | false | undefined>;
	/** The name of a row for screen readers; the text of its row header cell by default. */
	getLabel?: (row: TRow, key: string) => string;
	/** What screen readers hear during a keyboard drag; English by default. */
	announcements?: MaybeRefOrGetter<Partial<DragAnnouncements> | undefined>;
	/**
	 * A row was dropped on the table: move it in your data, such as with `moveRow`. To save the move on
	 * a server, move the row at once and move it back if the server refuses.
	 */
	onDrop: (event: TableRowDropEvent<TRow>) => void;
}

/** The row drag of a table, as `useTableRowDrag` returns it and `TableRowDrag` provides it. */
export interface TableRowDragList<TRow = unknown> extends TableDragContext {
	/** The shown row with key `key`, such as the one being dragged. */
	getRow: (key: string) => TRow | undefined;
	/** The payload being dragged that the table takes, own or from the group; `null` otherwise. */
	dragging: Readonly<Ref<DragPayload | null>>;
	/** Where the row goes if dropped now; `null` for nowhere. */
	target: Readonly<Ref<DragListTarget | null>>;
	/** Drags start only on a `TableDragHandle`. */
	readonly handle: boolean;
}

/**
 * Dragging the rows of a table with a pointer, a finger or the keyboard, over `@vue-stack/drag-and-drop`:
 * within the table, into and out of the groups of a tree, and between the tables of a `group`. The
 * rows of the body register themselves: call it in the component that renders the table, or use
 * `TableRowDrag` around the body. The table does not touch your rows: `onDrop` says where a row goes.
 *
 * The dragged row stays rendered under the row window, the table scrolls near its edges, the
 * keyboard drag goes through a `TableDragHandle`, and Alt+↑ and Alt+↓ on a cell move its row one
 * place. A drop into a collapsed group expands it. Options that are refs or getters are read when
 * they are needed, so they may change at any time.
 */
export function useTableRowDrag<TRow>(table: DataTable<TRow>, options: TableRowDragOptions<TRow>): TableRowDragList<TRow> {
	const { scope } = table;
	const preview = createPreviewHolder();

	function isHandle() {
		return toValue(options.handle) ?? false;
	}

	function hasStepKeys() {
		return toValue(options.stepKeys) ?? true;
	}

	function getRow(key: string) {
		const index = scope.getRowIndex(key);

		return index === -1 ? undefined : table.rows.value[index];
	}

	// The row of a payload: another table's from what it carries, since keys of two tables may match;
	// an own row as it is now, since it may have changed since the drag started.
	function getPayloadRow(payload: DragPayload | null | undefined) {
		const data = payload?.data as TableRowDragData<TRow> | undefined;

		if (data && data.table !== table) {
			return data.row;
		}

		return payload ? getRow(payload.key) : undefined;
	}

	function isEnabled() {
		return toValue(options.enabled) ?? scope.sort.value.length === 0;
	}

	function canDrag(key: string, row: unknown = getRow(key)) {
		return isEnabled() && row !== undefined && (options.canDrag?.(row as TRow, key) ?? true);
	}

	function getLabel(key: string, row: unknown = getRow(key)) {
		if (row === undefined) {
			return key;
		}

		if (options.getLabel) {
			return options.getLabel(row as TRow, key);
		}

		const header = scope.columns.value.find(item => item.rowHeader && item.column)?.column;

		return header ? getCellText(header, row) || key : key;
	}

	function getBounds() {
		return resolveBounds(options.bounds, toValue(options.group) ? 'window' : 'table', table.root.value);
	}

	const tree: DragTree | undefined = table.tree && {
		getParent: key => table.tree?.getNode(key)?.parent ?? null,
		getLevel: key => table.tree?.getNode(key)?.level ?? 0,
		getChildren: parent => table.tree?.getChildren(parent) ?? [],
		canNest: (key) => {
			const row = getRow(key);
			const { canNest } = options;

			if (canNest) {
				return row !== undefined && canNest(row, key);
			}

			return table.tree?.getNode(key)?.group ?? false;
		},
		isExpanded: key => table.tree?.isExpanded(key) ?? false,
	};

	let collapsed: string | null = null;

	const list = useDragList({
		kind: TABLE_ROW_KIND,
		axis: 'vertical',
		keys: () => scope.rowKeys.value,
		container: table.body,
		scroller: table.root,
		bounds: getBounds,
		handle: () => (isHandle() ? DRAG_HANDLE_SELECTOR : undefined),
		ignore: () => resolveIgnore(options.ignore),
		canDrag: key => canDrag(key),
		touchDelay: () => toValue(options.touchDelay),
		autoScroll: () => {
			const own = toValue(options.autoScroll);

			return own === false
				? false
				: { ...own, margin: own?.margin ?? { top: table.headHeight.value, bottom: table.footHeight.value } };
		},
		group: options.group,
		tree,
		indicator: () => toValue(options.indicator) ?? 'gap',
		motion: options.motion,
		stepKeys: hasStepKeys,
		announcements: () => toValue(options.announcements),
		getLabel: key => getLabel(key),
		getData: (key): TableRowDragData<TRow | undefined> => ({ table, row: getRow(key), label: getLabel(key) }),
		canAccept: ({ payload, external }) => {
			const data = payload.data as TableRowDragData<TRow> | undefined;

			return !external || (data !== undefined && (options.canAccept?.({ row: data.row, source: data.table }) ?? true));
		},
		canDrop: (key, target) => {
			const row = getPayloadRow(list.dragging.value) ?? getRow(key);

			return row !== undefined && (options.canDrop?.({
				key,
				row,
				parent: target.parent,
				index: target.index,
				over: target.key,
				position: target.position,
			}) ?? true);
		},
		reveal: (key) => {
			const index = scope.getRowIndex(key);

			if (index !== -1) {
				scope.scrollToRow(index, 'auto');
			}
		},
		get preview() {
			return preview.get();
		},
		onDrop: ({ key, parent, index, payload, external }) => {
			const data = payload.data as TableRowDragData<TRow> | undefined;
			const row = getPayloadRow(payload);

			if (row === undefined) {
				return;
			}

			options.onDrop({ key, row, parent, index, external, source: external && data ? data.table : table });

			if (parent !== null) {
				table.tree?.setExpanded(parent, true);
			}
		},
	});

	// A dragged group closes while it moves, so that it is one row under the pointer rather than a
	// block of its subtree, and opens again at its new place.
	watch(list.active, (key, previous) => {
		if (key !== null && table.tree?.isExpanded(key) && table.tree.getChildren(key).length > 0) {
			table.tree.setExpanded(key, false);
			collapsed = key;
		}

		if (key === null && previous !== null && collapsed === previous) {
			collapsed = null;

			if (scope.getRowIndex(previous) !== -1) {
				table.tree?.setExpanded(previous, true);
			}
		}
	});

	// The dragged row stays rendered while the window scrolls away from it.
	scope.keepRendered({
		rows: () => {
			const index = list.active.value === null ? -1 : scope.getRowIndex(list.active.value);

			return index === -1 ? [] : [index];
		},
	});

	const drag: TableRowDragList<TRow> = {
		register: list.list.register,
		getItemProps: (key, row) => getDraggableProps(canDrag(key, row), hasStepKeys()),
		active: list.active,
		get describedBy() {
			return list.describedBy;
		},
		canDrag,
		getLabel,
		setPreview: preview.set,
		getRow,
		dragging: list.dragging,
		item: computed(() => describeDragItem(list.dragging.value, table as DataTable)),
		over: list.over,
		allowed: computed(() => list.over.value && list.target.value !== null),
		target: list.target,
		get handle() {
			return isHandle();
		},
	};

	// The rows below the component that calls it find the drag list and register with it.
	if (getCurrentInstance()) {
		createRowDragContext(drag);
	}

	return drag;
}
