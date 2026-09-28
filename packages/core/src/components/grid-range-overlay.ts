import type { ColumnSpanCell, RangeBounds, RangeRect } from '@vue-data-grid/engine';
import { defineComponent, h, type SlotsType, type VNodeChild } from 'vue';

import { useDataGridContext } from './context';
import { warnMissing } from './warn';

/** What the default slot of `GridRangeOverlay` gets for each piece of a range. */
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
 * The cell ranges of the grid drawn over the body, from the `ranges` feature: for each range a row at
 * its rows, laid out as the rows under it, which the pointer passes through; the pieces in the range
 * are `range-cell` parts. Put it in `GridBody` after the rows. A range that changes renders this part
 * alone, not a row. It renders nothing without the feature.
 *
 * It draws many elements, a range and its pieces each, so like `GridCells` it has `as` for all of them
 * and no `asChild`. The default slot renders inside each piece in the range and gets
 * `{ rect, cell, corner }`: put a `GridFillHandle` where `corner` is true.
 */
export const GridRangeOverlay = defineComponent({
	name: 'GridRangeOverlay',
	props: {
		/** The element of each range and of each of its pieces. */
		as: { type: String, default: 'div' },
	},
	slots: Object as SlotsType<{ default?: (context: RangeCellSlotContext) => VNodeChild }>,
	setup(props, { slots }) {
		const grid = useDataGridContext();

		if (!grid.ranges) {
			warnMissing('GridRangeOverlay', 'ranges');
		}

		function renderPiece(rect: RangeRect, cell: ColumnSpanCell, last: RangeRect | undefined) {
			const corner = rect === last && cell.inside && !cell.continues.end;
			const content = cell.inside && slots.default ? [slots.default({ rect, cell, corner })] : undefined;

			return h(props.as, grid.getRangeCellProps(cell), content);
		}

		return () => {
			const rects = grid.ranges?.rects.value ?? [];
			const last = rects.at(-1);

			return rects.map(rect => h(
				props.as,
				{ ...grid.getRangeProps(rect), key: getRangeKey(rect.bounds) },
				rect.cells.map(cell => renderPiece(rect, cell, last)),
			));
		};
	},
});

/**
 * The range a fill of the `fill` feature reaches while its handle is dragged, drawn over the body as a
 * range is, with `data-dg-state="fill"`. Put it in `GridBody` next to `GridRangeOverlay`. It renders
 * nothing without the feature, and nothing while no fill is dragged. `as` is the element of the range
 * and of its pieces.
 */
export const GridFillPreview = defineComponent({
	name: 'GridFillPreview',
	props: {
		/** The element of the range and of each of its pieces. */
		as: { type: String, default: 'div' },
	},
	setup(props) {
		const grid = useDataGridContext();

		if (!grid.fill) {
			warnMissing('GridFillPreview', 'fill');
		}

		return () => {
			const rect = grid.fill?.preview.value;

			return rect
				? h(
					props.as,
					{ ...grid.getRangeProps(rect), 'data-dg-state': 'fill' },
					rect.cells.map(cell => h(props.as, grid.getRangeCellProps(cell))),
				)
				: null;
		};
	},
});
