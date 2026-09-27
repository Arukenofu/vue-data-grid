import { shallowReadonly, shallowRef, watch } from 'vue';

import type { RuntimeColumn } from '../columns/column';
import type { TableScope } from '../engine/scope';
import { stableComputed } from '../shared/stable-computed';
import { useRowToken } from '../shared/use-row-token';
import { type CellAddress, type CellGrid, getCellColumns } from './cell-address';
import {
	applyCellEdits,
	canEditCell,
	type CellEdit,
	type CellEditSource,
	type CellTextWrite,
	type CellWrite,
	isSameCellValue,
	replaceRows,
	validateCell,
} from './cell-edit';

/** A commit: the cells it changes, where it comes from, and the rows with the new values. */
export interface CellCommit<TRow = unknown> {
	edits: readonly CellEdit<TRow>[];
	source: CellEditSource;
	/** The new object of each changed row, through the `setValue` of its columns, by row key. */
	rows: ReadonlyMap<string, TRow>;
	/**
	 * `rows` with each changed row replaced by its new object, such as the array you keep the rows in;
	 * the same array when none of the changed rows is in it.
	 */
	// A method, not a property: its parameter stays bivariant, so a commit of any rows fits `CellCommit`.
	apply(rows: readonly TRow[]): readonly TRow[];
}

/** A write refused by the column's `validate`, with what it said. */
export interface InvalidCellWrite {
	write: CellWrite;
	error: string;
}

/** What a write did. */
export interface CellWriteResult<TRow = unknown> {
	source: CellEditSource;
	/** The commit; `null` when nothing changed or `onBeforeCommit` refused it. */
	commit: CellCommit<TRow> | null;
	/** Writes left out: the cell cannot be edited, its row or column is gone, or it no longer holds `expected`. */
	skipped: readonly CellWrite[];
	/** Writes whose value `validate` refused. */
	invalid: readonly InvalidCellWrite[];
}

/** The edits of a commit about to be written, for `onBeforeCommit`. */
export interface CellCommitRequest<TRow = unknown> {
	edits: readonly CellEdit<TRow>[];
	source: CellEditSource;
}

/** What editing a cell starts with: its value by default. */
export interface CellEditStart {
	/** Text, such as the key typed on the cell, which the draft comes from through the column's `parse`. */
	text?: string;
	/** A value to start the draft with. */
	draft?: unknown;
}

/** The cell being edited. */
export interface EditingCell<TRow = unknown> extends CellAddress {
	/** The row's index in `rows`. */
	index: number;
	row: TRow;
	/** The value the cell holds. */
	value: unknown;
	/** The value being typed, which a commit writes. */
	draft: unknown;
	/**
	 * The text typed, when the draft comes from text: the key editing started with, then every input of
	 * a text editor, as it was typed. `undefined` while the draft is a value.
	 */
	text?: string;
	/** What `validate` says of the draft; `null` while it is right. */
	error: string | null;
}

export interface CellEditingOptions<TRow = unknown> {
	/**
	 * Writes a commit into your rows, such as `rows.value = commit.apply(rows.value)`, and saves it.
	 * The table shows the new values once its rows have them.
	 */
	onCommit: (commit: CellCommit<TRow>) => void;
	/**
	 * Called before every commit with its edits and where they come from: return the edits to commit
	 * instead, such as with values corrected or some left out, or `false` to commit none. Returned
	 * edits are checked as written ones are: an edit of a cell that cannot be edited is skipped.
	 */
	onBeforeCommit?: (request: CellCommitRequest<TRow>) => readonly CellEdit<TRow>[] | false | void;
	/**
	 * Called after every write with what it did, the cells it skipped and the values `validate`
	 * refused included, such as to tell the person that a paste left read-only cells alone.
	 */
	onWrite?: (result: CellWriteResult<TRow>) => void;
	/**
	 * What committing an invalid draft does: `'block'`, the default, keeps the cell in editing with its
	 * error; `'revert'` ends editing and keeps the old value.
	 */
	invalid?: 'block' | 'revert';
}

// Columns warned about: one warning says it all.
const warned = new Set<string>();

function warnOnce(column: RuntimeColumn, problem: string, message: string) {
	const id = `${problem}\u0000${column.name}`;

	if (!warned.has(id)) {
		warned.add(id);
		// oxlint-disable-next-line no-console
		console.warn(`[@vue-data-grid/core] ${message}`);
	}
}

function isTextValue(value: unknown) {
	return typeof value === 'string' || value === null || value === undefined;
}

