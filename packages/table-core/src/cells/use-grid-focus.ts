import { computed, type MaybeRefOrGetter, shallowRef, toValue } from 'vue';

import type { TableScope } from '../engine/scope';
import { stableComputed } from '../shared/stable-computed';
import { useRowToken } from '../shared/use-row-token';
import { getCellColumns } from './cell-address';
import type { CellMove } from './cell-focus';
import { type GridPosition, type GridSection, resolveGridMove } from './grid-move';

export interface GridFocusOptions {
	/**
	 * Sections of the grid from the top, as `resolveGridMove` takes them: header rows, the body, a
	 * footer. Without it the grid is one body section of the rows and shown columns of the scope.
	 */
	sections?: MaybeRefOrGetter<readonly GridSection[]>;
	/** The section whose rows are `scope.rows`: its cells are held by row key. `'body'` by default. */
	body?: string;
	/**
	 * Called after each move, once scrolling to the cell is requested: set DOM focus here. A cell
	 * outside the row or column window may not be in the DOM until the next render.
	 */
	onFocus?: (cell: FocusedGridCell) => void;
}

/** The focused cell: its place in the grid, and for a body cell the key of its row. */
export interface FocusedGridCell extends GridPosition {
	/** The key of the row of a body cell; `undefined` in other sections. */
	key?: string;
}

export interface GridFocusRequest {
	/** Scroll to the cell and call `onFocus`; `false` only records where focus is. `true` by default. */
	reveal?: boolean;
}

/** Where focus was put: a body row by key, which survives sorting and streaming. */
interface FocusTarget extends FocusedGridCell {
	/** Position of the cell among the cells of its row, for when its key is gone. */
	cellIndex: number;
}

const DEFAULT_BODY = 'body';

const NO_ROWS: readonly number[] = [];

const NO_COLUMNS: readonly string[] = [];

function getRowId(section: string, row: number) {
	return `${row}:${section}`;
}

function isSameCell(current: FocusedGridCell | null, next: FocusedGridCell | null) {
	return current === next || (current !== null && next !== null
		&& current.section === next.section
		&& current.row === next.row
		&& current.cell === next.cell
		&& current.key === next.key);
}

/**
 * Focus of a grid without DOM: which cell of the header, the body or the footer has it, and where a
 * move takes it. Body rows are held by key, so focus follows its row through sorting and streaming;
 * the focused cell stays rendered under the row and column windows. Key bindings, `tabindex` and
 * `element.focus()` stay with the markup: `useGridNavigation` of `@vue-stack/table` binds them.
 *
 * Reactive per row: `isFocused` of a row wakes only when focus enters or leaves it, so a move wakes
 * two rows rather than every cell that asks.
 */
