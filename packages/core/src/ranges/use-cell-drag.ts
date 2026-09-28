import type { CellPosition, GridScope } from '@vue-data-grid/engine';
import { onScopeDispose, type Ref, shallowReadonly, shallowRef } from 'vue';

import { isRtl } from '../keyboard/keys';
import { BODY_SECTION, findGridRow } from '../navigation/grid-attributes';
import { type AutoScrollOptions, type AutoScrollPoint, useAutoScroll } from '../scroll/use-auto-scroll';

/** What a drag across cells needs of a grid; the grid of `useDataGrid` fits. */
export interface CellDragGrid {
	scope: GridScope;
	/** The scroll container. */
	root: Readonly<Ref<HTMLElement | null>>;
	/** The body block, with the rows in the `body` section of `useGridProps`. */
	body: Readonly<Ref<HTMLElement | null>>;
	/** The heights of the sticky header and footer: a pointer over them reaches the rows at the edge. */
	headHeight?: Readonly<Ref<number>>;
	footHeight?: Readonly<Ref<number>>;
}

/** How a drag across cells ended. */
export interface CellDragEnd {
	/** The gesture was cancelled, by the browser or by `cancel`, rather than the pointer going up. */
	cancelled: boolean;
}

export interface CellDragOptions {
	/** The columns a drag reaches, in display order. Read when a drag starts. */
	getColumns: () => readonly string[];
	/** Scrolling near the edges: `useAutoScroll` options over the sticky parts, or `false`. */
	autoScroll?: Omit<AutoScrollOptions, 'onScroll'> | false;
	/** The pointer reached another cell, or the rows moved under it. */
	onCell: (cell: CellPosition) => void;
	/** The drag ended. */
	onEnd?: (end: CellDragEnd) => void;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), Math.max(min, max));
}

function getCellId(cell: CellPosition) {
	return `${cell.index}\u0000${cell.column}`;
}

/**
 * A pointer drag across the body cells of a grid, such as selecting a range or pulling a fill: the
 * pointer is followed on the window, so the drag goes on past the grid's edges; near an edge the
 * grid scrolls, over its sticky header, footer and pinned columns; and each cell the pointer reaches
 * is reported once. The row under a point is found by the heights of the rows, and its cell by the
 * element there, else by the nearest cell of that row: a point past an edge, or over a column the drag
 * does not reach, gives the nearest cell.
 */
export function useCellDrag(grid: CellDragGrid, options: CellDragOptions) {
	const { scope } = grid;
	const dragging = shallowRef(false);
	let columns: ReadonlySet<string> = new Set();
	let last: string | null = null;

	/** The pinned widths at each physical side, for the margins of the auto-scroll. */
	function getPinnedWidths() {
		let start = scope.offsets.value[0] ?? 0;
		let end = 0;

		for (const item of scope.columns.value) {
			const width = scope.getWidth(item.key);

			if (item.pin === 'start') {
				start += width;
			} else if (item.pin === 'end') {
				end += width;
			}
		}

		return isRtl(grid.root.value) ? { left: end, right: start } : { left: start, right: end };
	}

	/** The row index at a height in the body: past the rows, the first or the last one. */
	function findRow(offset: number) {
		let low = 0;
		let high = scope.rows.value.length - 1;

		while (low < high) {
			const middle = (low + high + 1) >>> 1;

			if (scope.getRowOffset(middle) <= offset) {
				low = middle;
			} else {
				high = middle - 1;
			}
		}

		return low;
	}

	/** The column of the cell right under a point in the row, when it is one a drag reaches. */
	function findColumnAt(row: HTMLElement, x: number, y: number) {
		const hit = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null;
		const cell = hit?.closest('[data-dg-column]');
		const column = cell && row.contains(cell) ? cell.getAttribute('data-dg-column') : null;

		return column !== null && columns.has(column) ? column : null;
	}

	/** The column of the cell of the row nearest to `x`, among the ones a drag reaches. */
	function findNearestColumn(row: HTMLElement, x: number) {
		let nearest: { column: string; distance: number } | null = null;

		for (const cell of row.querySelectorAll<HTMLElement>('[data-dg-column]')) {
			const column = cell.getAttribute('data-dg-column');

			if (column === null || !columns.has(column)) {
				continue;
			}

			const rect = cell.getBoundingClientRect();
			const distance = x < rect.left ? rect.left - x : Math.max(x - rect.right, 0);

			if (!nearest || distance < nearest.distance) {
				nearest = { column, distance };
			}
		}

		return nearest?.column ?? null;
	}

	/** The cell nearest to a point in the viewport; `null` without rows or a rendered row there. */
	function findCellAt(point: AutoScrollPoint): CellPosition | null {
		const root = grid.root.value;
		const body = grid.body.value;

		if (!root || !body || scope.rows.value.length === 0) {
			return null;
		}

		const view = root.getBoundingClientRect();
		const top = view.top + root.clientTop + (grid.headHeight?.value ?? 0);
		const bottom = view.top + root.clientTop + root.clientHeight - (grid.footHeight?.value ?? 0);
		const y = clamp(point.y, top, bottom - 1);
		const index = findRow(y - body.getBoundingClientRect().top);
		const row = findGridRow(body, BODY_SECTION, index);
		const column = row ? findColumnAt(row, point.x, y) ?? findNearestColumn(row, point.x) : null;

		return column === null ? null : { index, column };
	}

	function follow(point: AutoScrollPoint) {
		const cell = findCellAt(point);
		const id = cell && getCellId(cell);

		if (cell && id !== last) {
			last = id;
			options.onCell(cell);
		}
	}

	const autoScroll = useAutoScroll(() => grid.root.value, {
		margin: () => ({ top: grid.headHeight?.value ?? 0, bottom: grid.footHeight?.value ?? 0, ...getPinnedWidths() }),
		...(options.autoScroll === false ? undefined : options.autoScroll),
		onScroll: follow,
	});

	function handleMove(event: PointerEvent) {
		const point = { x: event.clientX, y: event.clientY };

		if (options.autoScroll !== false) {
			autoScroll.move(point);
		}

		follow(point);
	}

	function end(cancelled: boolean) {
		if (!dragging.value) {
			return;
		}

		dragging.value = false;
		autoScroll.stop();
		window.removeEventListener('pointermove', handleMove);
		window.removeEventListener('pointerup', handleUp);
		window.removeEventListener('pointercancel', handleCancel);
		options.onEnd?.({ cancelled });
	}

	function handleUp() {
		end(false);
	}

	function handleCancel() {
		end(true);
	}

	/** Starts following the pointer from a press; `from` is the cell the press was on, reported as reached. */
	function start(event: PointerEvent, from: CellPosition | null = null) {
		end(true);
		dragging.value = true;
		columns = new Set(options.getColumns());
		last = from && getCellId(from);

		if (options.autoScroll !== false) {
			autoScroll.start({ x: event.clientX, y: event.clientY });
		}

		window.addEventListener('pointermove', handleMove, { passive: true });
		window.addEventListener('pointerup', handleUp);
		window.addEventListener('pointercancel', handleCancel);
	}

	onScopeDispose(() => end(true));

	return {
		start,
		/** Ends a drag at once, as cancelled. */
		cancel: () => end(true),
		/** Whether a drag is in progress. */
		dragging: shallowReadonly(dragging),
	};
}

/** A drag across cells as `useCellDrag` gives it. */
export type CellDrag = ReturnType<typeof useCellDrag>;
