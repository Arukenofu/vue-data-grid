import { type AnyColumn, getCellText, type RuntimeColumn } from '../columns/column';

type CsvColumn = AnyColumn | RuntimeColumn;

export interface CsvOptions<TRow> {
	/** Columns in column order; usually the shown ones from `scope.columns`. */
	columns: readonly CsvColumn[];
	/** Keep service columns (`kind: 'service'`), which are skipped by default. */
	includeService?: boolean;
	rows: readonly TRow[];
	/** `,` by default; use `\t` for the clipboard. */
	delimiter?: string;
	/**
	 * A line of column headers first: the column's `label`, otherwise its name; a function gives your
	 * own. `true` by default.
	 */
	headers?: boolean | ((column: CsvColumn) => string);
	/** `\r\n` by default, as in RFC 4180. */
	newline?: string;
	/**
	 * Prefixes with `'` any text a spreadsheet would take for a formula: starting with `=`, `+`, `-`,
	 * `@`, a tab or a carriage return. Numbers, negative ones included, are left alone. `true` by
	 * default; `false` for text that goes back into a grid, such as the clipboard.
	 */
	escapeFormulas?: boolean;
}

const FORMULA_START = /^[=+\-@\t\r]/;

const NUMBER = /^[+-]?[\d\s.,]+%?$/;

function getHeaderText(column: CsvColumn) {
	return column.label ?? column.name;
}

function escapeField(text: string, delimiter: string, escapeFormulas: boolean) {
	const safe = escapeFormulas && FORMULA_START.test(text) && !NUMBER.test(text) ? `'${text}` : text;

	return safe.includes(delimiter) || /["\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Rows as CSV text, each value through the column's `format`; service columns are left out. A last
 * line that is one empty field ends with a line break, so that it reads back as a row. The file,
 * `Blob` and BOM are up to you.
 */
export function toCsv<TRow>(options: CsvOptions<TRow>) {
	const { rows, delimiter = ',', headers = true, newline = '\r\n', escapeFormulas = true } = options;
	const columns = options.includeService
		? options.columns
		: options.columns.filter(column => column.kind !== 'service');
	const lines: string[] = [];
	const line = (fields: readonly string[]) => fields.map(field => escapeField(field, delimiter, escapeFormulas)).join(delimiter);

	if (headers) {
		lines.push(line(columns.map(typeof headers === 'function' ? headers : getHeaderText)));
	}

	for (const row of rows) {
		lines.push(line(columns.map(column => getCellText(column, row))));
	}

	const text = lines.join(newline);

	return lines.at(-1) === '' ? `${text}${newline}` : text;
}