export function useGridFocus(scope: TableScope, options: GridFocusOptions = {}) {
	const body = options.body ?? DEFAULT_BODY;
	const target = shallowRef<FocusTarget | null>(null);

	// The last cell focus was put on: a move goes on from there once its row or column is gone.
	let last: FocusTarget | null = null;

	const defaultSections = computed<readonly GridSection[]>(() => [{
		name: body,
		rows: scope.rows.value.length,
		cells: getCellColumns(scope.columns.value, () => true).map(column => ({ key: column.name })),
	}]);

	function getSections() {
		return options.sections === undefined ? defaultSections.value : toValue(options.sections);
	}

	function findSection(name: string) {
		return getSections().find(section => section.name === name);
	}

	function hasCell(section: GridSection, row: number, cell: string) {
		return row >= 0 && row < section.rows && section.cells.some(item => item.key === cell);
	}

	/** The focused cell; `null` without focus and while its row or its cell is gone. */
	const focused = stableComputed<FocusedGridCell | null>(null, (previous) => {
		const current = target.value;
		const section = current ? findSection(current.section) : undefined;

		if (!current || !section) {
			return null;
		}

		const row = current.key === undefined ? current.row : scope.getRowIndex(current.key);
		const next = hasCell(section, row, current.cell)
			? { section: current.section, row, cell: current.cell, key: current.key }
			: null;

		return isSameCell(previous, next) ? previous : next;
	});

	const focusedRows = useRowToken(() => {
		const cell = focused.value;

		return cell ? { row: getRowId(cell.section, cell.row), token: cell.cell } : null;
	});

	const keepRows = stableComputed<readonly number[]>(NO_ROWS, (previous) => {
		const cell = focused.value;

		if (!cell || cell.section !== body) {
			return NO_ROWS;
		}

		return previous.length === 1 && previous[0] === cell.row ? previous : [cell.row];
	});

	const keepColumns = stableComputed<readonly string[]>(NO_COLUMNS, (previous) => {
		const cell = focused.value?.cell;

		if (cell === undefined) {
			return NO_COLUMNS;
		}

		return previous.length === 1 && previous[0] === cell ? previous : [cell];
	});

	scope.keepRendered({ rows: () => keepRows.value, columns: () => keepColumns.value });

	// A missing row or cell is replaced by whatever now stands at its last place.
	function getOrigin(sections: readonly GridSection[]): GridPosition | null {
		if (focused.value) {
			return focused.value;
		}

		const section = last ? sections.find(item => item.name === last?.section) : undefined;

		if (!last || !section || section.cells.length === 0) {
			return null;
		}

		const keyRow = last.key === undefined ? -1 : scope.getRowIndex(last.key);
		const cell = section.cells.some(item => item.key === last?.cell)
			? last.cell
			: section.cells[Math.min(last.cellIndex, section.cells.length - 1)].key;

		return { section: last.section, row: keyRow === -1 ? last.row : keyRow, cell };
	}

	function getFirstCell(sections: readonly GridSection[]): GridPosition | null {
		for (const section of sections) {
			const cell = section.rows > 0 ? section.cells.find(item => !item.skip) : undefined;

			if (cell) {
				return { section: section.name, row: 0, cell: cell.key };
			}
		}

		return null;
	}

	/**
	 * Focuses a cell, or clears focus with `null`. `false` when the section, the row or the cell is not
	 * in the grid.
	 */
	function focus(position: GridPosition | null, request: GridFocusRequest = {}) {
		if (!position) {
			target.value = null;

			return true;
		}

		const section = findSection(position.section);

		if (!section || !hasCell(section, position.row, position.cell)) {
			return false;
		}

		const key = position.section === body ? scope.rowKeys.value[position.row] : undefined;
		const next: FocusTarget = {
			section: position.section,
			row: position.row,
			cell: position.cell,
			key,
			cellIndex: section.cells.findIndex(item => item.key === position.cell),
		};

		if (!isSameCell(target.value, next) || target.value?.cellIndex !== next.cellIndex) {
			target.value = next;
		}

		last = next;

		if (request.reveal === false) {
			return true;
		}

		if (position.section === body) {
			scope.scrollToRow(position.row, 'auto');
		}

		scope.scrollToColumn(position.cell, 'auto');
		options.onFocus?.({ section: next.section, row: next.row, cell: next.cell, key });

		return true;
	}

	/**
	 * Moves focus through the sections; `step` is how many rows `up` and `down` go, such as
	 * `scope.getPageStep(row, direction)` for PageUp and PageDown. Without focus it goes on from the
	 * last focused cell, or lands on the first cell when none was. `false` when the grid is empty.
	 */
	function move(to: CellMove, step = 1) {
		const sections = getSections();
		const origin = getOrigin(sections);
		const next = origin ? resolveGridMove(sections, origin, to, step) : getFirstCell(sections);

		return next !== null && focus(next);
	}

	return {
		focused,
		focus,
		move,
		/** Whether this cell has focus. Reactive per row: a move wakes only the rows it leaves and enters. */
		isFocused: (position: GridPosition) => focusedRows.get(getRowId(position.section, position.row)) === position.cell,
	};
}

/** Grid focus as `useGridFocus` gives it. */
export type GridFocus = ReturnType<typeof useGridFocus>;
