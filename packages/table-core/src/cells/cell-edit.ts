import type { RuntimeColumn } from '../columns/column';
import type { CellAddress } from './cell-address';

/**
 * Where an edit comes from: an editor, a paste, a fill, clearing or cutting cells, undo, redo, or your
 * own. `'undo'` and `'redo'` are the writes of `useChangeHistory`, which it does not record as steps.
 */
export type CellEditSource = 'edit' | 'paste' | 'fill' | 'clear' | 'cut' | 'undo' | 'redo' | (string & {});

/** A value to write into a cell. */
export interface CellWrite extends CellAddress {
	value: unknown;
	/**
	 * Write only while the cell holds this value, by the column's `equals`: a cell that changed since,
	 * such as by a stream or another edit, is skipped. Undo writes with it.
	 */
	expected?: unknown;
}

/** Text to write into a cell, through the column's `parse`. */
export interface CellTextWrite extends CellAddress {
	text: string;
}

/**
 * A cell a commit changes: its row before the commit, and its value before and after. `after` is what
 * the cell holds in the new row, as the column's `value` reads it, so a `setValue` that trims or rounds
 * is seen here.
 */
export interface CellEdit<TRow = unknown> extends CellAddress {
	row: TRow;
	before: unknown;
	after: unknown;
}

/** Whether a column lets the cell of this row be edited: `editable`, and `setValue` to write with. */
export function canEditCell(column: RuntimeColumn, row: unknown) {
	const { editable } = column;

	return column.kind === 'data'
		&& column.setValue !== undefined
		&& (typeof editable === 'function' ? editable(row) : editable === true);
}

/** Whether two values of a column are the same, by its `equals`, else `Object.is`. */
export function isSameCellValue(column: RuntimeColumn, current: unknown, next: unknown) {
	return column.equals ? column.equals(current, next) : Object.is(current, next);
}

/** What `validate` says of a value: its text, or `null` for a right one, empty text included. */
export function validateCell(column: RuntimeColumn, value: unknown, row: unknown) {
	const error = column.validate?.(value, row);

	return typeof error === 'string' && error !== '' ? error : null;
}

/**
 * The rows after the edits, each through the `setValue` of its columns, by row key. Edits of one row
 * build on each other in order.
 */
export function applyCellEdits<TRow>(edits: readonly CellEdit<TRow>[], getColumn: (name: string) => RuntimeColumn | undefined) {
	const rows = new Map<string, TRow>();

	for (const edit of edits) {
		const setValue = getColumn(edit.column)?.setValue;

		if (setValue) {
			rows.set(edit.key, setValue(rows.get(edit.key) ?? edit.row, edit.after) as TRow);
		}
	}

	return rows;
}

/** `rows` with each row that `replaced` has replaced by its new object; the same array when none is there. */
export function replaceRows<TRow>(rows: readonly TRow[], replaced: ReadonlyMap<TRow, TRow>): readonly TRow[] {
	let changed = false;

	const next = rows.map((row) => {
		const other = replaced.get(row);

		if (other === undefined) {
			return row;
		}

		changed = true;

		return other;
	});

	return changed ? next : rows;
}
