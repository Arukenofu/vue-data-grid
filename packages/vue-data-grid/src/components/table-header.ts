import type { ColumnGroup, RenderedColumn, RenderedGroup, TableScope } from '@vue-data-grid/core';
import { type ComponentPublicInstance, defineComponent, h, type PropType, type SlotsType, type VNodeChild } from 'vue';

import type { HeaderContext } from '../columns/column-fields';
import { useHeaderCell } from '../header/use-header-cell';
import {
	createGroupCellContext,
	createHeaderCellContext,
	useColumnDragContext,
	useDataTableContext,
	useGroupCellContext,
	useHeaderCellContext,
} from './context';
import { useTableMessagesContext } from './messages';
import { useDragItem } from './drag-item';
import { forwardElement, getRenderedTag, primitiveProps, renderPrimitive, toElement, toRootContent } from './primitive';

/** What a group cell's default slot gets. */
export interface GroupCellSlotContext {
	cell: RenderedGroup;
	/** `null` for the cell of columns without a group at this level. */
	group: ColumnGroup | null;
	collapsed: boolean;
	collapsible: boolean;
	/** Collapses or expands the group; does nothing for a group that cannot collapse. */
	toggle: () => void;
}

function renderLabel(text: string) {
	return h('span', { 'data-tc-part': 'cell-text' }, text);
}

function getHeaderContext(scope: TableScope, rendered: RenderedColumn): HeaderContext | null {
	const { column } = rendered;

	return column
		? { column, direction: scope.getSortDirection(column.name), sortIndex: scope.getSortIndex(column.name) }
		: null;
}

/** The content of a header cell: the column's `header` field, else its label on one line. */
function renderHeaderContent(context: HeaderContext) {
	return context.column.header?.(context) ?? renderLabel(context.column.label ?? context.column.name);
}

/** The content of a group cell: the group's `header` field, else its label on one line. */
function renderGroupContent(cell: RenderedGroup) {
	const { group } = cell;

	return group ? group.header?.({ group, collapsed: cell.collapsed }) ?? renderLabel(group.label ?? group.name) : null;
}

/**
 * The content of the column header cell it is in: the column's `header` field, else its label on one
 * line with an ellipsis. It renders no element of its own. `TableHeaderCell` shows it without a slot;
 * put it in the slot next to a sort indicator or a resize handle.
 */
export const TableHeaderContent = defineComponent({
	name: 'TableHeaderContent',
	setup() {
		const table = useDataTableContext();
		const column = useHeaderCellContext();

		return () => {
			const context = getHeaderContext(table.scope, column());

			return context ? toRootContent(renderHeaderContent(context)) : null;
		};
	},
});

/**
 * A column header cell: `role="columnheader"`, `aria-sort`, the column's width and pin, and what
 * `useHeaderCell` does: a click or Enter sorts a `sortable` column, the keys move and resize it. It
 * gives the parts inside, such as a sort indicator or a resize handle, their column. Under a
 * `TableColumnDrag` it registers its element with the drag list, so the column can be dragged.
 *
 * The default slot gets `{ column, direction, sortIndex }`; without it the cell shows its content, as
 * `TableHeaderContent` does. A spacer of the column window renders an empty cell.
 */
export const TableHeaderCell = defineComponent({
	name: 'TableHeaderCell',
	props: {
		...primitiveProps,
		/** The column, from `scope.renderedColumns`. */
		column: { type: Object as PropType<RenderedColumn>, required: true },
	},
	slots: Object as SlotsType<{ default?: (context: HeaderContext) => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();
		const header = useHeaderCell(table.scope);

		createHeaderCellContext(() => props.column);

		const dragItems = useColumnDragContext(null);
		const drag = useDragItem(dragItems, () => props.column.key);

		// Made once: a new function each render would make Vue reset the ref on every render.
		function cellRef(value: Element | ComponentPublicInstance | null) {
			drag(props.column.column ? toElement(value) : null);
		}

		return () => {
			const rendered = props.column;
			const context = getHeaderContext(table.scope, rendered);

			if (!context) {
				return renderPrimitive(props, { ...table.getHeaderCellProps(rendered) });
			}

			return renderPrimitive(props, {
				...table.getHeaderCellProps(rendered),
				...header.getHandlers(context.column.name),
				...dragItems?.getItemProps(context.column.name),
				ref: cellRef,
			}, () => (slots.default ? slots.default(context) : renderHeaderContent(context)));
		};
	},
});

/**
 * The row of column headers. The default slot gets `{ columns }`, the rendered columns with the
 * spacers of the column window, for a `TableHeaderCell` each.
 */
export const TableHeaderRow = defineComponent({
	name: 'TableHeaderRow',
	props: primitiveProps,
	slots: Object as SlotsType<{ default?: (context: { columns: readonly RenderedColumn[] }) => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();

		return () => renderPrimitive(props, { ...table.getHeaderRowProps() }, () => slots.default?.({
			columns: table.scope.renderedColumns.value,
		}));
	},
});

