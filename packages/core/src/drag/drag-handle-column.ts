import type { ColumnInput } from '@vue-data-grid/engine';
import { h } from 'vue';

import type { ServiceColumnOptions } from '../columns/service-columns';
import { GridDragHandle } from './grid-drag-parts';

/**
 * The column of row drag handles: a real column, `kind: 'service'`, pinned to the start by default,
 * with a `GridDragHandle` in every cell. Its `label`, `'Drag'` by default, names the header as a
 * `hidden-label` part: read by screen readers, hidden by the structural styles. Put the rows in a
 * `GridRowDrag` with `handle`, so that rows drag by it, and with the keyboard; CSV, ranges and
 * autosize leave it out.
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
		header: ({ column }) => h('span', { 'data-dg-part': 'hidden-label' }, column.label ?? column.name),
		cell: ({ key }) => h(GridDragHandle, { row: key }),
	};
}
