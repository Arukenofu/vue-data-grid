import type { DragAnnouncements, DragAutoScroll, DragIndicator, DragListTarget } from '@vue-data-grid/drag-and-drop';
import type { MotionEngine } from '@vue-data-grid/flip';
import type { RuntimeColumn } from '@vue-data-grid/engine';
import { defineComponent, type PropType, type SlotsType, toRef, type VNodeChild } from 'vue';

import { useDataTableContext } from '../components/context';
import type { TableDragItem } from './shared';
import { type TableColumnDropEvent, useTableColumnDrag } from './use-table-column-drag';
import { type TableRowDropEvent, type TableRowDropTarget, type TableRowOffer, useTableRowDrag } from './use-table-row-drag';

/** What the default slot of `TableRowDrag` gets. Read only what you show: each read follows the drag. */
export interface TableRowDragSlotContext {
	/** The key of the row being dragged from this table, or `null`. */
	active: string | null;
	/** Whether a row the table takes is being dragged, own or from the group. */
	dragging: boolean;
	/** Whether it is over the body. */
	over: boolean;
	/** Whether it is over a place it may be dropped at. */
	allowed: boolean;
	/** Where it goes if dropped now; `null` for nowhere. */
	target: DragListTarget | null;
	/** What is dragged and from which table: own, or another of the group; `null` for nothing. */
	item: TableDragItem | null;
}

/** What the default slot of `TableColumnDrag` gets. */
export interface TableColumnDragSlotContext {
	/** The name of the column being dragged, or `null`. */
	active: string | null;
	/** Whether it is over the header. */
	over: boolean;
	/** Whether it is over a place it may be dropped at. */
	allowed: boolean;
	/** The column being dragged; `null` for none. */
	item: TableDragItem | null;
}

const sharedProps = {
	/** What neither the pointer nor the ghost leaves: `'table'`, `'window'` or an element. */
	bounds: { type: [String, Object] as PropType<'table' | 'window' | HTMLElement>, default: undefined },
	/** Whether dragging is on now. */
	enabled: { type: Boolean, default: undefined },
	/** How the place is shown: `'gap'` by default, where the items move apart, `'line'` or `'mark'`. */
	indicator: { type: String as PropType<DragIndicator>, default: undefined },
	/** The engine of the place, the ghost and the items: `webAnimations()` by default, `false` for none. */
	motion: { type: [Function, Boolean] as PropType<MotionEngine | false>, default: undefined },
	/** How long a finger rests before it drags, ms. */
	touchDelay: { type: Number, default: undefined },
	/** How the table scrolls while an item nears its edges: `{ threshold, speed, curve, smoothing, margin }`, or `false`. */
	autoScroll: { type: [Object, Boolean] as PropType<DragAutoScroll | false>, default: undefined },
	/** What screen readers hear during a keyboard drag. */
	announcements: { type: Object as PropType<Partial<DragAnnouncements>>, default: undefined },
	/** What inside an item never starts a drag, a selector, on top of the controls. */
	ignore: { type: String, default: undefined },
};

/**
 * Dragging the rows of the table: `useTableRowDrag` as a part. Put it around the `TableBody`, whose
 * rows then drag, and a `TableDragPreview` for the ghost. It renders no element: its default slot is
 * its content. The props are the options of `useTableRowDrag`, and `drop` its `onDrop`.
 */
