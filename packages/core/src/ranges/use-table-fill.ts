import {
	type CellEditSource,
	type CellRanges,
	type CellWrite,
	type CellWriteResult,
	getFillTarget,
	isSameRangeBounds,
	type RangeBounds,
	type RangeRect,
	resolveFill,
} from '@vue-data-grid/engine';
import { computed, type MaybeRefOrGetter, shallowRef, toValue, watch } from 'vue';

import { isShortcutLetter } from '../keyboard/keys';
import type { AutoScrollOptions } from '../scroll/use-auto-scroll';
import { type CellDragEnd, type CellDragTable, useCellDrag } from './use-cell-drag';

/** What a fill needs of a table; the table of `useDataTable` fits, with its `ranges` and `editing`. */
export interface FillTable<TRow = unknown> extends CellDragTable {
	/** The ranges: a fill goes from the last one, and selects what it filled. */
	ranges: Pick<CellRanges, 'bounds' | 'grid' | 'toRect' | 'selectBounds'>;
	/** What writes the values, such as the `editing` feature or `useCellEditing`. */
	editing: { write: (writes: readonly CellWrite[], source: CellEditSource) => CellWriteResult<TRow> };
}

export interface TableFillOptions {
	/**
	 * Continue numbers as a series, `1, 2` going on `3, 4`, rather than repeat them; `true` by default.
	 * Holding Ctrl or ⌘ while dragging does the other.
	 */
	series?: MaybeRefOrGetter<boolean>;
	/** Scrolling while the handle is near the edges: `useAutoScroll` options, or `false`. */
	autoScroll?: Omit<AutoScrollOptions, 'onScroll'> | false;
	/** `true` by default. */
	enabled?: MaybeRefOrGetter<boolean>;
}

/** How a fill goes. */
export interface FillRequest {
	/** Continue numbers as a series; the `series` option by default. */
	series?: boolean;
}

/**
 * The fill handle of cell ranges, as a spreadsheet's: dragging the handle at the corner of the last
 * range stretches it down, up or across, and releasing fills the new cells from the range, numbers
 * as a series and everything else repeated, as one commit with the source `'fill'`; the filled range
 * is selected. Ctrl+D or ⌘+D fills the range down from its first row, Ctrl+R or ⌘+R right from its
 * first column, with copies, so a fill needs no pointer.
 *
 * `TableFillHandle` is the handle, and `TableFillPreview` draws the range being filled. Values go
 * through `write` of the editing, so only cells that can be edited change, each checked by its
 * column's `validate`. Rows that come or go during a drag cancel it: the cells it points at are gone.
 */
export function useTableFill<TRow = unknown>(table: FillTable<TRow>, options: TableFillOptions = {}) {
	const { ranges, editing, scope } = table;

	if (!ranges || !editing) {
		throw new Error('[@vue-data-grid/core] useTableFill() needs the `ranges` and the `editing` of the table: add both features before `fill`.');
	}

	const target = shallowRef<RangeBounds | null>(null);
	let source: RangeBounds | null = null;
	let inverted = false;

	function isEnabled() {
		return toValue(options.enabled) ?? true;
	}

	function isSeries() {
		return toValue(options.series) ?? true;
	}

	function getValue(cell: { index: number; column: string }) {
		return scope.getColumn(cell.column)?.column?.value(scope.rows.value[cell.index]);
	}

	/**
	 * Fills the cells of `to` outside `from`, both bounds of the ranges' grid, from the values of
	 * `from`, and selects `to`; the result of the write, or `null` when `to` adds no cell.
	 */
	function fill(from: RangeBounds, to: RangeBounds, request: FillRequest = {}): CellWriteResult<TRow> | null {
		if (isSameRangeBounds(from, to)) {
			return null;
		}

		const writes = resolveFill(from, to, ranges.grid.value, getValue, { series: request.series ?? isSeries() });

		ranges.selectBounds(to);

		return editing.write(writes, 'fill');
	}

	function finishDrag({ cancelled }: CellDragEnd) {
		const from = source;
		const to = target.value;
		const series = isSeries();

		source = null;
		target.value = null;

		if (!cancelled && from && to) {
			fill(from, to, { series: inverted ? !series : series });
		}
	}

	const drag = useCellDrag(table, {
		getColumns: () => ranges.grid.value.columns,
		autoScroll: options.autoScroll,
		onCell: (cell) => {
			if (source) {
				target.value = getFillTarget(source, cell.index, ranges.grid.value.columns.indexOf(cell.column));
			}
		},
		onEnd: finishDrag,
	});

	// Ctrl or ⌘ held during a drag switches between a series and copies, as in a spreadsheet.
	function handleModifier(event: KeyboardEvent) {
		if (event.key === 'Control' || event.key === 'Meta') {
			inverted = event.type === 'keydown';
		}
	}

	watch(drag.dragging, (dragging, _previous, onCleanup) => {
		if (dragging) {
			window.addEventListener('keydown', handleModifier);
			window.addEventListener('keyup', handleModifier);
			onCleanup(() => {
				window.removeEventListener('keydown', handleModifier);
				window.removeEventListener('keyup', handleModifier);
			});
		}
	});

	watch(scope.rowKeys, () => {
		if (drag.dragging.value) {
			drag.cancel();
		}
	}, { flush: 'sync' });

	/** Starts dragging the fill handle from a press on it. */
	function start(event: PointerEvent) {
		const last = ranges.bounds.value.at(-1);

		if (!isEnabled() || !last || event.button !== 0) {
			return;
		}

		// The press is the handle's: no text selection, no range gesture under it.
		event.preventDefault();
		event.stopPropagation();
		drag.start(event);
		source = last;
		inverted = event.ctrlKey || event.metaKey;
		target.value = last;
	}

	/** Fills the last range down from its first row, or right from its first column, with copies. */
	function fillFrom(direction: 'down' | 'right') {
		const last = ranges.bounds.value.at(-1);

		if (!last) {
			return null;
		}

		const from = direction === 'down'
			? { ...last, rowEnd: last.rowStart + 1 }
			: { ...last, columnEnd: last.columnStart + 1 };

		return fill(from, last, { series: false });
	}

	function handleKeydown(event: KeyboardEvent) {
		const cell = event.target instanceof HTMLElement && event.target.hasAttribute('data-dg-column');

		if (!cell || !isEnabled() || event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
			return;
		}

		if (isShortcutLetter(event, 'd')) {
			event.preventDefault();
			fillFrom('down');
		} else if (isShortcutLetter(event, 'r')) {
			event.preventDefault();
			fillFrom('right');
		}
	}

	watch(() => table.root.value, (root, _previous, onCleanup) => {
		if (root) {
			root.addEventListener('keydown', handleKeydown, { capture: true });
			onCleanup(() => root.removeEventListener('keydown', handleKeydown, { capture: true }));
		}
	}, { immediate: true, flush: 'sync' });

	return {
		/** The range being filled while the handle is dragged past the last range, to draw; `null` otherwise. */
		preview: computed<RangeRect | null>(() => {
			const current = target.value;

			return current && source && !isSameRangeBounds(current, source) ? ranges.toRect(current) : null;
		}),
		/** Whether the fill handle is being dragged. */
		dragging: drag.dragging,
		start,
		fill,
		/** Fills the last range down from its first row, as Ctrl+D does. */
		fillDown: () => fillFrom('down'),
		/** Fills the last range right from its first column, as Ctrl+R does. */
		fillRight: () => fillFrom('right'),
	};
}

/** The fill handle as `useTableFill` gives it. */
export type TableFill<TRow = unknown> = ReturnType<typeof useTableFill<TRow>>;
