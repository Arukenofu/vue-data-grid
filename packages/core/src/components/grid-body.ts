import { canEditCell, getCellText, type RenderedColumn, type RuntimeColumn } from '@vue-data-grid/engine';
import {
	type ComponentPublicInstance,
	computed,
	defineComponent,
	Fragment,
	h,
	isVNode,
	mergeProps,
	onMounted,
	onUpdated,
	type PropType,
	type SlotsType,
	type VNode,
	type VNodeChild,
	watchEffect,
} from 'vue';

import type { CellContext, CellEditor } from '../columns/column-fields';
import { createBodyRowContext, type GridBodyRow, useBodyRowContext, useDataGridContext, useRowDragContext } from './context';
import { useDragItem } from './drag-item';
import { keepMounted } from '../render/memo';
import { forwardElement, hasContent, primitiveProps, renderPrimitive, toElement } from './primitive';

/** What the default slot of `GridCells` gets for each cell: the cell context of the column's `cell` field. */
export type CellSlotContext = CellContext<unknown, unknown>;

function getContext(rendered: RenderedColumn, row: GridBodyRow): CellSlotContext | null {
	const { column } = rendered;

	return column
		? { row: row.original, value: column.value(row.original), key: row.key, index: row.index, column, node: row.node }
		: null;
}

/** The content of a body cell: the column's `cell` field, else its text through `format` on one line. */
function renderContent(context: CellSlotContext) {
	return context.column.cell?.(context) ?? h('span', { 'data-dg-part': 'cell-text' }, getCellText(context.column, context.row));
}

// The names of the columns ranges span, one set for each list of them, shared by every row.
const selectableColumns = new WeakMap<readonly RuntimeColumn[], ReadonlySet<string>>();

function getSelectableColumns(columns: readonly RuntimeColumn[]) {
	let names = selectableColumns.get(columns);

	if (!names) {
		names = new Set(columns.map(column => column.name));
		selectableColumns.set(columns, names);
	}

	return names;
}

/**
 * The editor of the cell being edited, a component of its own: the draft changes with every key, and
 * renders the editor alone rather than its row.
 */
const GridCellEditor = defineComponent({
	name: 'GridCellEditor',
	props: {
		context: { type: Object as PropType<CellSlotContext>, required: true },
		editor: { type: Function as PropType<CellEditor>, required: true },
	},
	setup(props) {
		const grid = useDataGridContext();

		return () => {
			const context = grid.editing?.getEditorContext(props.context);

			return context ? props.editor(context) : null;
		};
	},
});

/**
 * The cells of the body row it is in, one for each rendered column: plain elements with their role,
 * `aria-colindex`, width and pin, `aria-selected` with the `ranges` feature, and the column's
 * `cellClass`, rendered by this part without a component each, so a row costs one component
 * whatever its width. With the `editing` feature the cell being edited renders its editor, the
 * column's `editor` or the editing's default, with `data-dg-state="editing"`, and a cell that can be
 * edited gets `write` in its context. Attributes of the part go to every cell.
 *
 * `aria-selected` is written to the cells of the row as the ranges change, without a render: a range
 * that grows across a hundred rows renders none of them.
 *
 * The default slot renders the content of each cell and gets its cell context
 * `{ row, value, key, index, column, node, write }`. A cell the slot renders nothing for, such as one
 * its `v-if` skips, shows its own content, as a `<slot>` shows its fallback: the column's `cell`
 * field, else its text through `format`. A spacer of the column window renders an empty cell.
 */
