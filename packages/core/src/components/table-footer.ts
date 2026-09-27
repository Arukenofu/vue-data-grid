import { aggregateColumn, type RenderedColumn } from '@vue-data-grid/engine';
import { defineComponent, h, onBeforeUnmount, onMounted, type PropType, type SlotsType, type VNodeChild } from 'vue';

import type { FooterContext } from '../columns/column-fields';
import type { DataTable } from '../data-table/use-data-table';
import { createFooterCellContext, useDataTableContext, useFooterCellContext } from './context';
import { forwardElement, primitiveProps, renderPrimitive } from './primitive';

/** What a footer cell's default slot gets. */
export type FooterSlotContext = FooterContext<unknown, unknown>;

function getContext(table: DataTable, rendered: RenderedColumn): FooterSlotContext | null {
	const { column } = rendered;

	if (!column) {
		return null;
	}

	const rows = table.leaves.value;

	return { column, rows, aggregate: aggregateColumn(column, rows) };
}

// Text of the `footer` field is cut to one line as the text of body and header cells is; a node is the
// column's own content.
function renderContent(context: FooterSlotContext) {
	const content = context.column.footer?.(context);

	return typeof content === 'string' || typeof content === 'number'
		? h('span', { 'data-dg-part': 'cell-text' }, content)
		: content;
}

/**
 * The content of the footer cell it is in: the column's `footer` field, text of it on one line with an
 * ellipsis. It renders no element of its own. `TableFooterCell` shows it without a slot; put it in the
 * slot to keep it next to content of your own.
 */
export const TableFooterContent = defineComponent({
	name: 'TableFooterContent',
	setup() {
		const table = useDataTableContext();
		const column = useFooterCellContext();

		return () => {
			const context = getContext(table, column());

			return context ? renderContent(context) : null;
		};
	},
});

/**
 * A footer cell of `column`. The default slot gets `{ column, rows, aggregate }`: the rows are the
 * table's `leaves`, and `aggregate` the column's `aggregate` over them; without the slot the cell
 * shows its content, as `TableFooterContent` does. It renders again whenever the rows change.
 */
export const TableFooterCell = defineComponent({
	name: 'TableFooterCell',
	props: {
		...primitiveProps,
		/** The column, from `columns` of `TableFooterRow`. */
		column: { type: Object as PropType<RenderedColumn>, required: true },
	},
	slots: Object as SlotsType<{ default?: (context: FooterSlotContext) => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();

		createFooterCellContext(() => props.column);

		return () => {
			const context = getContext(table, props.column);

			if (!context) {
				return renderPrimitive(props, { ...table.getCellProps(props.column) });
			}

			return renderPrimitive(props, { ...table.getCellProps(props.column) }, () => (
				slots.default ? slots.default(context) : renderContent(context)
			));
		};
	},
});

/**
 * A footer row, `index` from the first one. It counts itself into the table's `aria-rowcount` while
 * it is mounted. The default slot gets `{ columns }`, the rendered columns, for a `TableFooterCell`
 * each.
 */
export const TableFooterRow = defineComponent({
	name: 'TableFooterRow',
	props: {
		...primitiveProps,
		/** The row's place among the footer rows, from `0`. */
		index: { type: Number, default: 0 },
	},
	slots: Object as SlotsType<{ default?: (context: { columns: readonly RenderedColumn[] }) => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();

		let release: (() => void) | null = null;

		// Counted once mounted: a change while the table element renders would not render it again.
		onMounted(() => {
			release = table.addFooterRows(1);
		});
		onBeforeUnmount(() => release?.());

		return () => renderPrimitive(props, { ...table.getFooterRowProps(props.index) }, () => slots.default?.({
			columns: table.scope.renderedColumns.value,
		}));
	},
});

/**
 * The footer of the table: sticky at the bottom, measured for the engine's `scrollMarginEnd`. The
 * default slot holds its `TableFooterRow`s.
 */
export const TableFooter = defineComponent({
	name: 'TableFooter',
	props: primitiveProps,
	slots: Object as SlotsType<{ default?: () => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();
		const footRef = forwardElement(table.foot);

		return () => renderPrimitive(props, { ...table.getFootProps(), ref: footRef }, () => slots.default?.());
	},
});
