import { type DragAnnouncements, type DragAutoScroll, type DragIndicator, type DragPayload, useDragList } from '@vue-data-grid/drag-and-drop';
import type { MotionEngine } from '@vue-data-grid/flip';
import type { RuntimeColumn } from '@vue-data-grid/engine';
import { computed, getCurrentInstance, type MaybeRef, type MaybeRefOrGetter, type Ref, toValue } from 'vue';

import { createColumnDragContext } from '../components/context';
import type { DataGrid } from '../data-grid/use-data-grid';
import { createColumnShift } from './column-shift';
import {
	createPreviewHolder,
	describeDragItem,
	getDraggableProps,
	type GridDragBounds,
	type GridDragContext,
	type GridDragData,
	resolveBounds,
	resolveIgnore,
} from './shared';

/** The kind of the payload a column is dragged as. */
export const GRID_COLUMN_KIND = '@vue-data-grid/core:column';

/** What a dragged column carries to drop zones. */
export interface GridColumnDragData extends GridDragData {
	column: RuntimeColumn;
}

/** A column dropped at its new place, after the grid has moved it. */
export interface GridColumnDropEvent {
	name: string;
	/** Its place among the shown columns. */
	index: number;
}

export interface GridColumnDragOptions {
	/** What neither the pointer nor the ghost leaves; `'grid'` by default. */
	bounds?: GridDragBounds;
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
	 * `false` for none. The columns move after a drop with `useGridMotion`. A ref rather than a
	 * getter: an engine is a function itself.
	 */
	motion?: MaybeRef<MotionEngine | false | undefined>;
	/** How long a finger rests on a header before it drags, ms; `250` by default. */
	touchDelay?: MaybeRefOrGetter<number | undefined>;
	/**
	 * How the grid scrolls while a column nears its start or end, `false` for not at all. `margin`
	 * keeps the zones clear of pinned columns.
	 */
	autoScroll?: MaybeRefOrGetter<DragAutoScroll | false | undefined>;
	/** The name of a column for screen readers; its label by default. */
	getLabel?: (column: RuntimeColumn) => string;
	announcements?: MaybeRefOrGetter<Partial<DragAnnouncements> | undefined>;
	/** A column was dropped and moved. */
	onDrop?: (event: GridColumnDropEvent) => void;
}

/** The column drag of a grid, as `useGridColumnDrag` returns it and `GridColumnDrag` provides it. */
export interface GridColumnDragList extends GridDragContext {
	/** The declared column named `name`. */
	getColumn: (name: string) => RuntimeColumn | undefined;
	/** The payload being dragged that the header takes; `null` otherwise. */
	dragging: Readonly<Ref<DragPayload | null>>;
}

/**
 * Dragging the column headers of a grid to reorder the columns, with a pointer or a finger, over
 * `@vue-data-grid/drag-and-drop`. The order is the grid's layout, so the drop moves the column itself,
 * with `scope.moveColumnTo`. Only `movable` columns drag, and only to places the layout allows. The
 * keyboard moves columns with Alt+← and Alt+→ of the header cell instead; `useGridMotion` animates
 * those moves, and a drop in any mode but `'gap'`, where the columns already stand in their places.
 *
 * The header cells register themselves: call it in the component that renders the grid, or use
 * `GridColumnDrag` around the header.
 */
export function useGridColumnDrag(grid: DataGrid, options: GridColumnDragOptions = {}): GridColumnDragList {
	const { scope } = grid;
	const preview = createPreviewHolder();
	const columnShift = createColumnShift(grid);
	const names = computed(() => scope.columns.value.flatMap(item => (item.column ? [item.column.name] : [])));

	function getColumn(name: string) {
		return scope.getColumn(name)?.column ?? undefined;
	}

	function getLabel(name: string) {
		const column = getColumn(name);

		return column ? options.getLabel?.(column) ?? column.label ?? name : name;
	}

	function getBounds() {
		return resolveBounds(options.bounds, 'grid', grid.root.value);
	}

	function canDrag(name: string) {
		return (toValue(options.enabled) ?? true) && (getColumn(name)?.movable ?? false);
	}

	const list = useDragList({
		kind: GRID_COLUMN_KIND,
		axis: 'horizontal',
		keys: names,
		container: grid.head,
		scroller: grid.root,
		bounds: getBounds,
		ignore: () => resolveIgnore(options.ignore),
		canDrag,
		touchDelay: () => toValue(options.touchDelay),
		autoScroll: () => toValue(options.autoScroll),
		// Header cells sort on Space and Enter; Alt with the arrows moves a column instead.
		keyboard: false,
		indicator: () => toValue(options.indicator) ?? 'gap',
		motion: options.motion,
		// A header cell is one cell of its column: the grid moves them all.
		shift: columnShift.shift,
		// The header cells alone would slide: the columns slide with `useGridMotion`.
		settle: false,
		announcements: () => toValue(options.announcements),
		getLabel,
		getData: (name): Partial<GridColumnDragData> => ({ grid, column: getColumn(name), label: getLabel(name) }),
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

	const drag: GridColumnDragList = {
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
		item: computed(() => describeDragItem(list.dragging.value, grid)),
		over: list.over,
		allowed: computed(() => list.over.value && list.target.value !== null),
	};

	// The header cells below the component that calls it find the drag list and register with it.
	if (getCurrentInstance()) {
		createColumnDragContext(drag);
	}

	return drag;
}
