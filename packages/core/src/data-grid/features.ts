import {
	type AnyColumn,
	type CellRanges,
	type CellRangesOptions,
	type ColumnAggregates,
	type ColumnsInput,
	type GridColumnsState,
	type GridScope,
	type RowGroup,
	type RowGroupLevel,
	type RowKey,
	type RowSelection,
	type RowSelectionOptions,
	type RowTree,
	type RowTreeOptions,
	useCellRanges,
	useGroupedRows,
	useRowSelection,
	useRowTree,
	useSortedRows,
} from '@vue-data-grid/engine';
import { computed, type MaybeRefOrGetter, type Ref, toValue } from 'vue';

import type { BodyCellFocus } from '../navigation/body-cell-focus';
import {
	type CellNavigation,
	type CellNavigationOptions,
	type CellNavigationSelection,
	type CellNavigationTree,
	useCellNavigation,
} from '../navigation/use-cell-navigation';
import type { GridProps } from '../props/use-grid-props';
import { type RangeSelectionGrid, type RangeSelectionOptions, useRangeSelection } from '../ranges/use-range-selection';

/** Columns of a grid: an object from `defineColumns`, or an array. */
export type GridColumns = ColumnsInput | readonly AnyColumn[];

/** What a feature that changes the rows builds on: the rows coming into its step and the grid around them. */
export interface RowsGrid<TRow, TColumns extends GridColumns = GridColumns> {
	/** The rows of the previous step: the source rows, grouped, then sorted. */
	rows: Readonly<Ref<readonly TRow[]>>;
	rowKey: RowKey<TRow>;
	columns: MaybeRefOrGetter<TColumns>;
	/** The column state: its `sort` is what sorting features sort by. */
	state: GridColumnsState;
}

/** A feature that changes the rows: grouping, sorting. */
export interface GridRowsFeature<TRow> {
	rows: Readonly<Ref<readonly TRow[]>>;
}

/** What a selection builds on: the shown rows, and the tree when there is one. */
export interface SelectionGrid<TRow, TColumns extends GridColumns = GridColumns> extends RowsGrid<TRow, TColumns> {
	tree?: Pick<RowTree<TRow>, 'getChildren'>;
}

/** What the navigation builds on: the grid as it renders. */
export interface NavigationGrid<TRow = unknown> {
	scope: GridScope<TRow>;
	/** The sections of the grid's rows, as `useGridProps` gives them. */
	sections: GridProps['sections'];
	root: Readonly<Ref<HTMLElement | null>>;
	head: Readonly<Ref<HTMLElement | null>>;
	foot: Readonly<Ref<HTMLElement | null>>;
	/** The element after the grid that Tab leaves through; `GridRoot` renders it. */
	exit: Readonly<Ref<HTMLElement | null>>;
	/** The tree of the grid, for the keys of the tree; `undefined` without the feature. */
	tree?: CellNavigationTree;
	/** The row selection, for Shift+Space and Ctrl+A; `undefined` without the feature. */
	selection?: CellNavigationSelection;
}

/** What cell ranges build on: the grid as it renders, and its navigation when it has one. */
export interface RangesGrid extends RangeSelectionGrid {
	navigation?: { cells: BodyCellFocus };
}

export interface GridSortingOptions {
	/** Re-sort only rows that arrive as new objects, as in `useSortedRows`. */
	delta?: MaybeRefOrGetter<boolean>;
}

/**
 * Sorts the rows by the column state's `sort`, on the client. Without it the grid leaves the rows in
 * their order, as a server that sorts them wants; header clicks still change the sort.
 */
export function useGridSorting<TRow>(grid: RowsGrid<TRow>, options: GridSortingOptions = {}): GridRowsFeature<TRow> {
	return {
		rows: useSortedRows({ rows: grid.rows, sort: grid.state.sort, columns: grid.columns, delta: options.delta }),
	};
}

