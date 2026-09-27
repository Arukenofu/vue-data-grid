import type { RenderedColumn, RenderedGroup } from '@vue-data-grid/core';
import { h } from 'vue';

import type { TableBodyRow } from '../../src/components/context';
import { TableBody, TableCells, TableRow } from '../../src/components/table-body';
import { TableFooter, TableFooterCell, TableFooterRow } from '../../src/components/table-footer';
import {
	TableGroupCell,
	TableGroupContent,
	TableGroupRow,
	TableGroupToggle,
	TableHeader,
	TableHeaderCell,
	TableHeaderContent,
	TableHeaderRow,
} from '../../src/components/table-header';
import { TableResizeHandle } from '../../src/components/table-resize-handle';
import { TableSortIndicator } from '../../src/components/table-service-parts';

/** The header composed of every part: group rows with toggles, header cells with a sort indicator and a resize handle. */
export function renderHeader() {
	return h(TableHeader, null, {
		default: ({ groups }: { groups: readonly (readonly RenderedGroup[])[] }) => [
			...groups.map((_cells, level) => h(TableGroupRow, { key: `level-${level}`, level }, {
				default: ({ cells }: { cells: readonly RenderedGroup[] }) => cells.map(cell => h(TableGroupCell, { key: cell.key, cell }, {
					default: () => [h(TableGroupContent), h(TableGroupToggle)],
				})),
			})),
			h(TableHeaderRow, { key: 'columns' }, {
				default: ({ columns }: { columns: readonly RenderedColumn[] }) => columns.map(column => h(TableHeaderCell, { key: column.key, column }, {
					default: () => [h(TableHeaderContent), h(TableSortIndicator), h(TableResizeHandle)],
				})),
			}),
		],
	});
}

/**
 * The body composed of rows of cells. The slot of a row is marked stable, as a compiled template marks
 * it: a row whose props hold does not render again when the body does.
 */
export function renderBody() {
	return h(TableBody, null, {
		default: ({ rows }: { rows: readonly TableBodyRow[] }) => rows.map(row => h(TableRow, { key: row.key, row }, {
			default: () => h(TableCells),
			$stable: true,
		})),
	});
}

/** The footer of one row of cells. */
export function renderFooter() {
	return h(TableFooter, null, {
		default: () => h(TableFooterRow, null, {
			default: ({ columns }: { columns: readonly RenderedColumn[] }) => columns.map(column => h(TableFooterCell, { key: column.key, column })),
		}),
	});
}
