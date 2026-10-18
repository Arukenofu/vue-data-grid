import { type MaybeRefOrGetter, shallowReadonly, shallowRef, toValue } from 'vue';

import { applyRowChanges, type RowChange, type RowChangeOptions, type RowChangeResult } from './row-changes';
import type { ChildrenField } from './row-tree';

/**
 * Where changes of rows come from: adding, removing or moving rows by a control of yours, a drop of a
 * dragged row, a paste, undo, redo, or your own.
 */
export type RowEditSource = 'add' | 'remove' | 'move' | 'drop' | 'paste' | 'undo' | 'redo' | (string & {});

/** A commit: the changes it makes, where they come from, the changes that undo it, and the new rows. */
export interface RowCommit<TRow = unknown> {
	source: RowEditSource;
	/** The changes made, in order. */
	changes: readonly RowChange<TRow>[];
	/**
	 * The changes that undo the commit, in the order to apply them, each guarded so that it is skipped
	 * once its row changed again. Worked out on the first read where the commit did not need them.
	 */
	readonly undo: readonly RowChange<TRow>[];
	/** The rows after the commit. */
	rows: readonly TRow[];
	/**
	 * Your rows with the commit: `rows` for the array it was made from, and for another one, such as
	 * one a stream changed since, the changes applied to it.
	 */
	// A method, not a property: its parameter stays bivariant, so a commit of any rows fits `RowCommit`.
	apply(rows: readonly TRow[]): readonly TRow[];
}

/** The changes of a commit about to be written, for `onBeforeCommit`. */
export interface RowCommitRequest<TRow = unknown> {
	changes: readonly RowChange<TRow>[];
	source: RowEditSource;
}

/** What a write did. */
export interface RowWriteResult<TRow = unknown> {
	source: RowEditSource;
	/** The commit; `null` when nothing changed or `onBeforeCommit` refused it. */
	commit: RowCommit<TRow> | null;
	/** Changes left out: an unknown key, parent or neighbour, a failed `expected` or `from`, or a move into the row's own subtree. */
	skipped: readonly RowChange<TRow>[];
}

export interface RowEditingOptions<TRow = unknown> extends Omit<RowChangeOptions<TRow>, 'childrenField'> {
	/** The rows the changes apply to: the source rows you keep. */
	rows: MaybeRefOrGetter<readonly TRow[]>;
	/** The field holding an array of children, for a nested tree; read at every write. */
	childrenField?: MaybeRefOrGetter<ChildrenField<TRow> | undefined>;
	/**
	 * Writes a commit into your rows, such as `rows.value = commit.rows`, and saves it. The grid shows
	 * the new rows once your rows have them.
	 */
	onCommit: (commit: RowCommit<TRow>) => void;
	/**
	 * Called before every commit with the changes that apply and where they come from: return the
	 * changes to commit instead, such as with some left out or rows filled in, or `false` to commit
	 * none. Returned changes are applied as written ones are: one that does not apply is skipped.
	 */
	onBeforeCommit?: (request: RowCommitRequest<TRow>) => readonly RowChange<TRow>[] | false | void;
}

/**
 * Editing rows without markup, the twin of `useCellEditing` for rows: writes of changes, which add,
 * update, remove and move rows by key, as one commit. Rows stay yours and immutable: a commit gives
 * the new rows, through `applyRowChanges`, every row it did not touch the same object, and
 * `onCommit` writes them where you keep rows. `onBeforeCommit` sees the changes of every commit
 * first, with their source; the commit carries the changes that undo it.
 */
export function useRowEditing<TRow = unknown>(options: RowEditingOptions<TRow>) {
	const lastCommit = shallowRef<RowCommit<TRow> | null>(null);

	function getChangeOptions(): RowChangeOptions<TRow> {
		return {
			rowKey: options.rowKey,
			parentKey: options.parentKey,
			setParent: options.setParent,
			childrenField: toValue(options.childrenField),
		};
	}

	function createCommit(
		from: readonly TRow[],
		result: RowChangeResult<TRow>,
		source: RowEditSource,
		changeOptions: RowChangeOptions<TRow>,
	): RowCommit<TRow> {
		return {
			source,
			changes: result.applied,
			// Read through, not copied: a commit nothing undoes does not work out its undo.
			get undo() {
				return result.undo;
			},
			rows: result.rows,
			apply: list => (list === from ? result.rows : applyRowChanges(list, result.applied, changeOptions).rows),
		};
	}

	/**
	 * Writes changes of rows as one commit from `source`, in order, each on the rows the ones before it
	 * left. Changes that do not apply are skipped; a write that changes nothing commits nothing.
	 */
	function write(changes: readonly RowChange<TRow>[], source: RowEditSource): RowWriteResult<TRow> {
		const rows = toValue(options.rows);
		const changeOptions = getChangeOptions();
		const first = applyRowChanges(rows, changes, changeOptions);
		const decided = first.applied.length > 0 ? options.onBeforeCommit?.({ changes: first.applied, source }) : undefined;

		if (decided === false) {
			return { source, commit: null, skipped: first.skipped };
		}

		const result = decided ? applyRowChanges(rows, decided, changeOptions) : first;
		const skipped = decided ? [...first.skipped, ...result.skipped] : first.skipped;

		if (result.rows === rows) {
			return { source, commit: null, skipped };
		}

		const commit = createCommit(rows, result, source, changeOptions);

		options.onCommit(commit);
		lastCommit.value = commit;

		return { source, commit, skipped };
	}

	return {
		/** The last commit written; `null` before the first. */
		lastCommit: shallowReadonly(lastCommit),
		write,
	};
}

/** Row editing as `useRowEditing` gives it. */
export type RowEditing<TRow = unknown> = ReturnType<typeof useRowEditing<TRow>>;