interface EditTarget extends CellAddress {
	draft: unknown;
	text?: string;
}

function isSameEditingCell<TRow>(current: EditingCell<TRow> | null, next: EditingCell<TRow> | null) {
	return current === next || (current !== null && next !== null
		&& current.key === next.key
		&& current.column === next.column
		&& current.index === next.index
		&& current.row === next.row
		&& Object.is(current.value, next.value)
		&& Object.is(current.draft, next.draft)
		&& current.text === next.text
		&& current.error === next.error);
}

function getCellId(cell: CellAddress) {
	return `${cell.key}\u0000${cell.column}`;
}

/** The writes with one write for each cell: the last one of a cell wins, in the place of its first. */
function toSingleWrites(writes: readonly CellWrite[]) {
	if (writes.length < 2) {
		return writes;
	}

	const byCell = new Map<string, CellWrite>();

	for (const write of writes) {
		byCell.set(getCellId(write), write);
	}

	return byCell.size === writes.length ? writes : [...byCell.values()];
}

/**
 * Editing cells without markup: which cell is edited and its draft, what a column lets edit, and
 * writes of values into rows, one at a time from an editor or many at once from a paste, a fill or
 * undo. Rows stay yours and immutable: a commit gives the changed rows as new objects, through the
 * `setValue` of their columns, and `onCommit` writes them where you keep rows.
 *
 * A cell is edited when its column is `editable` for its row and has `setValue`. Every write is
 * validated by the column's `validate`; `onBeforeCommit` sees the edits of every commit first, with
 * their source, and `onWrite` what every write did. A cell written twice in one write takes the last
 * value. Cells are addressed by row key and column name, so edits follow their rows through sorting
 * and streaming. `isEditing` and `getEditingColumn` are reactive per row.
 */
