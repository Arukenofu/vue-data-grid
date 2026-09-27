import {
	createTableScopeContext,
	type RenderedColumn,
	type RenderedGroup,
	type RowNode,
	type VirtualItem,
} from '@vue-stack/table-core';
import { inject, type InjectionKey, provide } from 'vue';

import type { DataTable } from '../data-table/use-data-table';

/** A body row as the parts of the body take it: one object per row while its item, data and node hold. */
export interface TableBodyRow<TRow = unknown> {
	key: string;
	/** Position in `rows`. */
	index: number;
	/** The row's place in the row window. */
	item: VirtualItem;
	/** The row itself, from `rows`. */
	original: TRow;
	/** The row's node in a tree; `undefined` in a flat table. */
	node: RowNode | undefined;
}

const DATA_TABLE: InjectionKey<DataTable> = Symbol('@vue-stack/table');

const BODY_ROW: InjectionKey<() => TableBodyRow> = Symbol('@vue-stack/table row');

const HEADER_CELL: InjectionKey<() => RenderedColumn> = Symbol('@vue-stack/table header cell');

const GROUP_CELL: InjectionKey<() => RenderedGroup> = Symbol('@vue-stack/table group cell');

const FOOTER_CELL: InjectionKey<() => RenderedColumn> = Symbol('@vue-stack/table footer cell');

// With a fallback given, even `null`, a missing context gives the fallback; without one it throws.
function injectContext<TValue>(key: InjectionKey<TValue>, fallback: unknown[], name: string, parent: string) {
	const value = inject(key, null);

	if (value !== null) {
		return value;
	}

	if (fallback.length > 0) {
		return fallback[0];
	}

	throw new Error(`${name}() must be called inside <${parent}>`);
}

/**
 * Provides the table to the parts below, and its scope to `useTableScopeContext()`. `TableRoot` calls it;
 * call it yourself for parts under markup of your own.
 */
export function createDataTableContext<TRow>(table: DataTable<TRow>) {
	provide(DATA_TABLE, table as DataTable);
	createTableScopeContext(table.scope);

	return table;
}

/**
 * The table of the `TableRoot` around. `TRow` is not checked against the provided table, just as with
 * `inject`. Throws outside a table, unless given a `fallback`.
 */
export function useDataTableContext<TRow = unknown>(): DataTable<TRow>;
export function useDataTableContext<TRow = unknown, TFallback = null>(fallback: TFallback): DataTable<TRow> | TFallback;
export function useDataTableContext(...fallback: unknown[]) {
	return injectContext(DATA_TABLE, fallback, 'useDataTableContext', 'TableRoot');
}

/** Gives the parts inside a body row their row, as a getter that follows the row's props. `TableRow` calls it. */
export function createBodyRowContext<TRow>(row: () => TableBodyRow<TRow>) {
	provide(BODY_ROW, row as () => TableBodyRow);

	return row;
}

/**
 * The body row a part is in, as a getter: its data, key, index and node. Throws outside a row, unless
 * given a `fallback`, such as `null` for a part that can also take its row from a prop.
 */
export function useBodyRowContext<TRow = unknown>(): () => TableBodyRow<TRow>;
export function useBodyRowContext<TRow = unknown, TFallback = null>(fallback: TFallback): (() => TableBodyRow<TRow>) | TFallback;
export function useBodyRowContext(...fallback: unknown[]) {
	return injectContext(BODY_ROW, fallback, 'useBodyRowContext', 'TableRow');
}

/** Gives the parts inside a column header cell their column. `TableHeaderCell` calls it. */
export function createHeaderCellContext(column: () => RenderedColumn) {
	provide(HEADER_CELL, column);

	return column;
}

