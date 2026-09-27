import type { ColumnSpanCell, RangeBounds, RangeRect } from '@vue-stack/table-core';
import { defineComponent, h, type SlotsType, type VNodeChild } from 'vue';

import { useDataTableContext } from './context';
import { warnMissing } from './warn';

/** What the default slot of `TableRangeOverlay` gets for each piece of a range. */
export interface RangeCellSlotContext {
	/** The range the piece belongs to. */
	rect: RangeRect;
	/** The piece: the columns of the range on one pin side. */
	cell: ColumnSpanCell;
	/** Whether the piece holds the end corner of the last range, where a fill handle goes. */
	corner: boolean;
}

function getRangeKey(bounds: RangeBounds) {
	return `${bounds.rowStart}:${bounds.rowEnd}:${bounds.columnStart}:${bounds.columnEnd}`;
}

/**
 * The cell ranges of the table drawn over the body, from the `ranges` feature: for each range a row at
 * its rows, laid out as the rows under it, which the pointer passes through; the pieces in the range
 * are `range-cell` parts. Put it in `TableBody` after the rows. A range that changes renders this part
 * alone, not a row. It renders nothing without the feature.
 *
 * It draws many elements, a range and its pieces each, so like `TableCells` it has `as` for all of them
 * and no `asChild`. The default slot renders inside each piece in the range and gets
 * `{ rect, cell, corner }`: put a `TableFillHandle` where `corner` is true.
 */
export const TableRangeOverlay = defineComponent({
	name: 'TableRangeOverlay',
	props: {
		/** The element of each range and of each of its pieces. */
		as: { type: String, default: 'div' },
	},
	slots: Object as SlotsType<{ default?: (context: RangeCellSlotContext) => VNodeChild }>,
	setup(props, { slots }) {
		const table = useDataTableContext();

		if (!table.ranges) {
			warnMissing('TableRangeOverlay', 'ranges');
		}

		function renderPiece(rect: RangeRect, cell: ColumnSpanCell, last: RangeRect | undefined) {
			const corner = rect === last && cell.inside && !cell.continues.end;
			const content = cell.inside && slots.default ? [slots.default({ rect, cell, corner })] : undefined;

			return h(props.as, table.getRangeCellProps(cell), content);
		}

		return () => {
			const rects = table.ranges?.rects.value ?? [];
			const last = rects.at(-1);

			return rects.map(rect => h(
				props.as,
				{ ...table.getRangeProps(rect), key: getRangeKey(rect.bounds) },
				rect.cells.map(cell => renderPiece(rect, cell, last)),
			));
		};
	},
});

/**
 * The range a fill of the `fill` feature reaches while its handle is dragged, drawn over the body as a
 * range is, with `data-tc-state="fill"`. Put it in `TableBody` next to `TableRangeOverlay`. It renders
 * nothing without the feature, and nothing while no fill is dragged. `as` is the element of the range
 * and of its pieces.
 */
export const TableFillPreview = defineComponent({
	name: 'TableFillPreview',
	props: {
		/** The element of the range and of each of its pieces. */
		as: { type: String, default: 'div' },
	},
	setup(props) {
		const table = useDataTableContext();

		if (!table.fill) {
			warnMissing('TableFillPreview', 'fill');
		}

		return () => {
			const rect = table.fill?.preview.value;

			return rect
				? h(
					props.as,
					{ ...table.getRangeProps(rect), 'data-tc-state': 'fill' },
					rect.cells.map(cell => h(props.as, table.getRangeCellProps(cell))),
				)
				: null;
		};
	},
});
