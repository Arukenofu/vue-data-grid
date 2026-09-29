import type { AggregateName, ColumnAggregate, ColumnInput } from '@vue-data-grid/engine';
import { h } from 'vue';

import {
	GridSelectAllCheckbox,
	GridSelectionCheckbox,
	GridTreeToggle,
} from '../components/grid-service-parts';

/** What a service column can change of its declaration: its place, size and rights. */
export type ServiceColumnOptions = Pick<
	ColumnInput<unknown, unknown>,
	'label' | 'width' | 'minWidth' | 'maxWidth' | 'pinned' | 'pinnable' | 'movable' | 'resizable' | 'hideable' | 'align'
>;

/**
 * The checkbox column of the row selection: a real column, `kind: 'service'`, pinned to the start
 * by default, with a `GridSelectAllCheckbox` in its header and a `GridSelectionCheckbox` in every
 * cell. The checkboxes find the selection in the grid they are rendered in, so the grid needs the
 * `selection` feature; CSV, ranges and autosize leave the column out.
 */
export function selectionColumn<TRow>(options: ServiceColumnOptions = {}): ColumnInput<TRow, null> {
	return {
		label: 'Selection',
		width: 40,
		minWidth: 40,
		pinned: 'start',
		align: 'center',
		...options,
		kind: 'service',
		value: () => null,
		header: () => h(GridSelectAllCheckbox),
		cell: ({ key }) => h(GridSelectionCheckbox, { row: key }),
	};
}

/**
 * The column of row numbers: the place of each row among the shown ones, from `1`. A service column,
 * so CSV, ranges and autosize leave it out; declare `rowHeader: true` on it for a spreadsheet, where
 * the number names the row.
 */
export function rowNumberColumn<TRow>(options: ServiceColumnOptions & { rowHeader?: boolean } = {}): ColumnInput<TRow, null> {
	return {
		label: '#',
		width: 56,
		minWidth: 40,
		align: 'right',
		...options,
		kind: 'service',
		value: () => null,
		cell: ({ index }) => String(index + 1),
	};
}

/**
 * Makes a data column the column of the tree: each cell starts with an indent for the row's level,
 * from level 1, and a `GridTreeToggle`, which expands a group row and leaves room on a leaf while the
 * tree has groups, then the cell's content: a slot of `GridCells`, the column's `GridCellTemplate`,
 * its `cell`, else its text. The indent and the toggle are the column's `cellFrame`. The indent is
 * `--dg-tree-indent` per level in the structural styles. The toggle finds the tree in the grid it is
 * rendered in, so the grid needs the `tree` feature. The column is marked `tree`, so → and ← of the
 * navigation expand and collapse rows in it. An `editable` tree column edits the content alone: the
 * indent and the toggle stay before the editor.
 */
export function treeColumn<
	TRow,
	TValue,
	TMeta,
	TAggregate extends ColumnAggregate<TRow, TValue> | AggregateName | undefined,
>(column: ColumnInput<TRow, TValue, TMeta, TAggregate>): ColumnInput<TRow, TValue, TMeta, TAggregate> {
	return {
		...column,
		tree: true,
		cellFrame: (context, content) => [
			context.node?.level
				? h('span', { 'aria-hidden': 'true', 'data-dg-part': 'tree-indent', style: `--dg-level:${context.node.level}` })
				: null,
			h(GridTreeToggle, { row: context.key }),
			content,
		],
	};
}