export const GridCells = defineComponent({
	name: 'GridCells',
	inheritAttrs: false,
	props: {
		/** The element of each cell. */
		as: { type: String, default: 'div' },
	},
	slots: Object as SlotsType<{ default?: (context: CellSlotContext) => VNodeChild }>,
	setup(props, { attrs, slots }) {
		const grid = useDataGridContext();
		const row = useBodyRowContext();
		// The `write` of each cell, made once for each object of the row: a control that writes is not
		// patched again on every render. A commit gives the row a new object, and new writes.
		let writtenRow: unknown = null;
		const writes = new Map<string, (value: unknown) => void>();
		let cells: readonly VNode[] = [];

		function getWrite(current: GridBodyRow, column: string) {
			if (writtenRow !== current.original) {
				writtenRow = current.original;
				writes.clear();
			}

			let write = writes.get(column);

			if (!write) {
				const { key } = current;

				write = value => grid.editing?.write([{ key, column, value }], 'edit');
				writes.set(column, write);
			}

			return write;
		}

		/** Writes `aria-selected` of the cells ranges can hold, from the selected columns of the row. */
		function writeSelection() {
			const { ranges } = grid;

			if (!ranges) {
				return;
			}

			const selected = ranges.getSelectedColumns(row().index);
			const selectable = getSelectableColumns(ranges.columns.value);

			for (const cell of cells) {
				if (typeof cell.key === 'string' && selectable.has(cell.key) && cell.el instanceof Element) {
					cell.el.setAttribute('aria-selected', selected.has(cell.key) ? 'true' : 'false');
				}
			}
		}

		watchEffect(writeSelection, { flush: 'post' });
		onMounted(writeSelection);
		onUpdated(writeSelection);

		function getEditor(context: CellSlotContext, current: GridBodyRow) {
			const { editing } = grid;

			// Reactive per row: editing that starts elsewhere does not render this row.
			return editing && editing.getEditingColumn(current.key) === context.column.name ? editing.getEditor(context.column) : null;
		}

		function renderCell(rendered: RenderedColumn, current: GridBodyRow, hasAttrs: boolean) {
			const context = getContext(rendered, current);

			if (context && grid.editing && canEditCell(context.column, current.original)) {
				context.write = getWrite(current, context.column.name);
			}

			const editor = context ? getEditor(context, current) : null;
			const own = {
				key: rendered.key,
				class: context?.column.cellClass?.(context),
				'data-dg-state': editor ? 'editing' : undefined,
			};
			const cellProps = hasAttrs
				? mergeProps(grid.getCellProps(rendered), attrs, own)
				: { ...grid.getCellProps(rendered), ...own };

			if (!context) {
				return h(props.as, cellProps);
			}

			if (editor) {
				return h(props.as, cellProps, [h(GridCellEditor, { context, editor })]);
			}

			const content = slots.default?.(context);

			return h(props.as, cellProps, [hasContent(content) ? content : renderContent(context)]);
		}

		return () => {
			const current = row();
			const hasAttrs = Object.keys(attrs).length > 0;

			cells = grid.scope.renderedColumns.value.map(rendered => renderCell(rendered, current, hasAttrs));

			return cells;
		};
	},
});

/**
 * A body row, positioned at its offset under the row window, with its role, index, tree and
 * selection attributes, and measured with `measureRows`. It gives the parts inside their row.
 *
 * Under a `GridRowDrag` it registers its element with the drag list, so the row can be dragged.
 *
 * `row` stays the same object while the row's data, place and node hold, so the row renders again
 * only when they change, not when the window scrolls or other rows change: this is the row memo.
 * The default slot gets `{ row, columns }`, the row and the rendered columns; `GridCells` renders
 * the cells.
 */
export const GridRow = defineComponent({
	name: 'GridRow',
	props: {
		...primitiveProps,
		/** The row, from `rows` of `GridBody`. */
		row: { type: Object as PropType<GridBodyRow>, required: true },
	},
	slots: Object as SlotsType<{
		default?: (context: { row: GridBodyRow; columns: readonly RenderedColumn[] }) => VNodeChild;
	}>,
	setup(props, { slots }) {
		const grid = useDataGridContext();

		createBodyRowContext(() => props.row);

		const dragItems = useRowDragContext(null);
		const drag = useDragItem(dragItems, () => props.row.key);

		// Made once: a new function each render would make Vue reset the ref on every render.
		function rowRef(value: Element | ComponentPublicInstance | null) {
			grid.measureElement(value);
			drag(toElement(value));
		}

		return () => {
			const { row } = props;

			// The row's own node, so a tree change elsewhere does not render this row again.
			const rowProps = grid.getRowProps({ ...row.item, node: row.node });

			return renderPrimitive(props, {
				...rowProps,
				...dragItems?.getItemProps(row.key, row.original),
				ref: rowRef,
			}, () => slots.default?.({
				row,
				columns: grid.scope.renderedColumns.value,
			}));
		};
	},
});

