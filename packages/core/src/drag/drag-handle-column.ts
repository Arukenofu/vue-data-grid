import type { ColumnInput } from '@vue-data-grid/engine';
import { h } from 'vue';

import type { ServiceColumnOptions } from '../columns/service-columns';
import { TableDragHandle } from './table-drag-parts';

/**
 * The column of row drag handles: a real column, `kind: 'service'`, pinned to the start by default,
 * with a `TableDragHandle` in every cell and an empty header. Put the rows in a `TableRowDrag` with
 * `handle`, so that rows drag by it, and with the keyboard; CSV, ranges and autosize leave it out.
 */
export function dragHandleColumn<TRow>(options: ServiceColumnOptions = {}): ColumnInput<TRow, null> {
	return {
		label: 'Drag',
		width: 32,
		minWidth: 32,
		pinned: 'start',
		align: 'center',
		...options,
		kind: 'service',
		value: () => null,
		header: () => '',
		cell: ({ key }) => h(TableDragHandle, { row: key }),
	};
}
