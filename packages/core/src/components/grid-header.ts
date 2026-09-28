import type { ColumnGroup, GridScope, RenderedColumn, RenderedGroup } from '@vue-data-grid/engine';
import { type ComponentPublicInstance, defineComponent, type PropType, type SlotsType, type VNodeChild } from 'vue';

import type { HeaderContext } from '../columns/column-fields';
import { useHeaderCell } from '../header/use-header-cell';
import {
	createGroupCellContext,
	createHeaderCellContext,
	useColumnDragContext,
	useDataGridContext,
	useGridTemplatesContext,
	useGroupCellContext,
	useHeaderCellContext,
} from './context';
import { useGridMessagesContext } from './messages';
import { useDragItem } from './drag-item';
import { forwardElement, getRenderedTag, primitiveProps, renderPrimitive, toElement, toRootContent } from './primitive';
import { renderCellText, renderHeaderContent } from './cell-content';

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

function getHeaderContext(scope: GridScope, rendered: RenderedColumn): HeaderContext | null {
	const { column } = rendered;

	return column
		? { column, direction: scope.getSortDirection(column.name), sortIndex: scope.getSortIndex(column.name) }
		: null;
}

function renderGroupContent(cell: RenderedGroup) {
	const { group } = cell;

	return group ? group.header?.({ group, collapsed: cell.collapsed }) ?? renderCellText(group.label ?? group.name) : null;
}

/**
 * The content of the column header cell it is in: the column's `GridHeaderTemplate`, its `header`
 * field, else its label on one line with an ellipsis. It renders no element of its own.
 * `GridHeaderCell` shows it without a slot; put it in the slot next to a sort indicator or a resize
 * handle.
 */
export const GridHeaderContent = defineComponent({
	name: 'GridHeaderContent',
	setup() {
		const grid = useDataGridContext();
		const templates = useGridTemplatesContext(null);
		const column = useHeaderCellContext();

		return () => {
			const context = getHeaderContext(grid.scope, column());

			return context ? toRootContent(renderHeaderContent(context, templates)) : null;
		};
	},
});

/**
 * A column header cell: `role="columnheader"`, `aria-sort`, the column's width and pin, and what
 * `useHeaderCell` does: a click or Enter sorts a `sortable` column, the keys move and resize it. It
 * gives the parts inside, such as a sort indicator or a resize handle, their column. Under a
 * `GridColumnDrag` it registers its element with the drag list, so the column can be dragged.
 *
 * The default slot gets `{ column, direction, sortIndex }`; without it the cell shows its content, as
 * `GridHeaderContent` does: its `GridHeaderTemplate`, `header` field or label. A spacer of the column
 * window renders an empty cell.
 */
export const GridHeaderCell = defineComponent({
	name: 'GridHeaderCell',
	props: {
		...primitiveProps,
		/** The column, from `scope.renderedColumns`. */
		column: { type: Object as PropType<RenderedColumn>, required: true },
	},
	slots: Object as SlotsType<{ default?: (context: HeaderContext) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();
		const templates = useGridTemplatesContext(null);
		const header = useHeaderCell(grid.scope);

		createHeaderCellContext(() => props.column);

		const dragItems = useColumnDragContext(null);
		const drag = useDragItem(dragItems, () => props.column.key);

		// Made once: a new function each render would make Vue reset the ref on every render.
		function cellRef(value: Element | ComponentPublicInstance | null) {
			drag(props.column.column ? toElement(value) : null);
		}

		return () => {
			const rendered = props.column;
			const context = getHeaderContext(grid.scope, rendered);

			if (!context) {
				return renderPrimitive(props, { ...grid.getHeaderCellProps(rendered) });
			}

			return renderPrimitive(props, {
				...grid.getHeaderCellProps(rendered),
				...header.getHandlers(context.column.name),
				...dragItems?.getItemProps(context.column.name),
				ref: cellRef,
			}, () => (slots.default
				? slots.default(context)
				: renderHeaderContent(context, templates)));
		};
	},
});

/**
 * The row of column headers. The default slot gets `{ columns }`, the rendered columns with the
 * spacers of the column window, for a `GridHeaderCell` each.
 */
