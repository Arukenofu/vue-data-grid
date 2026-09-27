import {
	type CellAddress,
	type CellMove,
	type CellPosition,
	type CellRanges,
	type RangeEdge,
	resolveCellMove,
} from '@vue-data-grid/core';
import { type MaybeRefOrGetter, toValue, watch } from 'vue';

import { isComposing, isRtl, isShortcutLetter } from '../keyboard/keys';
import type { BodyCellFocus } from '../navigation/body-cell-focus';
import { BODY_SECTION, readGridPosition } from '../navigation/grid-attributes';
import { CONTROL_SELECTOR, DRAG_HANDLE_SELECTOR, DRAGGABLE_ATTRIBUTE } from '../pointer/controls';
import type { AutoScrollOptions } from '../scroll/use-auto-scroll';
import { type CellDragTable, useCellDrag } from './use-cell-drag';

/** What range selection needs of a table; the table of `useDataTable` fits. */
export type RangeSelectionTable = CellDragTable;

export interface RangeSelectionOptions {
	/** The ranges, `useCellRanges()`. */
	ranges: CellRanges;
	/**
	 * Focus of the body cells: `cells` of the grid navigation, or `useCellFocus()` for a grid that keeps
	 * DOM focus on itself. A press focuses its cell through it, and focus moved by a key collapses the
	 * ranges to the focused cell, as the active cell of a spreadsheet does. Without it the table
	 * element takes focus on a press, and Shift with the keys goes from the last range.
	 */
	focus?: BodyCellFocus;
	/**
	 * Scrolling while a drag is near the edges: `useAutoScroll` options, with the sticky header, footer
	 * and pinned columns as margins by default; `false` turns it off.
	 */
	autoScroll?: Omit<AutoScrollOptions, 'onScroll'> | false;
	/** `true` by default. */
	enabled?: MaybeRefOrGetter<boolean>;
}

interface KeyMove {
	plain: CellMove;
	jump: CellMove;
	page?: boolean;
}

const KEY_MOVES: Readonly<Record<string, KeyMove>> = {
	ArrowLeft: { plain: 'left', jump: 'rowStart' },
	ArrowRight: { plain: 'right', jump: 'rowEnd' },
	ArrowUp: { plain: 'up', jump: 'columnStart' },
	ArrowDown: { plain: 'down', jump: 'columnEnd' },
	PageUp: { plain: 'up', jump: 'up', page: true },
	PageDown: { plain: 'down', jump: 'down', page: true },
	Home: { plain: 'rowStart', jump: 'first' },
	End: { plain: 'rowEnd', jump: 'last' },
};

