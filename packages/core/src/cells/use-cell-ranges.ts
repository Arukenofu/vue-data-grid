import { computed, type ComputedRef, type Ref } from 'vue';

import type { RuntimeColumn } from '../columns/column';
import type { TableScope } from '../engine/scope';
import type { ColumnSpanCell } from '../render/column-span';
import { stableComputed } from '../shared/stable-computed';
import { useModelRef } from '../shared/use-model-ref';
import { type CellAddress, type CellGrid, type CellPosition, getCellColumns, isCellAddress } from './cell-address';
import {
	type CellRange,
	containsRangeBounds,
	getEdgeRow,
	getRangeBounds,
	getRangeCells,
	isSameRangeBounds,
	type RangeBounds,
	type RangeEdge,
	subtractRangeBounds,
} from './cell-range';
import { toCsv } from './csv';

/**
 * `replace` starts one new range, `extend` drags the last one, `add` adds another, and `subtract`
 * takes cells out of the ranges, as Ctrl on a selected cell of a spreadsheet does. `extend` after
 * `add` or `subtract` goes on with it.
 */
export type RangeSelectMode = 'replace' | 'extend' | 'add' | 'subtract';

/**
 * What the corners a composable makes itself address their rows by: `'key'` keeps a range on its rows
 * through sorting and streaming, `'index'` keeps it in its place on screen.
 */
export type RangeCorners = 'key' | 'index';

export interface RangeTextOptions {
	/** Start with a line of column headers. */
	headers?: boolean;
}

export interface CellRangesOptions {
	/**
	 * An external model, for `v-model`; without it the composable keeps its own. `defineModel` returns a
	 * written value only after the parent re-renders, so changes are made against an internal copy.
	 */
	ranges?: Ref<readonly CellRange[]>;
	/** Which shown columns ranges span; the data columns by default, without service columns. */
	canSelectColumn?: (column: RuntimeColumn) => boolean;
	/** What `edgeAt` addresses rows by, and with it every corner the composable makes; `'key'` by default. Read once. */
	corners?: RangeCorners;
}

/** A range to draw over the body: its rows in pixels, its columns as a span of the row. */
export interface RangeRect {
	/** The range in indexes, as in `bounds`. */
	bounds: RangeBounds;
	/** Offset of its first row from the top of the first row, px: the `top` of a positioned row. */
	top: number;
	/** The height of its rows, px. */
	height: number;
	/**
	 * A row across the table from `scope.getColumnSpan`: the cells with `inside` are the range, one for
	 * each pin side it crosses, and the others hold the place of the columns around it.
	 */
	cells: readonly ColumnSpanCell[];
}

const NO_RANGES: readonly CellRange[] = [];

const NO_BOUNDS: readonly RangeBounds[] = [];

// Bounds that no range contains, for a range that fell out.
const NO_CELLS: RangeBounds = { rowStart: -1, rowEnd: -1, columnStart: -1, columnEnd: -1 };

const NO_RECTS: readonly RangeRect[] = [];

const NO_COLUMNS: ReadonlySet<string> = new Set();

// Clipped to the last row, so a range to it keeps every row that comes.
const PAST_LAST_ROW = Number.MAX_SAFE_INTEGER;

/** An `add` or a `subtract` that `extend` goes on with: the ranges it started from and its first corner. */
interface RangeGesture {
	mode: 'add' | 'subtract';
	base: readonly CellRange[];
	anchor: RangeEdge;
	/** The ranges it wrote last: once they are replaced, from outside too, `extend` is plain again. */
	written: readonly CellRange[];
}

// Rows asked about at once are the rendered ones. The cache only shares a row's computed among its
// cells, so dropping it all at once costs a recomputation and nothing else.
const ROW_CACHE_LIMIT = 512;

function isSameList<TItem>(current: readonly TItem[], next: readonly TItem[], isSame: (a: TItem, b: TItem) => boolean) {
	return current.length === next.length && current.every((item, index) => isSame(item, next[index]));
}

function isSameSet(current: ReadonlySet<string>, next: ReadonlySet<string>) {
	return current.size === next.size && [...next].every(name => current.has(name));
}

function isSameRect(current: RangeRect, next: RangeRect) {
	return isSameRangeBounds(current.bounds, next.bounds)
		&& current.top === next.top
		&& current.height === next.height
		&& current.cells === next.cells;
}

function isSameGrid(current: CellGrid | null, next: CellGrid): current is CellGrid {
	return current !== null && current.keys === next.keys && isSameList(current.columns, next.columns, Object.is);
}

/**
 * Cell range selection, its rectangles over the body, its cells and its text for the clipboard.
 * Gestures, the overlay and the clipboard write stay with the markup; only range corners come in here.
 *
 * Reactive per row: `isSelected` and `getSelectedColumns` of a row wake only when a cell of that row
 * enters or leaves a range. Drawing ranges from `rects` as one overlay re-renders no cell at all.
 */
