import {
	type AnyColumn,
	type CellRanges,
	type CellRangesOptions,
	type ColumnAggregates,
	type ColumnsInput,
	type RowGroup,
	type RowGroupLevel,
	type RowKey,
	type RowSelection,
	type RowSelectionOptions,
	type RowTree,
	type RowTreeOptions,
	type TableColumnsState,
	type TableScope,
	useCellRanges,
	useGroupedRows,
	useRowSelection,
	useRowTree,
	useSortedRows,
} from '@vue-data-grid/engine';
import { computed, type MaybeRefOrGetter, type Ref, toValue } from 'vue';

import type { BodyCellFocus } from '../navigation/body-cell-focus';
import {
	type GridNavigation,
	type GridNavigationOptions,
	type GridNavigationSelection,
	type GridNavigationTree,
	useGridNavigation,
} from '../navigation/use-grid-navigation';
import type { TableProps } from '../props/use-table-props';
import { type RangeSelectionOptions, type RangeSelectionTable, useRangeSelection } from '../ranges/use-range-selection';

/** Columns of a table: an object from `defineColumns`, or an array. */
export type TableColumns = ColumnsInput | readonly AnyColumn[];

/** What a feature that changes the rows builds on: the rows coming into its step and the table around them. */
export interface RowsTable<TRow, TColumns extends TableColumns = TableColumns> {
	/** The rows of the previous step: the source rows, grouped, then sorted. */
	rows: Readonly<Ref<readonly TRow[]>>;
	rowKey: RowKey<TRow>;
	columns: MaybeRefOrGetter<TColumns>;
	/** The column state: its `sort` is what sorting features sort by. */
	state: TableColumnsState;
}

/** A feature that changes the rows: grouping, sorting. */
export interface TableRowsFeature<TRow> {
	rows: Readonly<Ref<readonly TRow[]>>;
}

/** What a selection builds on: the shown rows, and the tree when there is one. */
export interface SelectionTable<TRow, TColumns extends TableColumns = TableColumns> extends RowsTable<TRow, TColumns> {
	tree?: Pick<RowTree<TRow>, 'getChildren'>;
}

/** What the navigation builds on: the table as it renders. */
export interface NavigationTable<TRow = unknown> {
	scope: TableScope<TRow>;
	/** The sections of the table's rows, as `useTableProps` gives them. */
	sections: TableProps['sections'];
	root: Readonly<Ref<HTMLElement | null>>;
	head: Readonly<Ref<HTMLElement | null>>;
	foot: Readonly<Ref<HTMLElement | null>>;
	/** The element after the table that Tab leaves through; `TableRoot` renders it. */
	exit: Readonly<Ref<HTMLElement | null>>;
	/** The tree of the table, for the keys of the tree; `undefined` without the feature. */
	tree?: GridNavigationTree;
	/** The row selection, for Shift+Space and Ctrl+A; `undefined` without the feature. */
	selection?: GridNavigationSelection;
}

/** What cell ranges build on: the table as it renders, and its navigation when it has one. */
export interface RangesTable extends RangeSelectionTable {
	navigation?: { cells: BodyCellFocus };
}

export interface TableSortingOptions {
	/** Re-sort only rows that arrive as new objects, as in `useSortedRows`. */
	delta?: MaybeRefOrGetter<boolean>;
}

/**
 * Sorts the rows by the column state's `sort`, on the client. Without it the table leaves the rows in
 * their order, as a server that sorts them wants; header clicks still change the sort.
 */
export function useTableSorting<TRow>(table: RowsTable<TRow>, options: TableSortingOptions = {}): TableRowsFeature<TRow> {
	return {
		rows: useSortedRows({ rows: table.rows, sort: table.state.sort, columns: table.columns, delta: options.delta }),
	};
}

