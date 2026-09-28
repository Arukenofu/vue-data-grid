import { type CellMove, resolveCellMove } from './cell-focus';

/** A cell of a grid row. `span` is how many columns it covers, `1` by default: a group cell covers several. */
export interface SectionCell {
	key: string;
	span?: number;
	/**
	 * Focus passes over the cell, such as the empty cell of a group row over a column without a group,
	 * which the header below covers: a move goes on to the next cell that takes focus, or stays.
	 */
	skip?: boolean;
}

/**
 * A part of the grid, stacked with the others from the top: header rows, pinned rows, the body, a
 * footer. Every row of a section has the same cells. Sections should cover the same columns, so a
 * group row fills the columns without a group with cells of its own.
 */
export interface GridSection {
	name: string;
	/** Rows in the section; a section without rows is skipped. */
	rows: number;
	/** The cells of each of its rows, from the start edge. */
	cells: readonly SectionCell[];
}

/** A cell of the grid: a section, a row inside it and a cell key inside the row. */
export interface GridPosition {
	section: string;
	row: number;
	cell: string;
}

const ROW_MOVES: ReadonlySet<CellMove> = new Set(['left', 'right', 'rowStart', 'rowEnd']);

interface FlatRow {
	section: GridSection;
	row: number;
}

function countRows(section: GridSection) {
	return section.cells.length > 0 ? Math.max(section.rows, 0) : 0;
}

function toFlatRow(sections: readonly GridSection[], position: GridPosition) {
	let flat = 0;

	for (const section of sections) {
		const rows = countRows(section);

		if (section.name === position.section) {
			return rows > 0 ? flat + Math.min(Math.max(position.row, 0), rows - 1) : null;
		}

		flat += rows;
	}

	return null;
}

function fromFlatRow(sections: readonly GridSection[], flat: number): FlatRow | null {
	let rest = flat;

	for (const section of sections) {
		const rows = countRows(section);

		if (rest < rows) {
			return { section, row: rest };
		}

		rest -= rows;
	}

	return null;
}

function getStartColumn(cells: readonly SectionCell[], index: number) {
	let column = 0;

	for (let position = 0; position < index; position += 1) {
		column += cells[position].span ?? 1;
	}

	return column;
}

function findCellAtColumn(cells: readonly SectionCell[], column: number) {
	let end = 0;

	for (const cell of cells) {
		end += cell.span ?? 1;

		if (column < end) {
			return cell;
		}
	}

	return cells[cells.length - 1];
}

function alignCell(from: readonly SectionCell[], index: number, to: readonly SectionCell[]) {
	const key = from[index]?.key;

	return to.find(cell => cell.key === key) ?? findCellAtColumn(to, getStartColumn(from, index));
}

/** Whether a move goes towards the start of its row or column when it lands on a cell to skip. */
const BACKWARD_MOVES: ReadonlySet<CellMove> = new Set(['left', 'rowEnd', 'up', 'columnEnd', 'last']);

function findInRow(cells: readonly SectionCell[], from: number, backward: boolean) {
	for (let index = from; index >= 0 && index < cells.length; index += backward ? -1 : 1) {
		if (!cells[index].skip) {
			return cells[index];
		}
	}

	return null;
}

/**
 * The first cell that takes focus from row `flat` on, one row at a time towards the start or the end
 * of the grid: over the same column, or for `first` and `last` the first or the last cell of a row.
 */
function findInColumn(sections: readonly GridSection[], flat: number, backward: boolean, pick: (cells: readonly SectionCell[]) => SectionCell | null) {
	for (let row = flat; row >= 0; row += backward ? -1 : 1) {
		const target = fromFlatRow(sections, row);

		if (!target) {
			return null;
		}

		const cell = pick(target.section.cells);

		if (cell) {
			return { section: target.section.name, row: target.row, cell: cell.key };
		}
	}

	return null;
}

/**
 * The cell after a move in a grid of sections stacked from the top. Rows are counted across
 * sections, so `up` from the first body row lands in the header and `down` from the last one in the
 * footer. A move along the row stays among the cells of its section. A move to another row keeps
 * the cell by key; a row without that key gives the cell over the same column, so a group cell and
 * the columns under it lead to each other. `step` is how many rows `up` and `down` go. `null` when
 * the grid is empty or `from` names a section that is not in it.
 */
export function resolveGridMove(
	sections: readonly GridSection[],
	from: GridPosition,
	move: CellMove,
	step = 1,
): GridPosition | null {
	const flat = toFlatRow(sections, from);
	const origin = flat === null ? null : fromFlatRow(sections, flat);

	if (flat === null || !origin) {
		return null;
	}

	const cells = origin.section.cells;
	const index = Math.max(cells.findIndex(cell => cell.key === from.cell), 0);
	const total = sections.reduce((sum, section) => sum + countRows(section), 0);
	const next = resolveCellMove({ row: flat, column: index }, move, { rows: total, columns: cells.length }, step);
	const target = next && fromFlatRow(sections, next.row);

	if (!next || !target) {
		return null;
	}

	const targetCells = target.section.cells;
	let cell: SectionCell;

	if (ROW_MOVES.has(move)) {
		cell = cells[next.column];
	} else if (move === 'first' || move === 'last') {
		cell = move === 'first' ? targetCells[0] : targetCells[targetCells.length - 1];
	} else {
		cell = alignCell(cells, index, targetCells);
	}

	if (!cell.skip) {
		return { section: target.section.name, row: target.row, cell: cell.key };
	}

	const stay = { section: origin.section.name, row: origin.row, cell: cells[index].key };

	if (ROW_MOVES.has(move)) {
		const found = findInRow(cells, next.column, BACKWARD_MOVES.has(move));

		return found ? { ...stay, cell: found.key } : stay;
	}

	const pick = (row: readonly SectionCell[]) => (move === 'first' || move === 'last'
		? findInRow(row, move === 'first' ? 0 : row.length - 1, move === 'last')
		: skipCell(alignCell(cells, index, row)));

	// A jump to an edge of the grid comes back from the edge. A move of a row or a page goes on in its
	// direction, such as to a group a level higher, and comes back towards where it started only when
	// nothing further takes focus.
	if (move === 'first' || move === 'last' || move === 'columnStart' || move === 'columnEnd') {
		return findInColumn(sections, next.row, BACKWARD_MOVES.has(move), pick) ?? stay;
	}

	const upward = next.row < flat;

	return findInColumn(sections, next.row, upward, pick) ?? findInColumn(sections, next.row, !upward, pick) ?? stay;
}

function skipCell(cell: SectionCell) {
	return cell.skip ? null : cell;
}
