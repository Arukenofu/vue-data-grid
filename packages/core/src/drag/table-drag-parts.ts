import { type DragGhostExit, type DragPayload, type DragPreviewPlacement, useDropTarget } from '@vue-data-grid/drag-and-drop';
import type { RuntimeColumn } from '@vue-data-grid/engine';
import {
	computed,
	defineComponent,
	h,
	onBeforeUnmount,
	onUpdated,
	type PropType,
	shallowRef,
	type SlotsType,
	Teleport,
	type VNodeChild,
	watch,
} from 'vue';

import {
	type TableBodyRow,
	useBodyRowContext,
	useColumnDragContext,
	useDataTableContext,
	useRowDragContext,
} from '../components/context';
import { useTableMessagesContext } from '../components/messages';
import { forwardElement, getRenderedTag, primitiveProps, renderPrimitive } from '../components/primitive';
import type { DataTable } from '../data-table/use-data-table';
import { describeDragItem, type TableDragItem } from './shared';
import { TABLE_COLUMN_KIND, type TableColumnDragData, type TableColumnDragList } from './use-table-column-drag';
import { TABLE_ROW_KIND, type TableRowDragData, type TableRowDragList } from './use-table-row-drag';

// Parts that have warned: a handle renders once per row, and one warning says it all.
const warned = new Set<string>();

function warnMissing(part: string, parent: string) {
	if (__DEV__ && !warned.has(part)) {
		warned.add(part);
		// oxlint-disable-next-line no-console
		console.warn(`[@vue-data-grid/core] <${part}> needs a <${parent}> or its composable around it.`);
	}
}

/**
 * The drag handle of a row: a `button` that drags its row with a pointer or a finger, and, with
 * `handle` on the row drag, with the keyboard: Space or Enter picks the row up, the arrows move it,
 * Space or Enter drops, Escape cancels. It has `data-dg-state` of `dragging` or `idle`, and
 * `data-dg-disabled` while its row may not be dragged. The row is `row`, else the `TableRow` around it.
 *
 * The default slot gets `{ dragging, disabled }`; without it the handle shows `⠿`.
 */
export const TableDragHandle = defineComponent({
	name: 'TableDragHandle',
	props: {
		...primitiveProps,
		as: { ...primitiveProps.as, default: 'button' },
		/** The row: its key or its body row; the row of the `TableRow` around it by default. */
		row: { type: [String, Object] as PropType<string | TableBodyRow>, default: undefined },
		/** The accessible name; the table's `dragRow` message with the name of the row by default. */
		label: { type: String, default: undefined },
	},
	slots: Object as SlotsType<{ default?: (context: { dragging: boolean; disabled: boolean }) => VNodeChild }>,
	setup(props, { slots }) {
		const drag = useRowDragContext<TableRowDragList>(null);
		const around = useBodyRowContext(null);
		const messages = useTableMessagesContext();

		if (!drag) {
			warnMissing('TableDragHandle', 'TableRowDrag');
		}

		function getKey() {
			const { row } = props;

			return row === undefined ? around?.().key : typeof row === 'string' ? row : row.key;
		}

		// The row itself when the handle has it, so that it follows that row alone, not every row.
		function getOriginal(key: string) {
			const { row } = props;

			if (row !== undefined && typeof row !== 'string') {
				return row.original;
			}

			const current = around?.();

			return current?.key === key ? current.original : undefined;
		}

		// One of each per handle: a drag starting or data changing renders only the handles it concerns.
		const key = computed(getKey);
		const dragging = computed(() => drag !== null && key.value !== undefined && drag.active.value === key.value);
		const disabled = computed(() => !drag || key.value === undefined || !drag.canDrag(key.value, getOriginal(key.value)));
		const label = computed(() => (props.label ?? (drag && key.value !== undefined
			? messages.dragRow(drag.getLabel(key.value, getOriginal(key.value)))
			: '')));

		// The grid navigation presses the only button of a cell on Enter: the handle takes focus then,
		// so that Space picks the row up.
		function focusOnKeyboardClick(event: MouseEvent) {
			if (event.detail === 0 && event.currentTarget instanceof HTMLElement) {
				event.currentTarget.focus();
			}
		}

		return () => {
			if (!drag || key.value === undefined) {
				return null;
			}

			const context = { dragging: dragging.value, disabled: disabled.value };
			const content = slots.default ? slots.default(context) : '⠿';

			return renderPrimitive(props, {
				type: getRenderedTag(props, content) === 'button' ? 'button' : undefined,
				'aria-label': label.value,
				'aria-describedby': drag.handle ? drag.describedBy : undefined,
				'aria-disabled': context.disabled || undefined,
				'data-dg-part': 'drag-handle',
				'data-dg-state': context.dragging ? 'dragging' : 'idle',
				'data-dg-disabled': context.disabled ? '' : undefined,
				onClick: focusOnKeyboardClick,
			}, () => content);
		};
	},
});