export const TableRowDrag = defineComponent({
	name: 'TableRowDrag',
	props: {
		...sharedProps,
		/** Drags start only on a `TableDragHandle`, which also drags with the keyboard. */
		handle: { type: Boolean, default: false },
		/** Alt+↑ and Alt+↓ on a cell move its row one place; `true` by default. */
		stepKeys: { type: Boolean, default: undefined },
		/** A name shared by tables that take each other's rows. */
		group: { type: String, default: undefined },
		/** Whether a row can be dragged. */
		canDrag: { type: Function as PropType<(row: unknown, key: string) => boolean>, default: undefined },
		/** Whether a row may be dropped at a place. */
		canDrop: { type: Function as PropType<(target: TableRowDropTarget<unknown>) => boolean>, default: undefined },
		/** Whether to take a row from another table of the group. */
		canAccept: { type: Function as PropType<(offer: TableRowOffer) => boolean>, default: undefined },
		/** In a tree: whether a row takes children dropped inside it. */
		canNest: { type: Function as PropType<(row: unknown, key: string) => boolean>, default: undefined },
		/** The name of a row for screen readers. */
		getLabel: { type: Function as PropType<(row: unknown, key: string) => string>, default: undefined },
	},
	emits: {
		/** A row was dropped on the table: move it in your data, such as with `moveRow`. */
		drop: (_event: TableRowDropEvent<unknown>) => true,
	},
	slots: Object as SlotsType<{ default?: (context: TableRowDragSlotContext) => VNodeChild }>,
	setup(props, { emit, slots }) {
		const table = useDataTableContext();

		// Getters, so the composable reads the props as they are when it needs them.
		const drag = useTableRowDrag(table, {
			handle: () => props.handle,
			stepKeys: () => props.stepKeys,
			group: () => props.group,
			bounds: () => props.bounds,
			enabled: () => props.enabled,
			indicator: () => props.indicator,
			motion: toRef(() => props.motion),
			touchDelay: () => props.touchDelay,
			autoScroll: () => props.autoScroll,
			announcements: () => props.announcements,
			ignore: () => props.ignore,
			get canDrag() {
				return props.canDrag;
			},
			get canDrop() {
				return props.canDrop;
			},
			get canAccept() {
				return props.canAccept;
			},
			get canNest() {
				return props.canNest;
			},
			get getLabel() {
				return props.getLabel;
			},
			onDrop: event => emit('drop', event),
		});

		// Read lazily: a slot that shows nothing of the drag does not render again during one.
		const context: TableRowDragSlotContext = {
			get active() {
				return drag.active.value;
			},
			get dragging() {
				return drag.dragging.value !== null;
			},
			get over() {
				return drag.over.value;
			},
			get allowed() {
				return drag.allowed.value;
			},
			get target() {
				return drag.target.value;
			},
			get item() {
				return drag.item.value;
			},
		};

		return () => slots.default?.(context);
	},
});

/**
 * Dragging the column headers of the table: `useTableColumnDrag` as a part. Put it around the
 * `TableHeader`, whose `movable` columns then drag, and a `TableDragPreview` for the ghost. It
 * renders no element: its default slot is its content.
 */
export const TableColumnDrag = defineComponent({
	name: 'TableColumnDrag',
	props: {
		...sharedProps,
		/** Whether a column may go to a place, on top of what the layout allows. */
		canDrop: { type: Function as PropType<(name: string, index: number) => boolean>, default: undefined },
		/** The name of a column for screen readers. */
		getLabel: { type: Function as PropType<(column: RuntimeColumn) => string>, default: undefined },
	},
	emits: {
		/** A column was dropped and moved. */
		drop: (_event: TableColumnDropEvent) => true,
	},
	slots: Object as SlotsType<{ default?: (context: TableColumnDragSlotContext) => VNodeChild }>,
	setup(props, { emit, slots }) {
		const table = useDataTableContext();
		const drag = useTableColumnDrag(table, {
			bounds: () => props.bounds,
			enabled: () => props.enabled,
			indicator: () => props.indicator,
			motion: toRef(() => props.motion),
			touchDelay: () => props.touchDelay,
			autoScroll: () => props.autoScroll,
			announcements: () => props.announcements,
			ignore: () => props.ignore,
			get canDrop() {
				return props.canDrop;
			},
			get getLabel() {
				return props.getLabel;
			},
			onDrop: event => emit('drop', event),
		});

		const context: TableColumnDragSlotContext = {
			get active() {
				return drag.active.value;
			},
			get over() {
				return drag.over.value;
			},
			get allowed() {
				return drag.allowed.value;
			},
			get item() {
				return drag.item.value;
			},
		};

		return () => slots.default?.(context);
	},
});
