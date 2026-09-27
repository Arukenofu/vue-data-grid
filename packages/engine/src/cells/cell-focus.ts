/** A cell by numbers: the index of its row in `rows` and of its column among the shown columns. */
export interface CellIndex {
	row: number;
	column: number;
}

/**
 * A focus move. `rowStart` and `rowEnd` go to the ends of the row (usually Home, End), `columnStart`
 * and `columnEnd` to the ends of the column (Ctrl+↑, Ctrl+↓), `first` and `last` to the corners of
 * the grid (Ctrl+Home, Ctrl+End).
 */
export type CellMove =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'rowStart'
	| 'rowEnd'
	| 'columnStart'
	| 'columnEnd'
	| 'first'
	| 'last';

export interface CellGridSize {
	rows: number;
	columns: number;
}

function clamp(value: number, max: number) {
	return Math.min(Math.max(value, 0), max);
}

/**
 * The cell after a move from `from` in a grid of `size`; `step` is how many rows `up` and `down` go,
 * the page height for PageUp and PageDown. `null` for an empty grid. Moves stop at the edge instead
 * of wrapping.
 */
export function resolveCellMove(from: CellIndex, move: CellMove, size: CellGridSize, step = 1) {
	if (size.rows === 0 || size.columns === 0) {
		return null;
	}

	const lastRow = size.rows - 1;
	const lastColumn = size.columns - 1;
	const row = clamp(from.row, lastRow);
	const column = clamp(from.column, lastColumn);

	switch (move) {
		case 'up':
			return { row: clamp(row - step, lastRow), column };
		case 'down':
			return { row: clamp(row + step, lastRow), column };
		case 'left':
			return { row, column: clamp(column - 1, lastColumn) };
		case 'right':
			return { row, column: clamp(column + 1, lastColumn) };
		case 'rowStart':
			return { row, column: 0 };
		case 'rowEnd':
			return { row, column: lastColumn };
		case 'columnStart':
			return { row: 0, column };
		case 'columnEnd':
			return { row: lastRow, column };
		case 'first':
			return { row: 0, column: 0 };
		case 'last':
			return { row: lastRow, column: lastColumn };
	}
}