/** What the default slot of `TableDragPreview` gets. */
export interface TableDragPreviewContext {
	/** The key of the dragged row, or the name of the dragged column. */
	key: string;
	/** Its name, as screen readers hear it. */
	label: string;
	/** The dragged row; `undefined` for a column. */
	row: unknown;
	/** The dragged column; `undefined` for a row. */
	column: RuntimeColumn | undefined;
}

/**
 * The ghost that follows the pointer while a row or a column of the table is dragged, as a template:
 * put it inside a `TableRowDrag` or a `TableColumnDrag`, or under their composables, and give it a
 * slot. The content renders into the ghost through a `Teleport`, so it stays in your component: its
 * context, its `provide` and its reactivity work there. Without a slot the ghost shows the label of
 * the item. It renders nothing in place.
 *
 * It stands `placement` from the pointer and goes as `exit` says: it fades where it is by default, as
 * a label does; `exit="land"` flies it into the item at its new place, for a ghost that looks like
 * the item, such as with `placement="source"`.
 */
export const TableDragPreview = defineComponent({
	name: 'TableDragPreview',
	props: {
		...primitiveProps,
		/** What it is the ghost of; the rows when both drag, else what drags. */
		for: { type: String as PropType<'rows' | 'columns'>, default: undefined },
		/** Where it stands: `'outside'` the pointer by default, `'center'` under it, or `'source'`, where the item was grabbed. */
		placement: { type: String as PropType<DragPreviewPlacement>, default: 'outside' },
		/** How it goes at the end of a gesture: `'fade'` by default, `'land'` into the item, or `'none'`. */
		exit: { type: String as PropType<DragGhostExit>, default: 'fade' },
	},
	slots: Object as SlotsType<{ default?: (context: TableDragPreviewContext) => VNodeChild }>,
	setup(props, { slots }) {
		const rows = useRowDragContext<TableRowDragList>(null);
		const columns = useColumnDragContext<TableColumnDragList>(null);
		const drag = props.for === 'columns' ? columns : props.for === 'rows' ? rows : rows ?? columns;
		// The item as it was when the drag started: after the drop the ghost flies on while the row may
		// already be gone from the table, moved to another or removed.
		const ghost = shallowRef<{ key: string; container: HTMLElement; label: string; row: unknown; column: RuntimeColumn | undefined } | null>(null);

		function getRow(key: string) {
			return rows && drag === rows ? rows.getRow(key) : undefined;
		}

		function getColumn(key: string) {
			return columns && drag === columns ? columns.getColumn(key) : undefined;
		}

		if (!drag) {
			warnMissing('TableDragPreview', 'TableRowDrag> or <TableColumnDrag');
		}

		const release = drag?.setPreview((key, container) => {
			ghost.value = { key, container, label: drag.getLabel(key), row: getRow(key), column: getColumn(key) };

			return () => {
				if (ghost.value?.container === container) {
					ghost.value = null;
				}
			};
		}, { placement: () => props.placement, exit: () => props.exit });

		onBeforeUnmount(() => release?.());

		return () => {
			const current = ghost.value;

			if (!drag || !current) {
				return null;
			}

			const context: TableDragPreviewContext = {
				key: current.key,
				label: current.label,
				row: getRow(current.key) ?? current.row,
				column: getColumn(current.key) ?? current.column,
			};

			return h(Teleport, { to: current.container }, [
				renderPrimitive(props, { 'data-dg-part': 'drag-preview' }, () => (
					slots.default ? slots.default(context) : context.label
				)),
			]);
		};
	},
});

