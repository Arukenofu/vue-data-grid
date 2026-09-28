import type { RenderedColumn, RenderedGroup } from '@vue-data-grid/engine';
import { h } from 'vue';

import type { GridBodyRow } from '../../src/components/context';
import { GridBody, GridCells, GridRow } from '../../src/components/grid-body';
import { GridFooter, GridFooterCell, GridFooterRow } from '../../src/components/grid-footer';
import {
	GridGroupCell,
	GridGroupContent,
	GridGroupRow,
	GridGroupToggle,
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
} from '../../src/components/grid-header';
import { GridResizeHandle } from '../../src/components/grid-resize-handle';
import { GridSortIndicator } from '../../src/components/grid-service-parts';

/** The header composed of every part: group rows with toggles, header cells with a sort indicator and a resize handle. */
export function renderHeader() {
	return h(GridHeader, null, {
		default: ({ groups }: { groups: readonly (readonly RenderedGroup[])[] }) => [
			...groups.map((_cells, level) => h(GridGroupRow, { key: `level-${level}`, level }, {
				default: ({ cells }: { cells: readonly RenderedGroup[] }) => cells.map(cell => h(GridGroupCell, { key: cell.key, cell }, {
					default: () => [h(GridGroupContent), h(GridGroupToggle)],
				})),
			})),
			h(GridHeaderRow, { key: 'columns' }, {
				default: ({ columns }: { columns: readonly RenderedColumn[] }) => columns.map(column => h(GridHeaderCell, { key: column.key, column }, {
					default: () => [h(GridHeaderContent), h(GridSortIndicator), h(GridResizeHandle)],
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
	return h(GridBody, null, {
		default: ({ rows }: { rows: readonly GridBodyRow[] }) => rows.map(row => h(GridRow, { key: row.key, row }, {
			default: () => h(GridCells),
			$stable: true,
		})),
	});
}

/** The footer of one row of cells. */
export function renderFooter() {
	return h(GridFooter, null, {
		default: () => h(GridFooterRow, null, {
			default: ({ columns }: { columns: readonly RenderedColumn[] }) => columns.map(column => h(GridFooterCell, { key: column.key, column })),
		}),
	});
}
