import { getCellText, type TableScope } from '@vue-data-grid/engine';

import { measureColumnsContent, type MeasureColumnsOptions } from './measure-column';

export interface AutosizeOptions {
	/**
	 * `'all'` also covers rows outside the row window by measuring their `format` text in the font of a
	 * body cell. Right only while `format` returns exactly what the cell shows. `'rendered'` by default.
	 */
	rows?: 'rendered' | 'all';
	/** The attribute of body rows, the engine's `indexAttribute`; `data-dg-index` by default. */
	bodyAttribute?: string;
	/** Text width in a font, px; measured with a canvas by default. */
	measureText?: MeasureColumnsOptions['measureText'];
}

/**
 * Fits columns to their content in one layout write; without `names`, every shown `resizable` data
 * column, service ones (`kind: 'service'`) left out. Returns the names it measured: a column outside
 * the column window has no cells, and one that is not `resizable` is skipped. With a row window only
 * rendered rows are measured, unless `rows` is `'all'`.
 */
export function autosizeColumns(scope: TableScope, names?: readonly string[], options: AutosizeOptions = {}) {
	const root = scope.root.value;
	const wanted = names ? new Set(names) : null;
	// Named columns are measured whatever their kind; without names, service columns keep their width.
	const targets = scope.columns.value.flatMap(item => (
		item.column?.resizable && (wanted ? wanted.has(item.column.name) : item.column.kind !== 'service')
			? [item.column]
			: []
	));

	if (!root || targets.length === 0) {
		return [];
	}

	const texts = options.rows === 'all'
		? new Map(targets.map(column => [column.name, scope.rows.value.map(row => getCellText(column, row))]))
		: undefined;

	const widths = measureColumnsContent(root, targets.map(column => column.name), {
		texts,
		bodyAttribute: options.bodyAttribute,
		measureText: options.measureText,
	});

	return scope.setWidths(Object.fromEntries(widths)) ? [...widths.keys()] : [];
}