/** What the default slot of `TableDragOverlay` gets: the dragged item and where the pointer is. */
export interface TableDragOverlayContext extends TableDragItem {
	/** Whether it is over the body, or the header for columns. */
	over: boolean;
	/** Whether it is over a place it may be dropped at. */
	allowed: boolean;
}

/** Where the overlay is: the part of the table in view, for the structural styles to cover. */
interface OverlayView {
	top: number;
	left: number;
	width: number;
	height: number;
}

/**
 * A message over the table while a row or a column it takes is dragged: "you can drop here", and
 * another once the pointer is over the table, or none. It shows while the dragged item can reach the
 * table, so a drag kept to another table shows nothing, and for rows while they come from another
 * table; `own` and `when` change that. Put it inside a `TableRowDrag` or a `TableColumnDrag`, or
 * under their composables, inside the `TableRoot`.
 *
 * The default slot gets the item, `{ key, label, row, column, source, own }`, and where
 * the pointer is, `{ over, allowed }`: one message for each source table, one for each state. The
 * element has `data-dg-state` of `ready`, `over` or `refused`, and with `forceMount` stays rendered
 * as `idle` for animations of your own. The structural styles lay it over the part of the body in
 * view from `--dg-view-top`, `--dg-view-left`, `--dg-view-width`, `--dg-view-height`,
 * `--dg-head-height` and `--dg-foot-height`; restyle it to be a banner or a badge instead.
 */
export const TableDragOverlay = defineComponent({
	name: 'TableDragOverlay',
	props: {
		...primitiveProps,
		/** What it shows the drag of; the rows when both drag, else what drags. */
		for: { type: String as PropType<'rows' | 'columns'>, default: undefined },
		/**
		 * Show while an item of this table itself is dragged too; `false` for rows by default, and `true`
		 * for columns, which only come from their own table.
		 */
		own: { type: Boolean, default: undefined },
		/** Whether to show for what is dragged, instead of the default rule; the item and the pointer as the slot gets them. */
		when: { type: Function as PropType<(context: TableDragOverlayContext) => boolean>, default: undefined },
		/** Stay rendered while nothing is shown, with `data-dg-state="idle"` and no slot, for animations of your own. */
		forceMount: { type: Boolean, default: false },
	},
	slots: Object as SlotsType<{ default?: (context: TableDragOverlayContext) => VNodeChild }>,
	setup(props, { slots }) {
		const rows = useRowDragContext<TableRowDragList>(null);
		const columns = useColumnDragContext<TableColumnDragList>(null);
		const drag = props.for === 'columns' ? columns : props.for === 'rows' ? rows : rows ?? columns;
		const table = useDataTableContext(null);
		const element = shallowRef<HTMLElement | null>(null);
		const elementRef = forwardElement(element);
		let view: OverlayView | null = null;

		if (!drag) {
			warnMissing('TableDragOverlay', 'TableRowDrag> or <TableColumnDrag');
		}

		const context = computed<TableDragOverlayContext | null>(() => {
			const item = drag?.item.value;

			if (!drag || !item) {
				return null;
			}

			const next: TableDragOverlayContext = { ...item, over: drag.over.value, allowed: drag.allowed.value };
			const own = props.own ?? drag === columns;

			if (props.when) {
				return props.when(next) ? next : null;
			}

			return own || !item.own ? next : null;
		});

		const shown = computed(() => context.value !== null);

		// Straight to the element: the table scrolls under a drag, and the overlay need not render for it.
		function writeView() {
			const target = element.value;

			if (!target || !view) {
				return;
			}

			target.style.setProperty('--dg-view-top', `${view.top}px`);
			target.style.setProperty('--dg-view-left', `${view.left}px`);
			target.style.setProperty('--dg-view-width', `${view.width}px`);
			target.style.setProperty('--dg-view-height', `${view.height}px`);
		}

		function measure() {
			const root = table?.root.value;

			view = root
				? { top: root.scrollTop, left: root.scrollLeft, width: root.clientWidth, height: root.clientHeight }
				: null;
			writeView();
		}

		// A `style` of your own replaces what was written when it changes: write it again.
		onUpdated(writeView);

		// Measured while shown: the table scrolls under a drag, near its edges.
		watch([shown, () => table?.root.value], ([visible, root], _previous, onCleanup) => {
			if (!visible || !root) {
				return;
			}

			measure();
			root.addEventListener('scroll', measure, { passive: true });
			window.addEventListener('resize', measure);
			onCleanup(() => {
				root.removeEventListener('scroll', measure);
				window.removeEventListener('resize', measure);
			});
		}, { immediate: true, flush: 'post' });

		return () => {
			const current = context.value;

			if (!current && !props.forceMount) {
				return null;
			}

			const state = !current ? 'idle' : !current.over ? 'ready' : current.allowed ? 'over' : 'refused';

			return renderPrimitive(props, {
				ref: elementRef,
				'data-dg-part': 'drag-overlay',
				'data-dg-state': state,
				style: table
					? `--dg-head-height:${table.headHeight.value}px;--dg-foot-height:${table.footHeight.value}px`
					: undefined,
			}, current ? () => slots.default?.(current) : undefined);
		};
	},
});