function isSameRow(row: GridBodyRow | undefined, next: GridBodyRow): row is GridBodyRow {
	return row !== undefined
		&& row.item === next.item
		&& row.original === next.original
		&& row.node === next.node;
}

// `SlotFlags.STABLE` of Vue's template compiler: slots that read nothing of the render around them.
const STABLE_SLOTS = 1;

/**
 * Whether the slots of a component vnode read nothing of the render around them, as Vue decides it:
 * compiled stable slots, slots a render function marks `$stable`, or none.
 */
function hasStableSlots(vnode: VNode) {
	const slots = vnode.children;

	if (slots === null) {
		return true;
	}

	return typeof slots === 'object' && !Array.isArray(slots) && (slots._ === STABLE_SLOTS || slots.$stable === true);
}

function isSameProps(current: VNode['props'], next: VNode['props']) {
	if (current === next) {
		return true;
	}

	if (!current || !next) {
		return false;
	}

	const names = Object.keys(next);

	return names.length === Object.keys(current).length && names.every(name => Object.is(current[name], next[name]));
}

function isSameRef(current: VNode['ref'], next: VNode['ref']) {
	if (current === null || next === null) {
		return current === next;
	}

	return !Array.isArray(current) && !Array.isArray(next) && current.r === next.r && current.k === next.k;
}

/** Whether the vnode of a row from the last render stands for `next` as it is: Vue would not update it. */
function isSameRowVNode(current: VNode, next: VNode) {
	return current.type === next.type
		&& !next.dirs
		&& !next.transition
		&& hasStableSlots(next)
		&& isSameProps(current.props, next.props)
		&& isSameRef(current.ref, next.ref);
}

/** Calls `visit` for each `GridRow` among `children`, the fragments of a `v-for` included, with its list and place. */
function forEachRow(children: VNodeChild, visit: (list: VNodeChild[], index: number, vnode: VNode) => void) {
	if (!Array.isArray(children)) {
		return;
	}

	children.forEach((child: VNodeChild, index: number) => {
		if (Array.isArray(child)) {
			forEachRow(child, visit);
		} else if (isVNode(child) && child.type === Fragment) {
			// The children of a fragment are always a list of vnodes; Vue types them as those of any vnode.
			forEachRow(child.children as VNodeChild, visit);
		} else if (isVNode(child) && child.type === GridRow) {
			visit(children, index, child);
		}
	});
}

/**
 * The body of the grid, as tall as the row window. The default slot gets `{ rows }`, the rendered
 * rows, each the same object while its data, place and node hold, for a `GridRow` each.
 */
export const GridBody = defineComponent({
	name: 'GridBody',
	props: primitiveProps,
	slots: Object as SlotsType<{ default?: (context: { rows: readonly GridBodyRow[] }) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();
		const bodyRef = forwardElement(grid.body);

		// Rows reuse their objects by key, so a `GridRow` whose row holds is not rendered again.
		const rows = computed<readonly GridBodyRow[]>((previous) => {
			const known = new Map(previous?.map(row => [row.key, row]));
			const data = grid.rows.value;

			return grid.items.value.map((item) => {
				const next: GridBodyRow = {
					key: item.key,
					index: item.index,
					item,
					original: data[item.index],
					node: grid.getNodeAt(item.index),
				};
				const current = known.get(item.key);

				return isSameRow(current, next) ? current : next;
			});
		});

		// The vnode of each row as the last render left it, by key.
		let rendered = new Map<PropertyKey, VNode>();

		/**
		 * Puts back the vnode of the last render for each row whose props and slots hold, as `v-memo` does,
		 * so Vue skips the row. A body renders its slot by hand, outside a compiled block, and Vue would
		 * update every row of it on each render of the body, such as when a single row changes.
		 */
		function reuseRows(content: VNodeChild) {
			const next = new Map<PropertyKey, VNode>();

			forEachRow(content, (list, index, vnode) => {
				const previous = vnode.key === null ? undefined : rendered.get(vnode.key);
				const row = previous && isSameRowVNode(previous, vnode) ? keepMounted(previous) : vnode;

				list[index] = row;

				if (row.key !== null) {
					next.set(row.key, row);
				}
			});

			rendered = next;

			return content;
		}

		return () => renderPrimitive(props, { ...grid.getBodyProps(), ref: bodyRef }, () => reuseRows(slots.default?.({ rows: rows.value })));
	},
});