/**
 * The button that collapses and expands the group of the cell it is in, with `aria-expanded` and
 * `data-tc-state` of `expanded` or `collapsed`. Nothing renders for a group that cannot collapse. The
 * default slot gets `{ collapsed }`; without it the button shows `+` or `−`.
 */
export const TableGroupToggle = defineComponent({
	name: 'TableGroupToggle',
	props: {
		...primitiveProps,
		as: { ...primitiveProps.as, default: 'button' },
	},
	slots: Object as SlotsType<{ default?: (context: { collapsed: boolean }) => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();
		const cell = useGroupCellContext();
		const messages = useTableMessagesContext();

		function toggle() {
			const { group } = cell();

			if (group) {
				table.scope.toggleGroup(group.name);
			}
		}

		return () => {
			const { collapsed, collapsible, group } = cell();

			if (!group || !collapsible) {
				return null;
			}

			const label = group.label ?? group.name;
			const content = slots.default ? slots.default({ collapsed }) : collapsed ? '+' : '−';

			return renderPrimitive(props, {
				type: getRenderedTag(props, content) === 'button' ? 'button' : undefined,
				'aria-expanded': !collapsed,
				'aria-label': collapsed ? messages.expandGroup(label) : messages.collapseGroup(label),
				'data-tc-part': 'group-toggle',
				'data-tc-state': collapsed ? 'collapsed' : 'expanded',
				onClick: toggle,
			}, () => content);
		};
	},
});

/**
 * The content of the group cell it is in: the group's `header` field, else its label on one line with
 * an ellipsis. It renders no element of its own. `TableGroupCell` shows it without a slot; put it in
 * the slot next to a `TableGroupToggle`.
 */
export const TableGroupContent = defineComponent({
	name: 'TableGroupContent',
	setup() {
		const cell = useGroupCellContext();

		return () => toRootContent(renderGroupContent(cell()));
	},
});

/**
 * A cell of a group row: `role="columnheader"` over the columns of its group, with `aria-colspan`.
 * It gives the parts inside, such as a `TableGroupToggle`, their cell. The default slot gets the
 * cell, its group and its collapse state; without it the cell shows its content, as
 * `TableGroupContent` does.
 */
export const TableGroupCell = defineComponent({
	name: 'TableGroupCell',
	props: {
		...primitiveProps,
		/** The cell, from `cells` of `TableGroupRow` or `scope.headerGroups`. */
		cell: { type: Object as PropType<RenderedGroup>, required: true },
	},
	slots: Object as SlotsType<{ default?: (context: GroupCellSlotContext) => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();

		createGroupCellContext(() => props.cell);

		return () => {
			const { cell } = props;
			const context: GroupCellSlotContext = {
				cell,
				group: cell.group,
				collapsed: cell.collapsed,
				collapsible: cell.collapsible,
				toggle: () => {
					if (cell.group && cell.collapsible) {
						table.scope.toggleGroup(cell.group.name);
					}
				},
			};

			return renderPrimitive(props, { ...table.getGroupCellProps(cell) }, () => (
				slots.default ? slots.default(context) : renderGroupContent(cell)
			));
		};
	},
});

/**
 * A group row of the header, `level` from the top. The default slot gets `{ cells }`, for a
 * `TableGroupCell` each.
 */
export const TableGroupRow = defineComponent({
	name: 'TableGroupRow',
	props: {
		...primitiveProps,
		/** The level from the top, an index into `groups` of `TableHeader`. */
		level: { type: Number, required: true },
	},
	slots: Object as SlotsType<{ default?: (context: { cells: readonly RenderedGroup[] }) => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();

		return () => renderPrimitive(props, { ...table.getGroupRowProps(props.level) }, () => slots.default?.({
			cells: table.scope.headerGroups.value[props.level] ?? [],
		}));
	},
});

/**
 * The header of the table: sticky at the top, measured for the engine's `scrollMargin`. The default
 * slot gets `{ groups, columns }`: the cells of each group row, for a `TableGroupRow` each, and the
 * rendered columns.
 */
export const TableHeader = defineComponent({
	name: 'TableHeader',
	props: primitiveProps,
	slots: Object as SlotsType<{
		default?: (context: {
			groups: readonly (readonly RenderedGroup[])[];
			columns: readonly RenderedColumn[];
		}) => VNodeChild;
	}>,
	setup(props, { slots }) {
		const table = useDataTableContext();
		const headRef = forwardElement(table.head);

		return () => renderPrimitive(props, { ...table.getHeadProps(), ref: headRef }, () => slots.default?.({
			groups: table.scope.headerGroups.value,
			columns: table.scope.renderedColumns.value,
		}));
	},
});