export function useCellRanges(scope: TableScope, options: CellRangesOptions = {}) {
	const ranges = useModelRef(options.ranges, NO_RANGES);
	const corners = options.corners ?? 'key';

	const columns = computed(() => getCellColumns(scope.columns.value, options.canSelectColumn));

	/** The rows and the columns ranges count in: the indexes of `bounds` are indexes here. The same object while they hold. */
	const grid = stableComputed<CellGrid, null>(null, (previous) => {
		const next = { keys: scope.rowKeys.value, columns: columns.value.map(column => column.name) };

		return isSameGrid(previous, next) ? previous : next;
	});

	function getBounds(range: CellRange) {
		return getRangeBounds(range, grid.value.columns, scope.rows.value.length, scope.getRowIndex);
	}

	// The same array while the ranges cover the same cells: a new row of data under them changes nothing.
	const bounds = stableComputed<readonly RangeBounds[]>(NO_BOUNDS, (previous) => {
		const next = ranges.value.flatMap(range => getBounds(range) ?? []);

		return isSameList(previous, next, isSameRangeBounds) ? previous : next;
	});

	/**
	 * Bounds in indexes of `grid` as a rectangle to draw over the body, as `rects` gives them, such as
	 * the target of a fill; `null` when a column is gone.
	 */
	function toRect(item: RangeBounds): RangeRect | null {
		const first = scope.getColumn(grid.value.columns[item.columnStart]);
		const last = scope.getColumn(grid.value.columns[item.columnEnd - 1]);

		if (!first || !last) {
			return null;
		}

		const top = scope.getRowOffset(item.rowStart);

		return {
			bounds: item,
			top,
			height: scope.getRowOffset(item.rowEnd) - top,
			cells: scope.getColumnSpan(first.index, last.index + 1),
		};
	}

	const rects = stableComputed<readonly RangeRect[]>(NO_RECTS, (previous) => {
		const next = bounds.value.flatMap((item, index) => {
			const rect = toRect(item);
			const before = previous[index];

			if (!rect) {
				return [];
			}

			return before && isSameRect(before, rect) ? before : rect;
		});

		return isSameList(previous, next, Object.is) ? previous : next;
	});

	const rowColumns = new Map<number, ComputedRef<ReadonlySet<string>>>();

	function collectColumns(index: number) {
		let result: Set<string> | null = null;

		for (const item of bounds.value) {
			if (index >= item.rowStart && index < item.rowEnd) {
				result ??= new Set();

				for (let column = item.columnStart; column < item.columnEnd; column += 1) {
					result.add(grid.value.columns[column]);
				}
			}
		}

		return result ?? NO_COLUMNS;
	}

	/**
	 * Names of the cells in any range in the row at `index`, the same set while they hold: it serves as
	 * a memo token of the row. Reactive per row.
	 */
	function getSelectedColumns(index: number) {
		let entry = rowColumns.get(index);

		if (!entry) {
			if (rowColumns.size >= ROW_CACHE_LIMIT) {
				rowColumns.clear();
			}

			entry = stableComputed<ReadonlySet<string>>(NO_COLUMNS, (previous) => {
				const next = collectColumns(index);

				return isSameSet(previous, next) ? previous : next;
			});
			rowColumns.set(index, entry);
		}

		return entry.value;
	}

	/** Whether a cell is in any range, by row key or by row index. Reactive per row, like `getSelectedColumns`. */
	function isSelected(cell: CellAddress | CellPosition) {
		const index = isCellAddress(cell) ? scope.getRowIndex(cell.key) : cell.index;

		return index !== -1 && getSelectedColumns(index).has(cell.column);
	}

	/** The corner at a cell on screen, addressed by the `corners` option. */
	function edgeAt(cell: CellPosition): RangeEdge {
		const key = corners === 'key' ? scope.rowKeys.value[cell.index] : undefined;

		return key === undefined ? { index: cell.index, column: cell.column } : { key, column: cell.column };
	}

	/**
	 * The cell a corner stands on now; `null` once its row or column is gone. A corner by index past the
	 * last row stands on the last row.
	 */
	function resolveEdge(edge: RangeEdge): CellPosition | null {
		const row = Math.min(getEdgeRow(edge, scope.getRowIndex), scope.rows.value.length - 1);

		return row >= 0 && grid.value.columns.includes(edge.column) ? { index: row, column: edge.column } : null;
	}

	/** A range over bounds, its corners addressed by the `corners` option. */
	function toRange(item: RangeBounds): CellRange {
		const { columns: names } = grid.value;

		return {
			anchor: edgeAt({ index: item.rowStart, column: names[item.columnStart] }),
			focus: edgeAt({ index: item.rowEnd - 1, column: names[item.columnEnd - 1] }),
		};
	}

	/** `base` and the new range, without the ranges it covers: they would only lie under it. */
	function addRange(base: readonly CellRange[], range: CellRange) {
		const outer = getBounds(range);
		const kept = outer ? base.filter(item => !containsRangeBounds(outer, getBounds(item) ?? NO_CELLS)) : base;

		return [...kept, range];
	}

	/** `base` without the cells of `cut`: a range it meets is cut into the rectangles left around it. */
	function subtractRange(base: readonly CellRange[], cut: CellRange) {
		const inner = getBounds(cut);

		if (!inner) {
			return base;
		}

		return base.flatMap((range) => {
			const outer = getBounds(range);
			const pieces = outer ? subtractRangeBounds(outer, inner) : [];

			return !outer || pieces[0] === outer ? [range] : pieces.map(toRange);
		});
	}

	let gesture: RangeGesture | null = null;

	function apply(mode: RangeGesture['mode'], base: readonly CellRange[], anchor: RangeEdge, focus: RangeEdge) {
		const range = { anchor, focus };
		const next = mode === 'add' ? addRange(base, range) : subtractRange(base, range);

		ranges.value = next;
		gesture = { mode, base, anchor, written: next };
	}

	/** Drags the last range to `edge`; a range whose first corner is gone starts over at `edge`. */
	function extend(current: readonly CellRange[], last: CellRange, edge: RangeEdge) {
		const anchor = resolveEdge(last.anchor) ? last.anchor : edge;

		ranges.value = [...current.slice(0, -1), { anchor, focus: edge }];
	}

	/**
	 * Changes the ranges from a corner, by `mode`. `add` drops the ranges the new one covers, and
	 * `subtract` cuts the ranges it meets into the rectangles left around the cell. An `extend` right
	 * after them goes on from the ranges they started from: a range the added one grows over drops
	 * out, a cut grows, and both come back as it shrinks, as a drag with Ctrl does.
	 */
	function select(edge: RangeEdge, mode: RangeSelectMode = 'replace') {
		const current = ranges.value;
		const last = current.at(-1);
		const pending = gesture?.written === current ? gesture : null;

		gesture = null;

		if (mode === 'extend' && pending) {
			apply(pending.mode, pending.base, pending.anchor, edge);
		} else if (mode === 'add' || mode === 'subtract') {
			apply(mode, current, edge, edge);
		} else if (mode === 'extend' && last) {
			extend(current, last, edge);
		} else {
			ranges.value = [{ anchor: edge, focus: edge }];
		}
	}

	/** Replaces the ranges with one over bounds in indexes of `grid`, such as the cells a paste wrote. */
	function selectBounds(item: RangeBounds) {
		gesture = null;
		ranges.value = [toRange(item)];
	}

	/**
	 * Selects every cell: corners by index from the first row to past the last, so the range keeps
	 * every row through sorting and rows that come later.
	 */
	function selectAll() {
		const names = grid.value.columns;
		const first = names.at(0);
		const last = names.at(-1);

		gesture = null;

		if (scope.rows.value.length > 0 && first !== undefined && last !== undefined) {
			ranges.value = [{ anchor: { index: 0, column: first }, focus: { index: PAST_LAST_ROW, column: last } }];
		}
	}

	function clear() {
		gesture = null;

		if (ranges.value.length > 0) {
			ranges.value = NO_RANGES;
		}
	}

	/** The cells of bounds, each once, by row key: those of every range by default. */
	function getCells(items: readonly RangeBounds[] = bounds.value) {
		return getRangeCells(items, grid.value);
	}

	function toText(item: RangeBounds, text: RangeTextOptions) {
		return toCsv({
			columns: columns.value.slice(item.columnStart, item.columnEnd),
			// The columns are already the ones ranges span.
			includeService: true,
			rows: scope.rows.value.slice(item.rowStart, item.rowEnd),
			delimiter: '\t',
			headers: text.headers ?? false,
			escapeFormulas: false,
		});
	}

	/**
	 * The last range as TSV, values through `format` and as they are, for pasting back into a table or a
	 * spreadsheet; `''` without a selection. Only the last range is copied, since a spreadsheet cannot
	 * paste several at once.
	 */
	function getText(text: RangeTextOptions = {}) {
		const last = bounds.value.at(-1);

		return last ? toText(last, text) : '';
	}

	return {
		/** The ranges, as the model holds them. */
		selectedRanges: computed(() => ranges.value),
		/** The columns ranges span, in display order: the shown data columns by default. */
		columns,
		grid,
		/**
		 * Each range in indexes of `grid`; ranges that fell out are skipped. The same array while they
		 * cover the same cells.
		 */
		bounds,
		/**
		 * Each range to draw over the body, in the order of `bounds`: a positioned block per range, laid
		 * out as its rows and its columns are, so a range follows resizing, pinning and measured rows.
		 * A range that changes re-renders only the overlay. Unchanged rectangles are the same objects.
		 */
		rects,
		toRect,
		edgeAt,
		resolveEdge,
		select,
		selectBounds,
		selectAll,
		clear,
		isSelected,
		getSelectedColumns,
		getCells,
		getText,
	};
}

/** Cell ranges as `useCellRanges` gives them. */
export type CellRanges = ReturnType<typeof useCellRanges>;
