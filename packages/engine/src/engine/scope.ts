import type { ComputedRef, InjectionKey, Ref } from 'vue';

import type { RenderedGroup } from '../column-groups/column-groups';
import type { AnyColumn, ColumnPinSide, RenderedColumn } from '../columns/column';
import type { SortDirection, TableSort } from '../columns/sort';
import type { ColumnSpanCell } from '../render/column-span';
import type { PageDirection } from '../virtual/item-metrics';
import type { ScrollAlign } from '../virtual/scroll';

export interface RowRange {
	/** Half-open range `[start, end)` in `rows`: the first rendered row and one past the last. */
	start: number;
	end: number;
}

/** What the markup needs rendered whatever the windows say: a row under focus, a column under a drag. */
export interface KeepRendered {
	/** Row indexes in `rows`. */
	rows?: () => readonly number[];
	/** Column names. */
	columns?: () => readonly string[];
}

/**
 * Everything the markup renders the table from; `TRow` is the row type of the engine. Methods that
 * change the table by a column name warn once in development about a name that is not a declared
 * column; queries answer for it quietly.
 */
export interface TableScope<TRow = unknown> {
	/** The scroll container of the table, for both axes. */
	root: Ref<HTMLElement | null>;

	rows: ComputedRef<readonly TRow[]>;
	/**
	 * The key of every row, at the same index; computed when first read and shared by all readers. The
	 * same array while the keys hold, so new data under the same rows wakes none of its readers.
	 */
	rowKeys: ComputedRef<readonly string[]>;
	// A method, not a property: its parameter stays bivariant, so `TableScope<TRow>` fits `TableScope`.
	getRowKey(row: TRow): string;
	/** The index of the row with this key in `rows`; `-1` without one. */
	getRowIndex: (key: string) => number;
	/** The rendered rows; the whole list without a row window. */
	rowRange: ComputedRef<RowRange>;
	/**
	 * The rows in view between the sticky top and bottom, at least partly: without overscan and kept
	 * rows. `{ start: 0, end: 0 }` before the scroll container is mounted, and while the sticky blocks
	 * cover the whole viewport.
	 */
	visibleRange: ComputedRef<RowRange>;
	/**
	 * How many rows PageUp (`'up'`) or PageDown (`'down'`) moves from the row at `index`: as many as fit
	 * between the sticky top and bottom, by their heights. At least one.
	 */
	getPageStep: (index: number, direction: PageDirection) => number;
	/**
	 * Offset of the row's top edge from the top of the first row, px, by row heights and measured ones:
	 * where a positioned row stands in the body. `getRowOffset(rows.length)` is the height of all rows.
	 */
	getRowOffset: (index: number) => number;

	/** Shown columns in display order. */
	columns: ComputedRef<readonly RenderedColumn[]>;
	/** Shown columns after the column window: without the ones outside it, with spacers in their place. */
	renderedColumns: ComputedRef<readonly RenderedColumn[]>;
	/** Every declared column in display order, hidden ones included: what a settings panel lists. */
	orderedColumns: ComputedRef<readonly AnyColumn[]>;
	/** Group rows above `renderedColumns`, from the top; empty without groups. */
	headerGroups: ComputedRef<readonly (readonly RenderedGroup[])[]>;
	/**
	 * Prefix sums of shown column widths: the first item is `insets.start`, the last adds every column.
	 * `insets.end` is not included.
	 */
	offsets: ComputedRef<readonly number[]>;
	/** The sort, without columns that are not declared. */
	sort: ComputedRef<readonly TableSort[]>;

	getColumn: (name: string) => RenderedColumn | undefined;
	getPin: (name: string) => ColumnPinSide | undefined;
	isColumnHidden: (name: string) => boolean;
	getWidth: (name: string) => number;
	/**
	 * A row across the table that spans shown columns `[start, end)` of `columns`: the span split by pin
	 * side, between cells holding the place of the other columns and of the insets. Each cell is styled
	 * as a group cell of its columns, so it lays out, sticks and resizes with the cells under it without
	 * a render; overlays over the body, such as cell ranges, are drawn on it. The same array while its
	 * geometry holds; empty for an empty span and without `cellStyles.group`.
	 */
	getColumnSpan: (start: number, end: number) => readonly ColumnSpanCell[];