const MIRRORED_KEYS: Readonly<Record<string, string>> = { ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' };

function getCellId(cell: CellAddress | null) {
	return cell ? `${cell.key}\u0000${cell.column}` : null;
}

/**
 * The gestures of cell ranges over a table: a press selects a cell, Shift extends the last range to it
 * and Ctrl or ⌘ adds a new one, or takes cells out of the selection when the cell is selected, as in
 * Excel; a drag extends the range, or the cells taken out, cell by cell, scrolling near the edges;
 * Shift with the arrows, Home, End, PageUp and PageDown extends the range from the focused cell, and
 * with Ctrl or ⌘ to the edge; Ctrl+A or ⌘+A selects every cell, Ctrl+Space or ⌘+Space whole columns,
 * and Escape collapses the ranges to the focused cell.
 *
 * The focused cell stays where the range started, as the active cell of a spreadsheet does: Shift
 * moves the other corner, scrolled into view. The keys are taken on the cells in the capture phase,
 * before the navigation's, so the arrows without Shift still move focus; with DOM focus on the table
 * element, as a grid on `aria-activedescendant` keeps it, they are taken there, on the cell of
 * `focus`. Presses on controls inside cells, a list of an editor included, on a drag handle and on
 * rows dragged as a whole are left to them.
 */
export function useRangeSelection(table: RangeSelectionTable, options: RangeSelectionOptions) {
	const { ranges, focus } = options;
	const { scope } = table;
	let warned = false;

	function isEnabled() {
		return toValue(options.enabled) ?? true;
	}

	function getColumns() {
		return ranges.grid.value.columns;
	}

	/** The body cell a range can hold, from an element inside it; `null` for any other element. */
	function readCell(target: Element | null): CellPosition | null {
		const cell = target?.closest('[data-tc-column]');
		const position = cell ? readGridPosition(cell) : null;

		return position && position.section === BODY_SECTION && getColumns().includes(position.cell)
			? { index: position.row, column: position.cell }
			: null;
	}

	/** Puts DOM focus in the table, where a press that selects cells leaves it. */
	function focusTable() {
		const root = table.root.value;

		if (root && !root.contains(document.activeElement)) {
			root.focus({ preventScroll: true });
		}
	}

	function focusCell(cell: CellPosition) {
		const key = scope.rowKeys.value[cell.index];

		if (focus && key !== undefined) {
			focus.focus({ key, column: cell.column });
		}
	}

	/** Whether the cell is where the last range started, as the active cell of a spreadsheet is. */
	function isAnchor(cell: CellPosition) {
		const anchor = ranges.selectedRanges.value.at(-1)?.anchor;
		const at = anchor ? ranges.resolveEdge(anchor) : null;

		return at !== null && at.index === cell.index && at.column === cell.column;
	}

	/** The focused cell, as a corner. */
	function getFocusedEdge(): RangeEdge | null {
		const cell = focus?.focused.value;

		return cell && getColumns().includes(cell.column) ? ranges.edgeAt(cell) : null;
	}

	/** Extends the last range to `edge`; without a range, from the focused cell. */
	function extendTo(edge: RangeEdge) {
		const origin = getFocusedEdge();

		if (ranges.selectedRanges.value.length === 0 && origin) {
			ranges.select(origin);
		}

		ranges.select(edge, 'extend');
	}

	const drag = useCellDrag(table, {
		getColumns,
		autoScroll: options.autoScroll,
		onCell: cell => ranges.select(ranges.edgeAt(cell), 'extend'),
	});

	/** Whether a row is dragged as a whole, so a press on it is the drag's. */
	function isDraggedWhole(target: Element) {
		const row = target.closest(`[${DRAGGABLE_ATTRIBUTE}]`);

		return row !== null && row.querySelector(DRAG_HANDLE_SELECTOR) === null;
	}

	function warnDraggedWhole() {
		if (__DEV__ && !warned) {
			warned = true;
			// oxlint-disable-next-line no-console
			console.warn(
				'[vue-data-grid] Rows are dragged as a whole, so a press on a cell starts a drag rather than '
				+ 'a range. Drag rows by a handle (`handle: true`) to select cells by dragging.',
			);
		}
	}

	function selectPressed(event: PointerEvent, cell: CellPosition) {
		const edge = ranges.edgeAt(cell);
		const modified = event.ctrlKey || event.metaKey;

		focusTable();

		if (event.shiftKey) {
			extendTo(edge);
		} else if (modified && ranges.isSelected(cell)) {
			// Ctrl on a selected cell takes cells out of the selection; the focused cell stays where it is.
			ranges.select(edge, 'subtract');
		} else {
			ranges.select(edge, modified ? 'add' : 'replace');
			focusCell(cell);
		}
	}

	function handlePointerDown(event: PointerEvent) {
		const target = event.target instanceof Element ? event.target : null;
		const cell = event.button === 0 && isEnabled() ? readCell(target) : null;

		if (!target || !cell || target.closest(`${CONTROL_SELECTOR}, ${DRAG_HANDLE_SELECTOR}`)) {
			return;
		}

		if (isDraggedWhole(target)) {
			warnDraggedWhole();

			return;
		}

		// No native focus or text selection: the press selects cells. The page's own selection goes too,
		// as the browser would drop it on a press, so that a copy takes the cells.
		event.preventDefault();
		document.getSelection()?.removeAllRanges();
		selectPressed(event, cell);
		drag.start(event, cell);
	}

	/** The moving corner of the last range; without a range, the focused cell. */
	function getRangeEnd() {
		const origin = ranges.selectedRanges.value.at(-1)?.focus ?? getFocusedEdge();

		return origin ? ranges.resolveEdge(origin) : null;
	}

	/** Shift with a move key: the other corner of the last range moves, and comes into view. */
	function extendByKey(event: KeyboardEvent, move: KeyMove) {
		const from = getRangeEnd();

		if (!from) {
			return;
		}

		const columns = getColumns();
		const cellMove = event.ctrlKey || event.metaKey ? move.jump : move.plain;
		const step = move.page ? scope.getPageStep(from.index, cellMove === 'up' ? 'up' : 'down') : 1;
		const next = resolveCellMove(
			{ row: from.index, column: columns.indexOf(from.column) },
			cellMove,
			{ rows: scope.rows.value.length, columns: columns.length },
			step,
		);

		if (!next) {
			return;
		}

		const column = columns[next.column];

		extendTo(ranges.edgeAt({ index: next.row, column }));
		scope.scrollToRow(next.row, 'auto');
		scope.scrollToColumn(column, 'auto');
	}

	/** The columns of the last range, or of the focused cell, from the first row to the last. */
	function selectColumns() {
		const last = ranges.bounds.value.at(-1);
		const focused = focus?.focused.value;
		const columns = getColumns();
		const rowCount = scope.rows.value.length;
		const start = last ? last.columnStart : columns.indexOf(focused?.column ?? '');
		const end = last ? last.columnEnd : start + 1;

		if (rowCount > 0 && start !== -1) {
			ranges.selectBounds({ rowStart: 0, rowEnd: rowCount, columnStart: start, columnEnd: end });
		}
	}

	/** Escape: the ranges collapse to the cell; `false` when they already are that cell alone. */
	function collapseTo(cell: CellPosition) {
		const [only, ...others] = ranges.bounds.value;
		const column = getColumns().indexOf(cell.column);
		const collapsed = only !== undefined && others.length === 0
			&& only.rowStart === cell.index && only.rowEnd === cell.index + 1
			&& only.columnStart === column && only.columnEnd === column + 1;

		if (collapsed) {
			return false;
		}

		ranges.select(ranges.edgeAt(cell));

		return true;
	}

	/**
	 * The cell a key is on: the focused cell itself, or with focus on the table element, as a grid on
	 * `aria-activedescendant` keeps it, the focused cell of `focus`. Keys inside the content of a cell
	 * are the content's.
	 */
	function readKeyCell(target: HTMLElement): CellPosition | null {
		if (target.hasAttribute('data-tc-column')) {
			return readCell(target);
		}

		const focused = target === table.root.value ? focus?.focused.value : null;

		return focused && getColumns().includes(focused.column) ? { index: focused.index, column: focused.column } : null;
	}

	function handleKeyDown(event: KeyboardEvent) {
		const target = event.target instanceof HTMLElement ? event.target : null;
		const cell = target && isEnabled() && !event.defaultPrevented && !isComposing(event) ? readKeyCell(target) : null;

		if (!cell) {
			return;
		}

		const modified = event.ctrlKey || event.metaKey;
		const move = KEY_MOVES[isRtl(table.root.value) ? MIRRORED_KEYS[event.key] ?? event.key : event.key];

		if (move && event.shiftKey && !event.altKey) {
			event.preventDefault();
			extendByKey(event, move);
		} else if (modified && !event.altKey && !event.shiftKey && isShortcutLetter(event, 'a')) {
			event.preventDefault();
			ranges.selectAll();
		} else if (modified && !event.altKey && event.key === ' ') {
			event.preventDefault();
			selectColumns();
		} else if (event.key === 'Escape' && !modified && collapseTo(cell)) {
			event.preventDefault();
		}
	}

	// Focus that moves off the start of the last range, by a key or by code, starts over from the focused
	// cell. The row's place does not count: a sort moves it, and the ranges stay.
	if (focus) {
		watch(() => getCellId(focus.focused.value), () => {
			const cell = focus.focused.value;

			if (cell && getColumns().includes(cell.column) && !isAnchor(cell)) {
				ranges.select(ranges.edgeAt(cell));
			}
		}, { flush: 'sync' });
	}

	watch(() => table.root.value, (root, _previous, onCleanup) => {
		if (!root) {
			return;
		}

		root.addEventListener('pointerdown', handlePointerDown);
		root.addEventListener('keydown', handleKeyDown, { capture: true });
		onCleanup(() => {
			root.removeEventListener('pointerdown', handlePointerDown);
			root.removeEventListener('keydown', handleKeyDown, { capture: true });
		});
	}, { immediate: true, flush: 'sync' });

	return {
		/** Whether a drag is selecting cells now. */
		dragging: drag.dragging,
	};
}

/** The gestures of cell ranges as `useRangeSelection` gives them. */
export type RangeSelection = ReturnType<typeof useRangeSelection>;