/** A row or a column dropped on a `TableDropZone`. */
export interface TableDropZoneEvent {
	/** The key of the row, or the name of the column. */
	key: string;
	/** Its name, as screen readers hear it. */
	label: string;
	/** The dropped row; `undefined` for a column. */
	row: unknown;
	/** The dropped column; `undefined` for a row. */
	column: RuntimeColumn | undefined;
	/** The table it comes from. */
	source: DataTable;
}

/** What the default slot of `TableDropZone` gets. */
export interface TableDropZoneSlotContext {
	/** Whether an item it takes is being dragged, and can reach it. */
	ready: boolean;
	/** Whether it is over the area. */
	over: boolean;
	/** The item being dragged that it takes, from which table; `null` while there is none. */
	item: TableDragItem | null;
}

function toEvent(payload: DragPayload): TableDropZoneEvent | null {
	const data = payload.data as Partial<TableRowDragData & TableColumnDragData> | undefined;

	return data?.table
		? { key: payload.key, label: data.label ?? payload.key, row: data.row, column: data.column, source: data.table }
		: null;
}

/**
 * An area rows or columns of a table are dropped on without being a table: a bin, "add to
 * favourites", a column chooser. It takes the rows of any table, or of those in its `group`; put a
 * row drag in `bounds: 'window'` for its rows to reach an area outside the table. It has
 * `data-dg-state` of `over` while an item is over it, `ready` while one it takes is dragged and can
 * reach it, `idle` otherwise. The default slot gets `{ ready, over, item }`, the item with the table
 * it comes from, for a message of each kind.
 */
export const TableDropZone = defineComponent({
	name: 'TableDropZone',
	props: {
		...primitiveProps,
		/** What it takes: `'rows'` by default, or `'columns'`. Read once. */
		accept: { type: String as PropType<'rows' | 'columns'>, default: 'rows' },
		/** Take only the rows of tables in this group; of any table without it. */
		group: { type: String, default: undefined },
		/** Whether to take an item. */
		canDrop: { type: Function as PropType<(event: TableDropZoneEvent) => boolean>, default: undefined },
	},
	emits: {
		/** An item was dropped on the area. */
		drop: (_event: TableDropZoneEvent) => true,
	},
	slots: Object as SlotsType<{ default?: (context: TableDropZoneSlotContext) => VNodeChild }>,
	setup(props, { emit, slots }) {
		const element = shallowRef<HTMLElement | null>(null);
		const elementRef = forwardElement(element);
		const target = useDropTarget(element, {
			kinds: [props.accept === 'columns' ? TABLE_COLUMN_KIND : TABLE_ROW_KIND],
			group: () => props.group,
			canDrop: (payload) => {
				const event = toEvent(payload);

				return event !== null && (props.canDrop?.(event) ?? true);
			},
			onDrop: (payload) => {
				const event = toEvent(payload);

				if (event) {
					emit('drop', event);
				}
			},
		});

		const item = computed(() => describeDragItem(target.dragging.value, null));

		// Read lazily: a slot that shows nothing of the drag does not render again during one.
		const context: TableDropZoneSlotContext = {
			get ready() {
				return item.value !== null;
			},
			get over() {
				return target.over.value;
			},
			get item() {
				return item.value;
			},
		};

		return () => {
			const over = target.over.value;

			return renderPrimitive(props, {
				ref: elementRef,
				'data-dg-part': 'drop-zone',
				'data-dg-state': over ? 'over' : context.ready ? 'ready' : 'idle',
			}, () => slots.default?.(context));
		};
	},
});