export interface TableGroupingOptions<TRow, TColumns extends TableColumns> {
	/** Grouping levels, from the top; none returns the rows as they are. */
	by: MaybeRefOrGetter<readonly RowGroupLevel<TRow>[]>;
	/** Builds the row of a group; `group.aggregates` is typed by the table's columns. */
	createGroup: (group: RowGroup<TRow, ColumnAggregates<TColumns>>) => TRow;
}

/**
 * Groups the rows by value, with aggregates of the table's columns, into group rows with children:
 * pair it with `useTableTree` and a `childrenField`, which flattens them.
 */
export function useTableGrouping<TRow, TColumns extends TableColumns>(
	table: RowsTable<TRow, TColumns>,
	options: TableGroupingOptions<TRow, TColumns>,
): TableRowsFeature<TRow> {
	return {
		rows: useGroupedRows<TRow, TColumns>({
			rows: table.rows,
			by: options.by,
			columns: table.columns,
			createGroup: options.createGroup,
		}),
	};
}

export interface TableTreeOptions<TRow> extends Omit<RowTreeOptions<TRow>, 'rows' | 'rowKey' | 'sort' | 'columns'> {
	/** Sort the siblings of every level by the column state's `sort`; `true` by default. */
	sort?: MaybeRefOrGetter<boolean>;
}

/**
 * The rows as a tree, flattened into the shown rows, each level sorted by the column state. The tree
 * sorts its levels itself: a table with a tree needs no sorting feature.
 */
export function useTableTree<TRow>(table: RowsTable<TRow>, options: TableTreeOptions<TRow> = {}): RowTree<TRow> {
	const { sort, ...tree } = options;

	return useRowTree({
		...tree,
		rows: table.rows,
		rowKey: table.rowKey,
		sort: computed(() => ((toValue(sort) ?? true) ? table.state.sort.value : [])),
		columns: table.columns,
	});
}

export type TableSelectionOptions<TRow> = Omit<RowSelectionOptions<TRow>, 'rows' | 'rowKey' | 'getChildren'>;

/**
 * Row selection over the shown rows; with a tree, a group selects the leaves under it. Rows get
 * `aria-selected` and the table `aria-multiselectable` from it.
 */
export function useTableSelection<TRow>(table: SelectionTable<TRow>, options: TableSelectionOptions<TRow> = {}): RowSelection {
	return useRowSelection({
		...options,
		rows: table.rows,
		rowKey: table.rowKey,
		getChildren: table.tree?.getChildren,
	});
}

export interface TableNavigationOptions
	extends Omit<GridNavigationOptions, 'grid' | 'exit' | 'sections' | 'stickyStart' | 'stickyEnd'> {
	/** The element after the table that Tab leaves through; the table's `exit` by default. */
	exit?: GridNavigationOptions['exit'];
}

/**
 * Keyboard navigation of the grid over the table's header, body and footer: `useGridNavigation` with
 * the table's element, sections, sticky blocks and exit, and the keys of its tree and selection. With
 * it, cells of the table get `tabindex="-1"`.
 */
export function useTableNavigation(table: NavigationTable, options: TableNavigationOptions = {}): GridNavigation {
	return useGridNavigation(table.scope, {
		tree: table.tree,
		selection: table.selection,
		...options,
		grid: table.root,
		exit: options.exit ?? table.exit,
		sections: table.sections,
		stickyStart: table.head,
		stickyEnd: table.foot,
	});
}

export interface TableRangesOptions extends CellRangesOptions, Pick<RangeSelectionOptions, 'autoScroll' | 'enabled' | 'focus'> {}

/**
 * Cell ranges of the table with their gestures: `useCellRanges` over the table's scope, and
 * `useRangeSelection` with the table's navigation. Cells get `aria-selected`, and `TableRangeOverlay`
 * draws the ranges.
 */
export function useTableRanges(table: RangesTable, options: TableRangesOptions = {}): CellRanges {
	const { autoScroll, enabled, focus, ...model } = options;
	const ranges = useCellRanges(table.scope, model);

	useRangeSelection(table, { ranges, focus: focus ?? table.navigation?.cells, autoScroll, enabled });

	return ranges;
}
