import { type RowEditing, type RowEditingOptions, type RowKey, useRowEditing } from '@vue-data-grid/engine';
import type { Ref } from 'vue';

import type { GridTreeStructure } from '../data-grid/features';

/** What row editing needs of a grid; the grid of `useDataGrid` builds the feature with it. */
export interface RowEditingGrid<TRow = unknown> {
	/** The source rows, before grouping, sorting and the tree: what commits change. */
	rows: Readonly<Ref<readonly TRow[]>>;
	rowKey: RowKey<TRow>;
	/** How the tree of the rows reads and writes their parents; `undefined` for flat rows. */
	tree?: GridTreeStructure<TRow>;
}

export type GridRowEditingOptions<TRow = unknown> = Omit<
	RowEditingOptions<TRow>,
	'rows' | 'rowKey' | 'parentKey' | 'setParent' | 'childrenField'
>;

/**
 * Editing the rows of a grid: `useRowEditing` over the grid's source rows, its row key, and the
 * `parentKey`, `setParent` or `childrenField` of its tree. `write` adds, updates, removes and moves
 * rows by key as one commit, and `onCommit` writes it into your rows; a drop of a dragged row goes
 * through it unless the row drag's `onDrop` calls `preventDefault()`.
 */
export function useGridRowEditing<TRow = unknown>(grid: RowEditingGrid<TRow>, options: GridRowEditingOptions<TRow>): RowEditing<TRow> {
	return useRowEditing({
		...options,
		rows: grid.rows,
		rowKey: grid.rowKey,
		parentKey: grid.tree?.parentKey,
		setParent: grid.tree?.setParent,
		childrenField: () => grid.tree?.childrenField?.value,
	});
}

/** Row editing of a grid as `useGridRowEditing` gives it. */
export type GridRowEditing<TRow = unknown> = RowEditing<TRow>;
