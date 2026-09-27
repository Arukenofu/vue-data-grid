import { getColumnCellSelector, type GridPosition } from '@vue-data-grid/engine';

const SECTION_ATTRIBUTE = 'data-dg-grid-section';
const ROW_ATTRIBUTE = 'data-dg-grid-row';
const CELL_ATTRIBUTE = 'data-dg-grid-cell';
const COLUMN_ATTRIBUTE = 'data-dg-column';

/** The section of the body rows, as `useTableProps` names it: the rows of the scope. */
export const BODY_SECTION = 'body';

export const GRID_ROW_SELECTOR = `[${SECTION_ATTRIBUTE}]`;

export const GRID_CELL_SELECTOR = `[${CELL_ATTRIBUTE}],[${COLUMN_ATTRIBUTE}]`;

const cellAttributes = new Map<string, Readonly<Record<string, string>>>();

function quote(value: string) {
	return `"${value.replace(/["\\]/g, '\\$&')}"`;
}

/** Attributes of a grid row: the section it belongs to and its index there. */
export function getGridRowAttributes(section: string, row: number) {
	return { [SECTION_ATTRIBUTE]: section, [ROW_ATTRIBUTE]: row };
}

/**
 * Attributes of a grid cell that is not a column cell: a group cell, a service cell. A cell with
 * `data-dg-column`, as core `cellProps` and `headerProps` put it, is found by it and needs none. One
 * frozen object per key.
 */
export function getGridCellAttributes(key: string) {
	let attributes = cellAttributes.get(key);

	if (!attributes) {
		attributes = Object.freeze({ [CELL_ATTRIBUTE]: key });
		cellAttributes.set(key, attributes);
	}

	return attributes;
}

/** The position of a grid cell element, from the attributes of the cell and its row. */
export function readGridPosition(cell: Element): GridPosition | null {
	const row = cell.closest(GRID_ROW_SELECTOR);
	const section = row?.getAttribute(SECTION_ATTRIBUTE);
	const index = Number(row?.getAttribute(ROW_ATTRIBUTE));
	const key = cell.getAttribute(CELL_ATTRIBUTE) ?? cell.getAttribute(COLUMN_ATTRIBUTE);

	return section && key !== null && Number.isInteger(index) ? { section, row: index, cell: key } : null;
}

/** The element of a grid row inside `grid`; `null` while it is not rendered. */
export function findGridRow(grid: ParentNode, section: string, row: number) {
	return grid.querySelector<HTMLElement>(`[${SECTION_ATTRIBUTE}=${quote(section)}][${ROW_ATTRIBUTE}="${row}"]`);
}

/** The element of a grid cell inside `grid`; `null` while it is not rendered. */
export function findGridCell(grid: ParentNode, position: GridPosition) {
	const row = findGridRow(grid, position.section, position.row);

	return row?.querySelector<HTMLElement>(`[${CELL_ATTRIBUTE}=${quote(position.cell)}]`)
		?? row?.querySelector<HTMLElement>(getColumnCellSelector(position.cell))
		?? null;
}