export interface GridGroupingOptions<TRow, TColumns extends GridColumns> {
	/** Grouping levels, from the top; none returns the rows as they are. */
	by: MaybeRefOrGetter<readonly RowGroupLevel<TRow>[]>;
	/** Builds the row of a group; `group.aggregates` is typed by the grid's columns. */
	createGroup: (group: RowGroup<TRow, ColumnAggregates<TColumns>>) => TRow;
}

/**
 * Groups the rows by value, with aggregates of the grid's columns, into group rows with children:
 * pair it with `useGridTree` and a `childrenField`, which flattens them.
 */
export function useGridGrouping<TRow, TColumns extends GridColumns>(
	grid: RowsGrid<TRow, TColumns>,
	options: GridGroupingOptions<TRow, TColumns>,
): GridRowsFeature<TRow> {
	return {
		rows: useGroupedRows<TRow, TColumns>({
			rows: grid.rows,
			by: options.by,
			columns: grid.columns,
			createGroup: options.createGroup,
		}),
	};
}

export interface GridTreeOptions<TRow> extends Omit<RowTreeOptions<TRow>, 'rows' | 'rowKey' | 'sort' | 'columns'> {
	/** Sort the siblings of every level by the column state's `sort`; `true` by default. */
	sort?: MaybeRefOrGetter<boolean>;
}

/**
 * The rows as a tree, flattened into the shown rows, each level sorted by the column state. The tree
 * sorts its levels itself: a grid with a tree needs no sorting feature.
 */
export function useGridTree<TRow>(grid: RowsGrid<TRow>, options: GridTreeOptions<TRow> = {}): RowTree<TRow> {
	const { sort, ...tree } = options;

	return useRowTree({
		...tree,
		rows: grid.rows,
		rowKey: grid.rowKey,
		sort: computed(() => ((toValue(sort) ?? true) ? grid.state.sort.value : [])),
		columns: grid.columns,
	});
}

export type GridSelectionOptions<TRow> = Omit<RowSelectionOptions<TRow>, 'rows' | 'rowKey' | 'getChildren'>;

/**
 * Row selection over the shown rows; with a tree, a group selects the leaves under it. Rows get
 * `aria-selected` and the grid `aria-multiselectable` from it.
 */
export function useGridSelection<TRow>(grid: SelectionGrid<TRow>, options: GridSelectionOptions<TRow> = {}): RowSelection {
	return useRowSelection({
		...options,
		rows: grid.rows,
		rowKey: grid.rowKey,
		getChildren: grid.tree?.getChildren,
	});
}

export interface GridNavigationOptions
	extends Omit<CellNavigationOptions, 'grid' | 'exit' | 'sections' | 'stickyStart' | 'stickyEnd'> {
	/** The element after the grid that Tab leaves through; the grid's `exit` by default. */
	exit?: CellNavigationOptions['exit'];
}

/**
 * Keyboard navigation of the grid over the grid's header, body and footer: `useCellNavigation` with
 * the grid's element, sections, sticky blocks and exit, and the keys of its tree and selection. With
 * it, cells of the grid get `tabindex="-1"`.
 */
export function useGridNavigation(grid: NavigationGrid, options: GridNavigationOptions = {}): CellNavigation {
	return useCellNavigation(grid.scope, {
		tree: grid.tree,
		selection: grid.selection,
		...options,
		grid: grid.root,
		exit: options.exit ?? grid.exit,
		sections: grid.sections,
		stickyStart: grid.head,
		stickyEnd: grid.foot,
	});
}

export interface GridRangesOptions extends CellRangesOptions, Pick<RangeSelectionOptions, 'autoScroll' | 'enabled' | 'focus'> {}

/**
 * Cell ranges of the grid with their gestures: `useCellRanges` over the grid's scope, and
 * `useRangeSelection` with the grid's navigation. Cells get `aria-selected`, and `GridRangeOverlay`
 * draws the ranges.
 */
export function useGridRanges(grid: RangesGrid, options: GridRangesOptions = {}): CellRanges {
	const { autoScroll, enabled, focus, ...model } = options;
	const ranges = useCellRanges(grid.scope, model);

	useRangeSelection(grid, { ranges, focus: focus ?? grid.navigation?.cells, autoScroll, enabled });

	return ranges;
}
