import type { AggregateName, ColumnAggregate, ColumnInput } from '@vue-data-grid/engine';
import { h } from 'vue';

import {
	TableSelectAllCheckbox,
	TableSelectionCheckbox,
	TableTreeToggle,
} from '../components/table-service-parts';

/** What a service column can change of its declaration: its place, size and rights. */
export type ServiceColumnOptions = Pick<
	ColumnInput<unknown, unknown>,
	'label' | 'width' | 'minWidth' | 'maxWidth' | 'pinned' | 'pinnable' | 'movable' | 'resizable' | 'hideable' | 'align'
>;

/**
 * The checkbox column of the row selection: a real column, `kind: 'service'`, pinned to the start
 * by default, with a `TableSelectAllCheckbox` in its header and a `TableSelectionCheckbox` in every
 * cell. The checkboxes find the selection in the table they are rendered in, so the table needs the
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
		header: () => h(TableSelectAllCheckbox),
		cell: ({ key }) => h(TableSelectionCheckbox, { row: key }),
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
 * from level 1, and a `TableTreeToggle`, which expands a group row and leaves room on a leaf while the
 * tree has groups, then the column's own content. The indent is `--dg-tree-indent` per level in the structural styles. The toggle finds the
 * tree in the table it is rendered in, so the table needs the `tree` feature. The column is marked
 * `tree`, so → and ← of the navigation expand and collapse rows in it.
 */
export function treeColumn<
	TRow,
	TValue,
	TMeta,
	TAggregate extends ColumnAggregate<TRow, TValue> | AggregateName | undefined,
>(column: ColumnInput<TRow, TValue, TMeta, TAggregate>): ColumnInput<TRow, TValue, TMeta, TAggregate> {
	const { cell } = column;

	return {
		...column,
		tree: true,
		cell: context => [
			context.node?.level
				? h('span', { 'aria-hidden': 'true', 'data-dg-part': 'tree-indent', style: `--dg-level:${context.node.level}` })
				: null,
			h(TableTreeToggle, { row: context.key }),
			cell?.(context) ?? h('span', { 'data-dg-part': 'cell-text' }, formatValue(column, context.value, context.row)),
		],
	};
}

function formatValue<TRow, TValue>(column: Pick<ColumnInput<TRow, TValue>, 'format'>, value: TValue, row: TRow) {
	if (column.format) {
		return column.format(value, row);
	}

	return value === null || value === undefined ? '' : String(value);
}
