import { type DragAnnouncements, type DragAutoScroll, type DragIndicator, type DragPayload, useDragList } from '@vue-stack/drag-and-drop';
import type { MotionEngine } from '@vue-stack/flip';
import type { RuntimeColumn } from '@vue-stack/table-core';
import { computed, getCurrentInstance, type MaybeRef, type MaybeRefOrGetter, type Ref, toValue } from 'vue';

import { createColumnDragContext } from '../components/context';
import type { DataTable } from '../data-table/use-data-table';
import { createColumnShift } from './column-shift';
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

/** The kind of the payload a column is dragged as. */
export const TABLE_COLUMN_KIND = '@vue-stack/table:column';

/** What a dragged column carries to drop zones. */
export interface TableColumnDragData extends TableDragData {
	column: RuntimeColumn;
}

/** A column dropped at its new place, after the table has moved it. */
export interface TableColumnDropEvent {
	name: string;
	/** Its place among the shown columns. */
	index: number;
}

export interface TableColumnDragOptions {
	/** What neither the pointer nor the ghost leaves; `'table'` by default. */
	bounds?: TableDragBounds;
	/** Whether columns can be dragged now; `true` by default. */
	enabled?: MaybeRefOrGetter<boolean | undefined>;
	/**
	 * Whether a column may go to `index` among the shown columns, on top of what the layout allows: a
	 * `movable` column, within its pinned side and around a `keepTogether` group.
	 */
	canDrop?: (name: string, index: number) => boolean;
	/** What inside a header cell never starts a drag, a selector, on top of the controls. */
	ignore?: MaybeRefOrGetter<string | undefined>;
	/**
	 * How the place is shown, read when a drag starts: `'gap'` by default, where the columns move apart
	 * and the dragged one stands at its new place, each a whole column; `'line'` between the headers;
	 * or `'mark'`, attributes alone.
	 */
	indicator?: MaybeRefOrGetter<DragIndicator | undefined>;
	/**
	 * The engine of the place and the ghost, read when a drag starts: `webAnimations()` by default,
	 * `false` for none. The columns move after a drop with `useTableMotion`. A ref rather than a
	 * getter: an engine is a function itself.
	 */
	motion?: MaybeRef<MotionEngine | false | undefined>;
	/** How long a finger rests on a header before it drags, ms; `250` by default. */
	touchDelay?: MaybeRefOrGetter<number | undefined>;
	/**
	 * How the table scrolls while a column nears its start or end, `false` for not at all. `margin`
	 * keeps the zones clear of pinned columns.
	 */
	autoScroll?: MaybeRefOrGetter<DragAutoScroll | false | undefined>;
	/** The name of a column for screen readers; its label by default. */
	getLabel?: (column: RuntimeColumn) => string;
	announcements?: MaybeRefOrGetter<Partial<DragAnnouncements> | undefined>;
	/** A column was dropped and moved. */
	onDrop?: (event: TableColumnDropEvent) => void;
}

/** The column drag of a table, as `useTableColumnDrag` returns it and `TableColumnDrag` provides it. */
export interface TableColumnDragList extends TableDragContext {
	/** The declared column named `name`. */
	getColumn: (name: string) => RuntimeColumn | undefined;
	/** The payload being dragged that the header takes; `null` otherwise. */
	dragging: Readonly<Ref<DragPayload | null>>;
}

/**
 * Dragging the column headers of a table to reorder the columns, with a pointer or a finger, over
 * `@vue-stack/drag-and-drop`. The order is the table's layout, so the drop moves the column itself,
 * with `scope.moveColumnTo`. Only `movable` columns drag, and only to places the layout allows. The
 * keyboard moves columns with Alt+← and Alt+→ of the header cell instead; `useTableMotion` animates
 * those moves, and a drop in any mode but `'gap'`, where the columns already stand in their places.
 *
 * The header cells register themselves: call it in the component that renders the table, or use
 * `TableColumnDrag` around the header.
 */
export function useTableColumnDrag(table: DataTable, options: TableColumnDragOptions = {}): TableColumnDragList {
	const { scope } = table;
	const preview = createPreviewHolder();
	const columnShift = createColumnShift(table);
	const names = computed(() => scope.columns.value.flatMap(item => (item.column ? [item.column.name] : [])));

	function getColumn(name: string) {
		return scope.getColumn(name)?.column ?? undefined;
	}

	function getLabel(name: string) {
		const column = getColumn(name);

		return column ? options.getLabel?.(column) ?? column.label ?? name : name;
	}

	function getBounds() {
		return resolveBounds(options.bounds, 'table', table.root.value);
	}

	function canDrag(name: string) {
		return (toValue(options.enabled) ?? true) && (getColumn(name)?.movable ?? false);
	}

	const list = useDragList({
		kind: TABLE_COLUMN_KIND,
		axis: 'horizontal',
		keys: names,
		container: table.head,
		scroller: table.root,
		bounds: getBounds,
		ignore: () => resolveIgnore(options.ignore),
		canDrag,
		touchDelay: () => toValue(options.touchDelay),
		autoScroll: () => toValue(options.autoScroll),
		// Header cells sort on Space and Enter; Alt with the arrows moves a column instead.
		keyboard: false,
		indicator: () => toValue(options.indicator) ?? 'gap',
		motion: options.motion,
		// A header cell is one cell of its column: the table moves them all.
		shift: columnShift.shift,
		// The header cells alone would slide: the columns slide with `useTableMotion`.
		settle: false,
		announcements: () => toValue(options.announcements),
		getLabel,
		getData: (name): Partial<TableColumnDragData> => ({ table, column: getColumn(name), label: getLabel(name) }),
		canDrop: (name, target) => scope.canMoveColumnTo(name, target.index)
			&& (options.canDrop?.(name, target.index) ?? true),
		reveal: name => scope.scrollToColumn(name),
		get preview() {
			return preview.get();
		},
		onDrop: ({ key, index, external }) => {
			// A place the layout refuses is never offered, so the drop always moves the column. The
			// columns keep their shifts until the re-render, which puts them where the gap drew them.
			if (!external) {
				scope.moveColumnTo(key, index);
				options.onDrop?.({ name: key, index });
			}
		},
	});

	// The dragged header stays rendered while the column window scrolls away from it.
	scope.keepRendered({ columns: () => (list.active.value === null ? [] : [list.active.value]) });

	const drag: TableColumnDragList = {
		register: list.list.register,
		getItemProps: name => getDraggableProps(canDrag(name)),
		active: list.active,
		// Header cells move with Alt and the arrows, as their own keys: there is no keyboard drag.
		describedBy: undefined,
		canDrag,
		getLabel,
		setPreview: preview.set,
		getColumn,
		dragging: list.dragging,
		item: computed(() => describeDragItem(list.dragging.value, table)),
		over: list.over,
		allowed: computed(() => list.over.value && list.target.value !== null),
	};

	// The header cells below the component that calls it find the drag list and register with it.
	if (getCurrentInstance()) {
		createColumnDragContext(drag);
	}

	return drag;
}
