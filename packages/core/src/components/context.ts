import {
	createGridScopeContext,
	type RenderedColumn,
	type RenderedGroup,
	type RowNode,
	type VirtualItem,
} from '@vue-data-grid/engine';
import { inject, type InjectionKey, onMounted, provide } from 'vue';

import type { DataGrid } from '../data-grid/use-data-grid';
import { createGridTemplates, type GridTemplates } from './template-registry';

/** A body row as the parts of the body take it: one object per row while its item, data and node hold. */
export interface GridBodyRow<TRow = unknown> {
	key: string;
	/** Position in `rows`. */
	index: number;
	/** The row's place in the row window. */
	item: VirtualItem;
	/** The row itself, from `rows`. */
	original: TRow;
	/** The row's node in a tree; `undefined` in a flat grid. */
	node: RowNode | undefined;
}

const DATA_GRID: InjectionKey<DataGrid> = Symbol('@vue-data-grid/core');

// `null` below a grid without templates, so its parts do not reach those of a grid around it.
const TEMPLATES: InjectionKey<GridTemplates | null> = Symbol('@vue-data-grid/core templates');

const BODY_ROW: InjectionKey<() => GridBodyRow> = Symbol('@vue-data-grid/core row');

const HEADER_CELL: InjectionKey<() => RenderedColumn> = Symbol('@vue-data-grid/core header cell');

const GROUP_CELL: InjectionKey<() => RenderedGroup> = Symbol('@vue-data-grid/core group cell');

const FOOTER_CELL: InjectionKey<() => RenderedColumn> = Symbol('@vue-data-grid/core footer cell');

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
 * Provides the grid to the parts below, and its scope to `useGridScopeContext()`. `GridRoot` calls it;
 * call it yourself for parts under markup of your own, then `createGridTemplatesContext` for the
 * column templates.
 */
export function createDataGridContext<TRow>(grid: DataGrid<TRow>) {
	provide(DATA_GRID, grid as DataGrid);
	provide(TEMPLATES, null);
	createGridScopeContext(grid.scope);

	return grid;
}

/**
 * Provides an empty registry of column templates to the parts below and returns it: `GridCellTemplate`
 * and the other template parts register there. `GridRoot` calls it; call it yourself in `setup` of a
 * root of your own, after `createDataGridContext`, for a grid that takes template parts. It uses the
 * lifecycle of the component it is called in.
 */
export function createGridTemplatesContext() {
	let mounted = false;

	// A server render never mounts: there a template after its cells stays out of order.
	onMounted(() => {
		mounted = true;
	});

	const templates = createGridTemplates(() => mounted);

	provide(TEMPLATES, templates);

	return templates;
}

/**
 * The column templates of the grid around, which `GridCellTemplate` and the other template parts
 * register: for a part of your own that renders cells, headers, footers or editors as the grid's parts
 * do, with `renderCellContent` and the other content utilities. Throws outside a grid with templates,
 * unless given a `fallback`, such as `null` in a part that renders without templates too.
 */
export function useGridTemplatesContext(): GridTemplates;
export function useGridTemplatesContext<TFallback>(fallback: TFallback): GridTemplates | TFallback;
export function useGridTemplatesContext(...fallback: unknown[]) {
	return injectContext(TEMPLATES, fallback, 'useGridTemplatesContext', 'GridRoot');
}

/**
 * The grid of the `GridRoot` around. `TRow` is not checked against the provided grid, just as with
 * `inject`. Throws outside a grid, unless given a `fallback`.
 */
export function useDataGridContext<TRow = unknown>(): DataGrid<TRow>;
export function useDataGridContext<TRow = unknown, TFallback = null>(fallback: TFallback): DataGrid<TRow> | TFallback;
export function useDataGridContext(...fallback: unknown[]) {
	return injectContext(DATA_GRID, fallback, 'useDataGridContext', 'GridRoot');
}

/** Gives the parts inside a body row their row, as a getter that follows the row's props. `GridRow` calls it. */
export function createBodyRowContext<TRow>(row: () => GridBodyRow<TRow>) {
	provide(BODY_ROW, row as () => GridBodyRow);

	return row;
}

/**
 * The body row a part is in, as a getter: its data, key, index and node. Throws outside a row, unless
 * given a `fallback`, such as `null` for a part that can also take its row from a prop.
 */
