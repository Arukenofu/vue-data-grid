import { type ClipboardOptions, type ClipboardTable, useClipboard } from '../clipboard/use-clipboard';
import { type EditingTable, type TableEditingOptions, useTableEditing } from '../editing/use-table-editing';
import { type HistoryTable, type TableHistoryOptions, useTableHistory } from '../editing/use-table-history';
import { type FillTable, type TableFillOptions, useTableFill } from '../ranges/use-table-fill';
import {
	type NavigationTable,
	type RangesTable,
	type RowsTable,
	type SelectionTable,
	type TableColumns,
	type TableGroupingOptions,
	type TableNavigationOptions,
	type TableRangesOptions,
	type TableSelectionOptions,
	type TableSortingOptions,
	type TableTreeOptions,
	useTableGrouping,
	useTableNavigation,
	useTableRanges,
	useTableSelection,
	useTableSorting,
	useTableTree,
} from './features';

/**
 * The `grouping` feature of `useDataTable`: `useTableGrouping` with these options. Pair it with the
 * `tree` feature and a `childrenField`, which flattens the groups.
 */
export function grouping<TRow, TColumns extends TableColumns>(options: TableGroupingOptions<TRow, TColumns>) {
	return (table: RowsTable<TRow, TColumns>) => useTableGrouping(table, options);
}

/** The `sorting` feature of `useDataTable`: `useTableSorting`, rows sorted by the column state on the client. */
export function sorting<TRow>(options: TableSortingOptions = {}) {
	return (table: RowsTable<TRow>) => useTableSorting(table, options);
}

/** The `tree` feature of `useDataTable`: `useTableTree` with these options, such as `parentKey`. */
export function tree<TRow>(options: TableTreeOptions<TRow> = {}) {
	return (table: RowsTable<TRow>) => useTableTree(table, options);
}

/** The `selection` feature of `useDataTable`: `useTableSelection` with these options, such as `selectionMode`. */
export function selection<TRow>(options: TableSelectionOptions<TRow> = {}) {
	return (table: SelectionTable<TRow>) => useTableSelection(table, options);
}

/** The `navigation` feature of `useDataTable`: `useTableNavigation`, the keys of the grid. */
export function navigation(options: TableNavigationOptions = {}) {
	return (table: NavigationTable) => useTableNavigation(table, options);
}

/** The `ranges` feature of `useDataTable`: `useTableRanges`, cell ranges with their gestures. */
export function ranges(options: TableRangesOptions = {}) {
	return (table: RangesTable) => useTableRanges(table, options);
}

/**
 * The `editing` feature of `useDataTable`: `useTableEditing` with these options, `onCommit` among
 * them, which writes a commit into your rows.
 */
export function editing<TRow>(options: TableEditingOptions<TRow>) {
	return (table: EditingTable<TRow>) => useTableEditing(table, options);
}

/** The `history` feature of `useDataTable`: `useTableHistory`, undo and redo of the edits. Needs `editing`. */
export function history<TRow>(options: TableHistoryOptions = {}) {
	return (table: HistoryTable<TRow>) => useTableHistory(table, options);
}

/** The `fill` feature of `useDataTable`: `useTableFill`, the fill handle of the ranges. Needs `ranges` and `editing`. */
export function fill<TRow>(options: TableFillOptions = {}) {
	return (table: FillTable<TRow>) => useTableFill(table, options);
}

/**
 * The `clipboard` feature of `useDataTable`: `useClipboard`, copying the ranges or the focused cell,
 * and with `editing` cutting and pasting too.
 */
export function clipboard(options: ClipboardOptions = {}) {
	return (table: ClipboardTable) => useClipboard(table, options);
}
