import type { CellGrid } from './cell-address';
import type { CellTextWrite } from './cell-edit';
import type { RangeBounds } from './cell-range';

export interface DelimitedOptions {
	/** The field separator, not empty; `','` by default. A spreadsheet puts tabs on the clipboard: pass `'\t'`. */
	delimiter?: string;
}

const BYTE_ORDER_MARK = '\uFEFF';

/** Whether a field ends at `index`: at the end of the text, a line break or a delimiter. */
function isFieldEnd(text: string, index: number, delimiter: string) {
	const char = text[index];

	return index >= text.length || char === '\r' || char === '\n' || text.startsWith(delimiter, index);
}

/**
 * A quoted field from its opening quote: its value and where it ends; `null` when the quotes do not
 * close right before a delimiter, a line break or the end, so that the field is plain text.
 */
function readQuoted(text: string, start: number, delimiter: string): [string, number] | null {
	let index = start + 1;
	let value = '';

	for (;;) {
		const quote = text.indexOf('"', index);

		if (quote === -1) {
			return null;
		}

		value += text.slice(index, quote);

		if (text[quote + 1] === '"') {
			value += '"';
			index = quote + 2;
		} else {
			return isFieldEnd(text, quote + 1, delimiter) ? [value, quote + 1] : null;
		}
	}
}

function readPlain(text: string, start: number, delimiter: string): [string, number] {
	let index = start;

	while (!isFieldEnd(text, index, delimiter)) {
		index += 1;
	}

	return [text.slice(start, index), index];
}

/**
 * Text of delimited values, such as CSV or what a spreadsheet puts on the clipboard, as rows of fields,
 * the way RFC 4180 reads it and `toCsv` writes it: a field in double quotes holds delimiters and line
 * breaks, and two quotes stand for one; lines break at `\r\n`, `\n` or `\r`. A line break at the very
 * end ends the last row rather than starting an empty one, and a byte order mark is skipped.
 *
 * Text that is not quoted as RFC 4180 asks stays as it is, as a spreadsheet pastes it: a field whose
 * quotes do not close right before a delimiter or a line break, such as `"Hello" world` or a lone `"`,
 * is plain text, quotes included.
 */
export function parseDelimited(text: string, options: DelimitedOptions = {}): string[][] {
	const delimiter = options.delimiter ?? ',';
	const rows: string[][] = [];
	let row: string[] = [];
	let index = text.startsWith(BYTE_ORDER_MARK) ? BYTE_ORDER_MARK.length : 0;

	// An empty delimiter would split nowhere and never move on.
	if (delimiter === '') {
		throw new TypeError('[@vue-data-grid/core] `parseDelimited` needs a delimiter that is not empty.');
	}

	if (index >= text.length) {
		return rows;
	}

	for (;;) {
		const quoted = text[index] === '"' ? readQuoted(text, index, delimiter) : null;
		const [field, end] = quoted ?? readPlain(text, index, delimiter);

		row.push(field);
		index = end;

		if (index >= text.length) {
			rows.push(row);

			return rows;
		}

		if (text.startsWith(delimiter, index)) {
			// A delimiter at the very end leaves an empty last field, which the next turn reads.
			index += delimiter.length;
		} else {
			index += text[index] === '\r' && text[index + 1] === '\n' ? 2 : 1;
			rows.push(row);
			row = [];

			// A line break at the very end ends the last row.
			if (index >= text.length) {
				return rows;
			}
		}
	}
}

export interface PasteResult {
	/** The text each cell gets, through the column's `parse` when it is written. */
	writes: CellTextWrite[];
	/** The cells the paste covers, such as to select them after it; `null` for nothing to paste. */
	bounds: RangeBounds | null;
}

/**
 * Where pasted rows of text go from a selection in `grid`, as a spreadsheet lays them: from its top
 * left corner, and repeated over the whole selection when it is a multiple of the pasted block in both
 * directions, such as one value pasted over a column. The block is as wide as its longest row, and is
 * clipped at the last row and column of the grid; a short row of the block pastes empty text into the
 * rest.
 */
export function resolvePaste(target: RangeBounds, matrix: readonly (readonly string[])[], grid: CellGrid): PasteResult {
	const height = matrix.length;
	// A loop rather than `Math.max(...)`: a paste of many rows would overflow the arguments of a call.
	let width = 0;

	for (const row of matrix) {
		width = Math.max(width, row.length);
	}

	if (height === 0 || width === 0) {
		return { writes: [], bounds: null };
	}

	const targetHeight = target.rowEnd - target.rowStart;
	const targetWidth = target.columnEnd - target.columnStart;
	const tiles = targetHeight % height === 0 && targetWidth % width === 0;
	const rowEnd = Math.min(target.rowStart + (tiles ? targetHeight : height), grid.keys.length);
	const columnEnd = Math.min(target.columnStart + (tiles ? targetWidth : width), grid.columns.length);
	const writes: CellTextWrite[] = [];

	for (let row = target.rowStart; row < rowEnd; row += 1) {
		const source = matrix[(row - target.rowStart) % height];

		for (let column = target.columnStart; column < columnEnd; column += 1) {
			writes.push({ key: grid.keys[row], column: grid.columns[column], text: source[(column - target.columnStart) % width] ?? '' });
		}
	}

	if (writes.length === 0) {
		return { writes, bounds: null };
	}

	return { writes, bounds: { rowStart: target.rowStart, rowEnd, columnStart: target.columnStart, columnEnd } };
}