export function useBodyRowContext<TRow = unknown>(): () => GridBodyRow<TRow>;
export function useBodyRowContext<TRow = unknown, TFallback = null>(fallback: TFallback): (() => GridBodyRow<TRow>) | TFallback;
export function useBodyRowContext(...fallback: unknown[]) {
	return injectContext(BODY_ROW, fallback, 'useBodyRowContext', 'GridRow');
}

/** Gives the parts inside a column header cell their column. `GridHeaderCell` calls it. */
export function createHeaderCellContext(column: () => RenderedColumn) {
	provide(HEADER_CELL, column);

	return column;
}

/** The column of the header cell a part is in, such as a sort indicator or a resize handle. */
export function useHeaderCellContext(): () => RenderedColumn;
export function useHeaderCellContext<TFallback>(fallback: TFallback): (() => RenderedColumn) | TFallback;
export function useHeaderCellContext(...fallback: unknown[]) {
	return injectContext(HEADER_CELL, fallback, 'useHeaderCellContext', 'GridHeaderCell');
}

/** Gives the parts inside a group cell their cell. `GridGroupCell` calls it. */
export function createGroupCellContext(cell: () => RenderedGroup) {
	provide(GROUP_CELL, cell);

	return cell;
}

/** The group cell a part is in, such as its collapse toggle. */
export function useGroupCellContext(): () => RenderedGroup;
export function useGroupCellContext<TFallback>(fallback: TFallback): (() => RenderedGroup) | TFallback;
export function useGroupCellContext(...fallback: unknown[]) {
	return injectContext(GROUP_CELL, fallback, 'useGroupCellContext', 'GridGroupCell');
}

/** Gives the parts inside a footer cell their column. `GridFooterCell` calls it. */
export function createFooterCellContext(column: () => RenderedColumn) {
	provide(FOOTER_CELL, column);

	return column;
}

/** The column of the footer cell a part is in, such as `GridFooterContent`. */
export function useFooterCellContext(): () => RenderedColumn;
export function useFooterCellContext<TFallback>(fallback: TFallback): (() => RenderedColumn) | TFallback;
export function useFooterCellContext(...fallback: unknown[]) {
	return injectContext(FOOTER_CELL, fallback, 'useFooterCellContext', 'GridFooterCell');
}

/**
 * What the parts register their elements with while dragging is on: a drag list of rows or of
 * column headers, such as `useGridRowDrag` of `@vue-data-grid/core/drag-and-drop` gives.
 */
export interface GridDragItems {
	/** Connects the element of item `key`, a row key or a column name; returns the disconnect. */
	register: (element: HTMLElement, key: string) => () => void;
	/**
	 * The attributes of the element of item `key`, for its render: `data-dg-draggable` while it may be
	 * dragged. Give the row of a row, as `GridRow` does, so that the render follows that row alone.
	 * The same frozen object for the same answer.
	 */
	getItemProps: (key: string, row?: unknown) => Readonly<Record<string, string>>;
}

const ROW_DRAG: InjectionKey<GridDragItems> = Symbol('@vue-data-grid/core row drag');

const COLUMN_DRAG: InjectionKey<GridDragItems> = Symbol('@vue-data-grid/core column drag');

/** Gives the rows below a drag list: each `GridRow` registers its element with it. */
export function createRowDragContext<TItems extends GridDragItems>(items: TItems) {
	provide(ROW_DRAG, items);

	return items;
}

/**
 * The row drag list of the parts around, such as a `GridRowDrag`. `TItems` is not checked against
 * the provided list, just as with `inject`. Throws without one, unless given a `fallback`.
 */
export function useRowDragContext<TItems extends GridDragItems = GridDragItems>(): TItems;
export function useRowDragContext<TItems extends GridDragItems = GridDragItems, TFallback = null>(fallback: TFallback): TItems | TFallback;
export function useRowDragContext(...fallback: unknown[]) {
	return injectContext(ROW_DRAG, fallback, 'useRowDragContext', 'GridRowDrag');
}

/** Gives the column header cells below a drag list: each `GridHeaderCell` registers its element with it. */
export function createColumnDragContext<TItems extends GridDragItems>(items: TItems) {
	provide(COLUMN_DRAG, items);

	return items;
}

/** The column drag list of the parts around, such as a `GridColumnDrag`. */
export function useColumnDragContext<TItems extends GridDragItems = GridDragItems>(): TItems;
export function useColumnDragContext<TItems extends GridDragItems = GridDragItems, TFallback = null>(fallback: TFallback): TItems | TFallback;
export function useColumnDragContext(...fallback: unknown[]) {
	return injectContext(COLUMN_DRAG, fallback, 'useColumnDragContext', 'GridColumnDrag');
}