/** The column of the header cell a part is in, such as a sort indicator or a resize handle. */
export function useHeaderCellContext(): () => RenderedColumn;
export function useHeaderCellContext<TFallback>(fallback: TFallback): (() => RenderedColumn) | TFallback;
export function useHeaderCellContext(...fallback: unknown[]) {
	return injectContext(HEADER_CELL, fallback, 'useHeaderCellContext', 'TableHeaderCell');
}

/** Gives the parts inside a group cell their cell. `TableGroupCell` calls it. */
export function createGroupCellContext(cell: () => RenderedGroup) {
	provide(GROUP_CELL, cell);

	return cell;
}

/** The group cell a part is in, such as its collapse toggle. */
export function useGroupCellContext(): () => RenderedGroup;
export function useGroupCellContext<TFallback>(fallback: TFallback): (() => RenderedGroup) | TFallback;
export function useGroupCellContext(...fallback: unknown[]) {
	return injectContext(GROUP_CELL, fallback, 'useGroupCellContext', 'TableGroupCell');
}

/** Gives the parts inside a footer cell their column. `TableFooterCell` calls it. */
export function createFooterCellContext(column: () => RenderedColumn) {
	provide(FOOTER_CELL, column);

	return column;
}

/** The column of the footer cell a part is in, such as `TableFooterContent`. */
export function useFooterCellContext(): () => RenderedColumn;
export function useFooterCellContext<TFallback>(fallback: TFallback): (() => RenderedColumn) | TFallback;
export function useFooterCellContext(...fallback: unknown[]) {
	return injectContext(FOOTER_CELL, fallback, 'useFooterCellContext', 'TableFooterCell');
}

/**
 * What the parts register their elements with while dragging is on: a drag list of rows or of
 * column headers, such as `useTableRowDrag` of `@vue-stack/table/drag-and-drop` gives.
 */
export interface TableDragItems {
	/** Connects the element of item `key`, a row key or a column name; returns the disconnect. */
	register: (element: HTMLElement, key: string) => () => void;
	/**
	 * The attributes of the element of item `key`, for its render: `data-tc-draggable` while it may be
	 * dragged. Give the row of a row, as `TableRow` does, so that the render follows that row alone.
	 * The same frozen object for the same answer.
	 */
	getItemProps: (key: string, row?: unknown) => Readonly<Record<string, string>>;
}

const ROW_DRAG: InjectionKey<TableDragItems> = Symbol('@vue-stack/table row drag');

const COLUMN_DRAG: InjectionKey<TableDragItems> = Symbol('@vue-stack/table column drag');

/** Gives the rows below a drag list: each `TableRow` registers its element with it. */
export function createRowDragContext<TItems extends TableDragItems>(items: TItems) {
	provide(ROW_DRAG, items);

	return items;
}

/**
 * The row drag list of the parts around, such as a `TableRowDrag`. `TItems` is not checked against
 * the provided list, just as with `inject`. Throws without one, unless given a `fallback`.
 */
export function useRowDragContext<TItems extends TableDragItems = TableDragItems>(): TItems;
export function useRowDragContext<TItems extends TableDragItems = TableDragItems, TFallback = null>(fallback: TFallback): TItems | TFallback;
export function useRowDragContext(...fallback: unknown[]) {
	return injectContext(ROW_DRAG, fallback, 'useRowDragContext', 'TableRowDrag');
}

/** Gives the column header cells below a drag list: each `TableHeaderCell` registers its element with it. */
export function createColumnDragContext<TItems extends TableDragItems>(items: TItems) {
	provide(COLUMN_DRAG, items);

	return items;
}

/** The column drag list of the parts around, such as a `TableColumnDrag`. */
export function useColumnDragContext<TItems extends TableDragItems = TableDragItems>(): TItems;
export function useColumnDragContext<TItems extends TableDragItems = TableDragItems, TFallback = null>(fallback: TFallback): TItems | TFallback;
export function useColumnDragContext(...fallback: unknown[]) {
	return injectContext(COLUMN_DRAG, fallback, 'useColumnDragContext', 'TableColumnDrag');
}
