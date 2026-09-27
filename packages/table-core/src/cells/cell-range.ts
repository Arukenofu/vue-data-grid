import { type CellAddress, type CellGrid, type CellPosition, isCellAddress } from './cell-address';

/**
 * A range corner. By row key it stays on its row through sorting, inserted rows and streaming; by row
 * index it stays in its place on screen while the data under it changes. An index past the last row
 * stands on the last row.
 */
export type RangeEdge = CellAddress | CellPosition;

/** A range from the corner where selection started to the corner being dragged. */
export interface CellRange {
	anchor: RangeEdge;
	focus: RangeEdge;
}

/** A range in indexes of the rows and the columns of a `CellGrid`, as half-open intervals. */
export interface RangeBounds {
	rowStart: number;
	rowEnd: number;
	columnStart: number;
	columnEnd: number;
}

/** The row index of a corner, with row keys found by `getRowIndex`; `-1` for a row key that is gone. */
export function getEdgeRow(edge: RangeEdge, getRowIndex: (key: string) => number) {
	return isCellAddress(edge) ? getRowIndex(edge.key) : edge.index;
}

/**
 * Range bounds among `columns` (shown column names in display order) and `rowCount` rows, with row keys
 * found by `getRowIndex`. Index rows past the end are clipped; `null` when a corner's column is hidden,
 * its row key is gone, or the whole range is past the end.
 */
export function getRangeBounds(
	range: CellRange,
	columns: readonly string[],
	rowCount: number,
	getRowIndex: (key: string) => number = () => -1,
): RangeBounds | null {
	const anchor = columns.indexOf(range.anchor.column);
	const focus = columns.indexOf(range.focus.column);
	const first = getEdgeRow(range.anchor, getRowIndex);
	const second = getEdgeRow(range.focus, getRowIndex);
	const top = Math.max(Math.min(first, second), 0);
	const bottom = Math.min(Math.max(first, second), rowCount - 1);

	if (anchor === -1 || focus === -1 || first === -1 || second === -1 || top > bottom) {
		return null;
	}

	return {
		rowStart: top,
		rowEnd: bottom + 1,
		columnStart: Math.min(anchor, focus),
		columnEnd: Math.max(anchor, focus) + 1,
	};
}

/** Whether two bounds cover the same cells. */
export function isSameRangeBounds(current: RangeBounds, next: RangeBounds) {
	return current.rowStart === next.rowStart
		&& current.rowEnd === next.rowEnd
		&& current.columnStart === next.columnStart
		&& current.columnEnd === next.columnEnd;
}

/** Whether the cell at row `row` and column `column`, both indexes, is in the bounds. */
export function isInRangeBounds(bounds: RangeBounds, row: number, column: number) {
	return row >= bounds.rowStart && row < bounds.rowEnd && column >= bounds.columnStart && column < bounds.columnEnd;
}

/** Whether every cell of `inner` is in `outer`. */
export function containsRangeBounds(outer: RangeBounds, inner: RangeBounds) {
	return inner.rowStart >= outer.rowStart
		&& inner.rowEnd <= outer.rowEnd
		&& inner.columnStart >= outer.columnStart
		&& inner.columnEnd <= outer.columnEnd;
}

/**
 * The cells of `bounds` outside `cut`, as at most four rectangles: the rows above the cut and the rows
 * below it across the whole width, then the cells before and after it in its rows. `[bounds]` itself
 * when they do not meet, `[]` when the cut takes it all.
 */
export function subtractRangeBounds(bounds: RangeBounds, cut: RangeBounds): RangeBounds[] {
	const rowStart = Math.max(bounds.rowStart, cut.rowStart);
	const rowEnd = Math.min(bounds.rowEnd, cut.rowEnd);
	const columnStart = Math.max(bounds.columnStart, cut.columnStart);
	const columnEnd = Math.min(bounds.columnEnd, cut.columnEnd);

	if (rowStart >= rowEnd || columnStart >= columnEnd) {
		return [bounds];
	}

	const pieces: RangeBounds[] = [];

	if (bounds.rowStart < rowStart) {
		pieces.push({ ...bounds, rowEnd: rowStart });
	}

	if (bounds.columnStart < columnStart) {
		pieces.push({ rowStart, rowEnd, columnStart: bounds.columnStart, columnEnd: columnStart });
	}

	if (columnEnd < bounds.columnEnd) {
		pieces.push({ rowStart, rowEnd, columnStart: columnEnd, columnEnd: bounds.columnEnd });
	}

	if (rowEnd < bounds.rowEnd) {
		pieces.push({ ...bounds, rowStart: rowEnd });
	}

	return pieces;
}

/**
 * The cells of the bounds in a grid, row by row, each once however many bounds hold it: the cells a
 * selection of several ranges covers, such as the ones Delete clears.
 */
export function getRangeCells(bounds: readonly RangeBounds[], grid: CellGrid): CellAddress[] {
	const cells: CellAddress[] = [];
	const seen = bounds.length > 1 ? new Set<string>() : null;

	for (const item of bounds) {
		for (let row = item.rowStart; row < item.rowEnd; row += 1) {
			for (let column = item.columnStart; column < item.columnEnd; column += 1) {
				const cell = { key: grid.keys[row], column: grid.columns[column] };

				if (seen) {
					const id = `${cell.key}\u0000${cell.column}`;

					if (seen.has(id)) {
						continue;
					}

					seen.add(id);
				}

				cells.push(cell);
			}
		}
	}

	return cells;
}
