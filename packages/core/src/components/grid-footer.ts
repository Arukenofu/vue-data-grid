import { aggregateColumn, type RenderedColumn } from '@vue-data-grid/engine';
import { defineComponent, onBeforeUnmount, onMounted, type PropType, type SlotsType, type VNodeChild } from 'vue';

import type { FooterContext } from '../columns/column-fields';
import type { DataGrid } from '../data-grid/use-data-grid';
import { createFooterCellContext, useDataGridContext, useFooterCellContext, useGridTemplatesContext } from './context';
import { renderFooterContent } from './cell-content';
import { forwardElement, primitiveProps, renderPrimitive } from './primitive';

/** What a footer cell's default slot gets. */
export type FooterSlotContext = FooterContext<unknown, unknown>;

function getContext(grid: DataGrid, rendered: RenderedColumn): FooterSlotContext | null {
	const { column } = rendered;

	if (!column) {
		return null;
	}

	const rows = grid.leaves.value;

	return { column, rows, aggregate: aggregateColumn(column, rows) };
}

/**
 * The content of the footer cell it is in: the column's `GridFooterTemplate`, else its `footer` field,
 * text of it on one line with an ellipsis. It renders no element of its own. `GridFooterCell` shows it
 * without a slot; put it in the slot to keep it next to content of your own.
 */
export const GridFooterContent = defineComponent({
	name: 'GridFooterContent',
	setup() {
		const grid = useDataGridContext();
		const templates = useGridTemplatesContext(null);
		const column = useFooterCellContext();

		return () => {
			const context = getContext(grid, column());

			return context ? renderFooterContent(context, templates) : null;
		};
	},
});

/**
 * A footer cell of `column`. The default slot gets `{ column, rows, aggregate }`: the rows are the
 * grid's `leaves`, and `aggregate` the column's `aggregate` over them; without the slot the cell
 * shows its content, as `GridFooterContent` does. It renders again whenever the rows change.
 */
export const GridFooterCell = defineComponent({
	name: 'GridFooterCell',
	props: {
		...primitiveProps,
		/** The column, from `columns` of `GridFooterRow`. */
		column: { type: Object as PropType<RenderedColumn>, required: true },
	},
	slots: Object as SlotsType<{ default?: (context: FooterSlotContext) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();
		const templates = useGridTemplatesContext(null);

		createFooterCellContext(() => props.column);

		return () => {
			const context = getContext(grid, props.column);

			if (!context) {
				return renderPrimitive(props, { ...grid.getCellProps(props.column) });
			}

			return renderPrimitive(props, { ...grid.getCellProps(props.column) }, () => (
				slots.default ? slots.default(context) : renderFooterContent(context, templates)
			));
		};
	},
});

/**
 * A footer row, `index` from the first one. It counts itself into the grid's `aria-rowcount` while
 * it is mounted. The default slot gets `{ columns }`, the rendered columns, for a `GridFooterCell`
 * each.
 */
export const GridFooterRow = defineComponent({
	name: 'GridFooterRow',
	props: {
		...primitiveProps,
		/** The row's place among the footer rows, from `0`. */
		index: { type: Number, default: 0 },
	},
	slots: Object as SlotsType<{ default?: (context: { columns: readonly RenderedColumn[] }) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();

		let release: (() => void) | null = null;

		// Counted once mounted: a change while the grid element renders would not render it again.
		onMounted(() => {
			release = grid.addFooterRows(1);
		});
		onBeforeUnmount(() => release?.());

		return () => renderPrimitive(props, { ...grid.getFooterRowProps(props.index) }, () => slots.default?.({
			columns: grid.scope.renderedColumns.value,
		}));
	},
});

/**
 * The footer of the grid: sticky at the bottom, measured for the engine's `scrollMarginEnd`. The
 * default slot holds its `GridFooterRow`s.
 */
export const GridFooter = defineComponent({
	name: 'GridFooter',
	props: primitiveProps,
	slots: Object as SlotsType<{ default?: () => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();
		const footRef = forwardElement(grid.foot);

		return () => renderPrimitive(props, { ...grid.getFootProps(), ref: footRef }, () => slots.default?.());
	},
});
