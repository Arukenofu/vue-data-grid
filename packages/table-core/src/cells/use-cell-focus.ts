import { computed } from 'vue';

import type { TableScope } from '../engine/scope';
import { useRowToken } from '../shared/use-row-token';
import type { CellAddress, CellPosition } from './cell-address';
import type { CellMove } from './cell-focus';
import { type FocusedGridCell, type GridFocusRequest, useGridFocus } from './use-grid-focus';

/** The focused body cell by both its addresses: the key of its row, and its index in `rows`. */
export interface FocusedCell extends CellAddress, CellPosition {}

export interface CellFocusOptions {
	/**
	 * Called after each move, once scrolling to the cell is requested: set DOM focus here. A cell
	 * outside the row or column window may not be in the DOM until the next render.
	 */
	onFocus?: (cell: FocusedCell) => void;
}

/** Whether a move scrolls to the cell and calls `onFocus`. */
export type CellFocusRequest = GridFocusRequest;

function toFocusedCell(cell: FocusedGridCell): FocusedCell | null {
	return cell.key === undefined ? null : { key: cell.key, column: cell.cell, index: cell.row };
}

/**
 * Cell focus in the body alone: `useGridFocus` with one section of the rows and shown columns, and
 * cells addressed by row key and column name. The row is held by key, so focus follows it through
 * sorting and streaming; the focused cell stays rendered under the row and column windows. Key
 * bindings, `tabindex` and `element.focus()` stay with the markup.
 *
 * Reactive per row: `isFocused` and `getFocusedColumn` of a row wake only when focus enters or leaves
 * it, so a move wakes two rows rather than every cell that asks.
 */
export function useCellFocus(scope: TableScope, options: CellFocusOptions = {}) {
	const grid = useGridFocus(scope, {
		onFocus: (cell) => {
			const focused = toFocusedCell(cell);

			if (focused) {
				options.onFocus?.(focused);
			}
		},
	});

	/** The focused cell; `null` while its row is removed or its column hidden. */
	const focused = computed<FocusedCell | null>(() => (grid.focused.value ? toFocusedCell(grid.focused.value) : null));

	const focusedRows = useRowToken(() => (focused.value ? { row: focused.value.key, token: focused.value.column } : null));

	/** Focuses a cell, or clears focus with `null`; `false` when the row or a shown column is missing. */
	function focus(target: CellAddress | null, request: CellFocusRequest = {}) {
		if (!target) {
			return grid.focus(null);
		}

		const row = scope.getRowIndex(target.key);

		return row !== -1 && grid.focus({ section: 'body', row, cell: target.column }, request);
	}

	return {
		focused,
		/** Whether this cell has focus. Reactive per row, like `getFocusedColumn`. */
		isFocused: (cell: CellAddress) => focusedRows.get(cell.key) === cell.column,
		/**
		 * The column of the focused cell in the row with this key, `undefined` in other rows: a memo token
		 * of the row. Reactive per row.
		 */
		getFocusedColumn: (key: string) => focusedRows.get(key),
		focus,
		/**
		 * Moves focus; `step` is how many rows `up` and `down` go, `scope.getPageStep(index, direction)`
		 * for PageUp and PageDown. Without focus the first move lands on the first cell.
		 */
		move: (to: CellMove, step?: number) => grid.move(to, step),
	};
}

/** Cell focus as `useCellFocus` gives it. */
export type CellFocus = ReturnType<typeof useCellFocus>;