export function useCellEditing<TRow = unknown>(scope: TableScope<TRow>, options: CellEditingOptions<TRow>) {
	const target = shallowRef<EditTarget | null>(null);
	const lastCommit = shallowRef<CellCommit<TRow> | null>(null);
	const editingRows = useRowToken(() => (target.value ? { row: target.value.key, token: target.value.column } : null));

	function getColumn(name: string): RuntimeColumn | undefined {
		const column = scope.getColumn(name)?.column ?? undefined;

		if (__DEV__ && column?.editable && !column.setValue) {
			warnOnce(column, 'setValue', `Column "${column.name}" is \`editable\` but has no \`setValue\`, so its cells cannot be edited.`);
		}

		return column;
	}

	function findRow(key: string) {
		const index = scope.getRowIndex(key);

		return index === -1 ? undefined : { index, row: scope.rows.value[index] };
	}

	/** Whether the cell can be edited: its column is shown, `editable` for the row and has `setValue`. */
	function canEdit(cell: CellAddress) {
		const found = findRow(cell.key);
		const column = getColumn(cell.column);

		return found !== undefined && column !== undefined && canEditCell(column, found.row);
	}

	/**
	 * The cell being edited, with its draft and error; `null` while none is, or once its row or column
	 * is gone. The same object while none of its fields change.
	 */
	const cell = stableComputed<EditingCell<TRow> | null>(null, (previous) => {
		const current = target.value;
		const found = current && findRow(current.key);
		const column = current && getColumn(current.column);

		if (!current || !found || !column) {
			return null;
		}

		const next: EditingCell<TRow> = {
			key: current.key,
			column: current.column,
			index: found.index,
			row: found.row,
			value: column.value(found.row),
			draft: current.draft,
			text: current.text,
			error: validateCell(column, current.draft, found.row),
		};

		return isSameEditingCell(previous, next) ? previous : next;
	});

	function close() {
		target.value = null;
	}

	watch(cell, (next) => {
		if (!next) {
			close();
		}
	}, { flush: 'sync' });

	/** Looks columns up once for each name within one write. */
	function createColumnLookup() {
		const found = new Map<string, RuntimeColumn | undefined>();

		return (name: string) => {
			if (!found.has(name)) {
				found.set(name, getColumn(name));
			}

			return found.get(name);
		};
	}

	/**
	 * The edit a write makes in its cell: `null` when the cell cannot take it, and `undefined` when it
	 * already holds the value.
	 */
	function toEdit(item: CellWrite, column: RuntimeColumn | undefined): CellEdit<TRow> | null | undefined {
		const found = findRow(item.key);

		if (!found || !column || !canEditCell(column, found.row)) {
			return null;
		}

		const before = column.value(found.row);

		if ('expected' in item && !isSameCellValue(column, before, item.expected)) {
			return null;
		}

		return isSameCellValue(column, before, item.value)
			? undefined
			: { key: item.key, column: item.column, row: found.row, before, after: item.value };
	}

	/** The edits the writes make in their cells as they are now, with the writes they refuse in `skipped`. */
	function toEdits(writes: readonly CellWrite[], lookup: (name: string) => RuntimeColumn | undefined, skipped: CellWrite[]) {
		const edits: CellEdit<TRow>[] = [];

		for (const item of writes) {
			const edit = toEdit(item, lookup(item.column));

			if (edit === null) {
				skipped.push(item);
			} else if (edit) {
				edits.push(edit);
			}
		}

		return edits;
	}

	/** The edits with `after` as the new rows hold it, without the ones that changed nothing there. */
	function settleEdits(edits: readonly CellEdit<TRow>[], rows: ReadonlyMap<string, TRow>, lookup: (name: string) => RuntimeColumn | undefined) {
		const settled: CellEdit<TRow>[] = [];

		for (const edit of edits) {
			const column = lookup(edit.column);
			const row = rows.get(edit.key);

			if (column && row !== undefined) {
				const after = column.value(row);

				if (!isSameCellValue(column, edit.before, after)) {
					settled.push({ ...edit, after });
				}
			}
		}

		return settled;
	}

	function createCommit(edits: readonly CellEdit<TRow>[], rows: ReadonlyMap<string, TRow>, source: CellEditSource): CellCommit<TRow> {
		const kept = new Map<string, TRow>();
		const replaced = new Map<TRow, TRow>();

		for (const edit of edits) {
			const row = rows.get(edit.key);

			if (row !== undefined) {
				kept.set(edit.key, row);
				replaced.set(edit.row, row);
			}
		}

		return { edits, source, rows: kept, apply: list => replaceRows(list, replaced) };
	}

	function report(result: CellWriteResult<TRow>) {
		options.onWrite?.(result);

		return result;
	}

	/**
	 * Writes values into cells as one commit from `source`. Cells that cannot be edited, or no longer
	 * hold `expected`, are skipped; values `validate` refuses are left out; values the cells already
	 * hold change nothing.
	 */
	function write(writes: readonly CellWrite[], source: CellEditSource): CellWriteResult<TRow> {
		const lookup = createColumnLookup();
		const skipped: CellWrite[] = [];
		const invalid: InvalidCellWrite[] = [];
		const edits = toEdits(toSingleWrites(writes), lookup, skipped);
		const decided = edits.length > 0 ? options.onBeforeCommit?.({ edits, source }) : undefined;

		if (decided === false) {
			return report({ source, commit: null, skipped, invalid });
		}

		const checked = decided
			? toEdits(decided.map(edit => ({ key: edit.key, column: edit.column, value: edit.after })), lookup, skipped)
			: edits;
		const valid = checked.filter((edit) => {
			const column = lookup(edit.column);
			const error = column ? validateCell(column, edit.after, edit.row) : null;

			if (error !== null) {
				invalid.push({ write: { key: edit.key, column: edit.column, value: edit.after }, error });
			}

			return error === null;
		});
		const rows = applyCellEdits(valid, lookup);
		const settled = settleEdits(valid, rows, lookup);

		if (settled.length === 0) {
			return report({ source, commit: null, skipped, invalid });
		}

		const commit = createCommit(settled, rows, source);

		options.onCommit(commit);
		lastCommit.value = commit;

		return report({ source, commit, skipped, invalid });
	}

	function parseText(column: RuntimeColumn, text: string, row: TRow) {
		if (column.parse) {
			return column.parse(text, row);
		}

		if (__DEV__ && !isTextValue(column.value(row))) {
			warnOnce(
				column,
				'parse',
				`Column "${column.name}" has no \`parse\`, so text written into it, such as a paste or a cleared `
				+ 'cell, is stored as text while its values are not. Give the column a `parse`.',
			);
		}

		return text;
	}

	/** Writes text into cells, each through its column's `parse`, as `write` does values. */
	function writeText(cells: readonly CellTextWrite[], source: CellEditSource) {
		const lookup = createColumnLookup();

		return write(cells.map((item) => {
			const column = lookup(item.column);
			const found = findRow(item.key);

			return {
				key: item.key,
				column: item.column,
				value: column && found ? parseText(column, item.text, found.row) : item.text,
			};
		}), source);
	}

	/**
	 * Commits the draft of the cell being edited and ends editing. With an invalid draft, `false`: the
	 * cell stays in editing under `invalid: 'block'`, or editing ends without a write under `'revert'`.
	 */
	function commit() {
		const current = cell.value;

		if (!current) {
			close();

			return true;
		}

		if (current.error !== null) {
			if (options.invalid === 'revert') {
				close();
			}

			return false;
		}

		close();
		write([{ key: current.key, column: current.column, value: current.draft }], 'edit');

		return true;
	}

	function getStartDraft(column: RuntimeColumn, row: TRow, init: CellEditStart) {
		if ('draft' in init) {
			return init.draft;
		}

		return init.text === undefined ? column.value(row) : parseText(column, init.text, row);
	}

	/**
	 * Starts editing a cell with its value as the draft, or with `text`, such as the key typed on the
	 * cell, through the column's `parse`, or with a `draft` value. A cell being edited is committed
	 * first, and the new one starts from its row as the commit leaves it. `false` when the cell cannot
	 * be edited, or the one being edited stays in editing with an invalid draft; under
	 * `invalid: 'revert'` that one ends and the new one starts.
	 */
	function start(address: CellAddress, init: CellEditStart = {}) {
		if (!canEdit(address) || (!commit() && target.value !== null)) {
			return false;
		}

		const found = findRow(address.key);
		const column = getColumn(address.column);

		if (!found || !column || !canEditCell(column, found.row)) {
			return false;
		}

		target.value = {
			key: address.key,
			column: address.column,
			draft: getStartDraft(column, found.row, init),
			text: init.text,
		};

		return true;
	}

	/** Sets the draft of the cell being edited to a value, such as a choice of a list. */
	function setDraft(value: unknown) {
		if (target.value) {
			target.value = { ...target.value, draft: value, text: undefined };
		}
	}

	/**
	 * Sets the draft of the cell being edited from text, through the column's `parse` or as `draft`
	 * when given, and keeps the text as typed: what a text editor shows, even where the draft reads it
	 * otherwise, such as `1.` of a number.
	 */
	function setText(text: string, draft?: unknown) {
		const current = target.value;
		const column = current && getColumn(current.column);
		const found = current && findRow(current.key);

		if (!current || !column || !found) {
			return;
		}

		target.value = { ...current, text, draft: draft === undefined ? parseText(column, text, found.row) : draft };
	}

	/**
	 * The next cell after `from` that can be edited, or the previous one with `step` `-1`, going along
	 * the rows as Tab does: on to the next row at the end of one. It looks through the rest of this row
	 * and the whole next one; `null` without one there. `grid` holds the rows and columns it goes
	 * through, the rows and the shown data columns by default.
	 */
	function findEditable(from: CellAddress, step: 1 | -1, grid: CellGrid = getDefaultGrid()): CellAddress | null {
		const count = grid.columns.length;
		const row = grid.keys.indexOf(from.key);
		const column = grid.columns.indexOf(from.column);
		const last = grid.keys.length * count - 1;

		if (row === -1 || column === -1) {
			return null;
		}

		for (let index = row * count + column + step, seen = 0; index >= 0 && index <= last && seen < count * 2; index += step, seen += 1) {
			const next = { key: grid.keys[Math.floor(index / count)], column: grid.columns[index % count] };

			if (canEdit(next)) {
				return next;
			}
		}

		return null;
	}

	function getDefaultGrid(): CellGrid {
		return { keys: scope.rowKeys.value, columns: getCellColumns(scope.columns.value).map(column => column.name) };
	}

	return {
		/** The cell being edited, with its draft and error; `null` while none is. */
		cell,
		/** The last commit, for what builds on commits, such as `useChangeHistory`. */
		lastCommit: shallowReadonly(lastCommit),
		canEdit,
		/** Whether this cell is being edited. Reactive per row, like `getEditingColumn`. */
		isEditing: (address: CellAddress) => editingRows.get(address.key) === address.column,
		/** The column being edited in the row with this key, `undefined` in other rows: a memo token of the row. */
		getEditingColumn: (key: string) => editingRows.get(key),
		start,
		setDraft,
		setText,
		commit,
		/** Ends editing without writing the draft. */
		cancel: close,
		write,
		writeText,
		findEditable,
	};
}

/** Cell editing as `useCellEditing` gives it. */
export type CellEditing<TRow = unknown> = ReturnType<typeof useCellEditing<TRow>>;
