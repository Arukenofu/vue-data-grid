import type { RenderedColumn, RuntimeColumn } from '../columns/column';

/**
 * A cell in the data: the key of its row and its column name. It follows its row through sorting,
 * inserted rows and streaming, and survives moved columns.
 */
export interface CellAddress {
	key: string;
	column: string;
}

/** A cell on screen: the index of its row in `rows` and its column name. The data under it may change. */
export interface CellPosition {
	index: number;
	column: string;
}

/**
 * The cells a range, a paste or a fill counts in: row keys in the order of `rows` and column names in
 * display order. The indexes of `RangeBounds` are indexes in these two lists.
 */
export interface CellGrid {
	keys: readonly string[];
	columns: readonly string[];
}

/** Whether a column holds data rather than being a service column (`kind: 'service'`). */
export function isDataColumn(column: RuntimeColumn) {
	return column.kind !== 'service';
}

/**
 * The columns of the cells among `columns`, such as `scope.columns`, in their order: spacers of the
 * column window are left out, and so are columns `include` refuses; by default only data columns count.
 */
export function getCellColumns(
	columns: readonly RenderedColumn[],
	include: (column: RuntimeColumn) => boolean = isDataColumn,
): RuntimeColumn[] {
	const result: RuntimeColumn[] = [];

	for (const item of columns) {
		if (item.column && include(item.column)) {
			result.push(item.column);
		}
	}

	return result;
}

/** Whether a cell address is by row key rather than by row index. */
export function isCellAddress(cell: CellAddress | CellPosition): cell is CellAddress {
	return 'key' in cell;
}