export const GridHeaderRow = defineComponent({
	name: 'GridHeaderRow',
	props: primitiveProps,
	slots: Object as SlotsType<{ default?: (context: { columns: readonly RenderedColumn[] }) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();

		return () => renderPrimitive(props, { ...grid.getHeaderRowProps() }, () => slots.default?.({
			columns: grid.scope.renderedColumns.value,
		}));
	},
});

/**
 * The button that collapses and expands the group of the cell it is in, with `aria-expanded` and
 * `data-dg-state` of `expanded` or `collapsed`. Nothing renders for a group that cannot collapse. The
 * default slot gets `{ collapsed }`; without it the button shows `+` or `−`.
 */
export const GridGroupToggle = defineComponent({
	name: 'GridGroupToggle',
	props: {
		...primitiveProps,
		as: { ...primitiveProps.as, default: 'button' },
	},
	slots: Object as SlotsType<{ default?: (context: { collapsed: boolean }) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();
		const cell = useGroupCellContext();
		const messages = useGridMessagesContext();

		function toggle() {
			const { group } = cell();

			if (group) {
				grid.scope.toggleGroup(group.name);
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
				'data-dg-part': 'group-toggle',
				'data-dg-state': collapsed ? 'collapsed' : 'expanded',
				onClick: toggle,
			}, () => content);
		};
	},
});

/**
 * The content of the group cell it is in: the group's `header` field, else its label on one line with
 * an ellipsis. It renders no element of its own. `GridGroupCell` shows it without a slot; put it in
 * the slot next to a `GridGroupToggle`.
 */
export const GridGroupContent = defineComponent({
	name: 'GridGroupContent',
	setup() {
		const cell = useGroupCellContext();

		return () => toRootContent(renderGroupContent(cell()));
	},
});

/**
 * A cell of a group row: `role="columnheader"` over the columns of its group, with `aria-colspan`.
 * It gives the parts inside, such as a `GridGroupToggle`, their cell. The default slot gets the
 * cell, its group and its collapse state; without it the cell shows its content, as
 * `GridGroupContent` does.
 */
export const GridGroupCell = defineComponent({
	name: 'GridGroupCell',
	props: {
		...primitiveProps,
		/** The cell, from `cells` of `GridGroupRow` or `scope.headerGroups`. */
		cell: { type: Object as PropType<RenderedGroup>, required: true },
	},
	slots: Object as SlotsType<{ default?: (context: GroupCellSlotContext) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();

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
						grid.scope.toggleGroup(cell.group.name);
					}
				},
			};

			return renderPrimitive(props, { ...grid.getGroupCellProps(cell) }, () => (
				slots.default ? slots.default(context) : renderGroupContent(cell)
			));
		};
	},
});

/**
 * A group row of the header, `level` from the top. The default slot gets `{ cells }`, for a
 * `GridGroupCell` each.
 */
export const GridGroupRow = defineComponent({
	name: 'GridGroupRow',
	props: {
		...primitiveProps,
		/** The level from the top, an index into `groups` of `GridHeader`. */
		level: { type: Number, required: true },
	},
	slots: Object as SlotsType<{ default?: (context: { cells: readonly RenderedGroup[] }) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();

		return () => renderPrimitive(props, { ...grid.getGroupRowProps(props.level) }, () => slots.default?.({
			cells: grid.scope.headerGroups.value[props.level] ?? [],
		}));
	},
});

/**
 * The header of the grid: sticky at the top, measured for the engine's `scrollMargin`. The default
 * slot gets `{ groups, columns }`: the cells of each group row, for a `GridGroupRow` each, and the
 * rendered columns.
 */
export const GridHeader = defineComponent({
	name: 'GridHeader',
	props: primitiveProps,
	slots: Object as SlotsType<{
		default?: (context: {
			groups: readonly (readonly RenderedGroup[])[];
			columns: readonly RenderedColumn[];
		}) => VNodeChild;
	}>,
	setup(props, { slots }) {
		const grid = useDataGridContext();
		const headRef = forwardElement(grid.head);

		return () => renderPrimitive(props, { ...grid.getHeadProps(), ref: headRef }, () => slots.default?.({
			groups: grid.scope.headerGroups.value,
			columns: grid.scope.renderedColumns.value,
		}));
	},
});