	toggleColumn: (name: string) => void;
	pinColumn: (name: string, side: ColumnPinSide | null) => void;
	moveColumnTo: (name: string, index: number) => void;
	moveColumnBefore: (name: string, before: string | null) => void;
	canMoveColumnTo: (name: string, index: number) => boolean;
	/**
	 * Moves a column by `delta` places among the shown ones, as a key press does: only allowed places
	 * count, so the column steps over a `keepTogether` group rather than stopping at it. Goes as far
	 * as it can when fewer places are allowed; `false` when it did not move.
	 */
	moveColumnBy: (name: string, delta: number) => boolean;
	/** Whether `moveColumnBy` would move the column at all. */
	canMoveColumnBy: (name: string, delta: number) => boolean;
	/** Applies several layout changes in one write, so everything downstream recomputes once. */
	batch: (run: () => void) => void;

	getSortDirection: (name: string) => SortDirection | undefined;
	getSortIndex: (name: string) => number | undefined;
	/** Whether `additive` in `toggleSort` has any effect. */
	multiSort: ComputedRef<boolean>;
	/**
	 * Steps the column through its `sortOrder` (`desc`, `asc` by default), then clears it. The gesture
	 * of a header: a column that is not `sortable` is left alone. Sort from code through the state's
	 * `sort`.
	 */
	toggleSort: (name: string, additive: boolean) => void;

	/** Whether a column group is collapsed; always `false` for a group without `showWhen`. */
	isGroupCollapsed: (name: string) => boolean;
	toggleGroup: (name: string) => void;

	/**
	 * The width of a column during a resize gesture. Widths are applied once per animation frame: a
	 * pointer fires several moves per frame, and all but the last would cost work that never reaches
	 * the screen. Returns the width the column gets, within `minWidth` and `maxWidth`, so a gesture can
	 * go on from it; the current width for a column that is not `resizable`.
	 */
	resize: (name: string, width: number) => number;
	/** Ends the gesture: applies a width still waiting for its frame and writes it to the layout. */
	commitResize: () => void;
	/**
	 * Shows `resizable` columns at these widths without writing them to the layout, such as the frames
	 * of a transition between two layouts; `null` takes them off. Like a resize, it reaches the DOM
	 * through geometry layers, not through a render. A resize in progress draws over it.
	 */
	previewWidths: (widths: Readonly<Record<string, number>> | null) => void;
	/**
	 * Sets the widths of `resizable` columns in one layout write, within `minWidth` and `maxWidth`, such
	 * as widths measured from content. Other names are skipped; `false` when nothing was set.
	 */
	setWidths: (widths: Readonly<Record<string, number>>) => boolean;
	/**
	 * Stretches or shrinks columns to the viewport width in proportion to their widths, within
	 * `minWidth` and `maxWidth`; without `names`, every shown `resizable` column.
	 */
	fitColumns: (names?: readonly string[]) => boolean;

	/**
	 * Scrolls to a row, which may not be in the DOM under the row window, keeping the sticky top and
	 * bottom (`scrollMargin`, `scrollMarginEnd`) clear. `align` is `'start'` by default.
	 */
	scrollToRow: (index: number, align?: ScrollAlign) => void;
	/**
	 * Scrolls to a column so that pinned columns do not cover it; `'auto'`, the default, scrolls just
	 * enough to show it. Does nothing for a pinned column, which is always visible.
	 */
	scrollToColumn: (name: string, align?: ScrollAlign) => void;

	/**
	 * Keeps rows and columns rendered while the source returns them, until the returned function is
	 * called or the calling component unmounts.
	 */
	keepRendered: (source: KeepRendered) => () => void;
}

export const TABLE_SCOPE: InjectionKey<TableScope> = Symbol('@vue-data-grid/engine');
