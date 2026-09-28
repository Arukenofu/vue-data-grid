import { type ClipboardGrid, type ClipboardOptions, useClipboard } from '../clipboard/use-clipboard';
import { type EditingGrid, type GridEditingOptions, useGridEditing } from '../editing/use-grid-editing';
import { type GridHistoryOptions, type HistoryGrid, useGridHistory } from '../editing/use-grid-history';
import { type FillGrid, type GridFillOptions, useGridFill } from '../ranges/use-grid-fill';
import {
	type GridColumns,
	type GridGroupingOptions,
	type GridNavigationOptions,
	type GridRangesOptions,
	type GridSelectionOptions,
	type GridSortingOptions,
	type GridTreeOptions,
	type NavigationGrid,
	type RangesGrid,
	type RowsGrid,
	type SelectionGrid,
	useGridGrouping,
	useGridNavigation,
	useGridRanges,
	useGridSelection,
	useGridSorting,
	useGridTree,
} from './features';

/**
 * The `grouping` feature of `useDataGrid`: `useGridGrouping` with these options. Pair it with the
 * `tree` feature and a `childrenField`, which flattens the groups.
 */
export function grouping<TRow, TColumns extends GridColumns>(options: GridGroupingOptions<TRow, TColumns>) {
	return (grid: RowsGrid<TRow, TColumns>) => useGridGrouping(grid, options);
}

/** The `sorting` feature of `useDataGrid`: `useGridSorting`, rows sorted by the column state on the client. */
export function sorting<TRow>(options: GridSortingOptions = {}) {
	return (grid: RowsGrid<TRow>) => useGridSorting(grid, options);
}

/** The `tree` feature of `useDataGrid`: `useGridTree` with these options, such as `parentKey`. */
export function tree<TRow>(options: GridTreeOptions<TRow> = {}) {
	return (grid: RowsGrid<TRow>) => useGridTree(grid, options);
}

/** The `selection` feature of `useDataGrid`: `useGridSelection` with these options, such as `selectionMode`. */
export function selection<TRow>(options: GridSelectionOptions<TRow> = {}) {
	return (grid: SelectionGrid<TRow>) => useGridSelection(grid, options);
}

/** The `navigation` feature of `useDataGrid`: `useGridNavigation`, the keys of the grid. */
export function navigation(options: GridNavigationOptions = {}) {
	return (grid: NavigationGrid) => useGridNavigation(grid, options);
}

/** The `ranges` feature of `useDataGrid`: `useGridRanges`, cell ranges with their gestures. */
export function ranges(options: GridRangesOptions = {}) {
	return (grid: RangesGrid) => useGridRanges(grid, options);
}

/**
 * The `editing` feature of `useDataGrid`: `useGridEditing` with these options, `onCommit` among
 * them, which writes a commit into your rows.
 */
export function editing<TRow>(options: GridEditingOptions<TRow>) {
	return (grid: EditingGrid<TRow>) => useGridEditing(grid, options);
}

/** The `history` feature of `useDataGrid`: `useGridHistory`, undo and redo of the edits. Needs `editing`. */
export function history<TRow>(options: GridHistoryOptions = {}) {
	return (grid: HistoryGrid<TRow>) => useGridHistory(grid, options);
}

/** The `fill` feature of `useDataGrid`: `useGridFill`, the fill handle of the ranges. Needs `ranges` and `editing`. */
export function fill<TRow>(options: GridFillOptions = {}) {
	return (grid: FillGrid<TRow>) => useGridFill(grid, options);
}

/**
 * The `clipboard` feature of `useDataGrid`: `useClipboard`, copying the ranges or the focused cell,
 * and with `editing` cutting and pasting too.
 */
export function clipboard(options: ClipboardOptions = {}) {
	return (grid: ClipboardGrid) => useClipboard(grid, options);
}
