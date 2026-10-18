import { computed, type MaybeRefOrGetter, type Ref, shallowRef, toValue, watch } from 'vue';

import type { RowChange, RowCommit, RowEditSource, RowWriteOptions, RowWriteResult } from '../rows';
import type { CellAddress } from './cell-address';
import type { CellEditSource } from './cell-edit';
import type { CellEditing, CellWriteResult } from './use-cell-editing';

/** The cell editing a history records: `useCellEditing`, or the `editing` of a grid. */
export type HistoryCellEditing<TRow = unknown> = Pick<CellEditing<TRow>, 'lastCommit' | 'write'>;

/**
 * The row editing a history records: `useRowEditing`, or the `rowEditing` of a grid. A method, not a
 * property: its parameters stay bivariant, so the row editing of any rows fits.
 */
export interface HistoryRowEditing<TRow = unknown> {
	lastCommit: Readonly<Ref<RowCommit<TRow> | null>>;
	write(changes: readonly RowChange<TRow>[], source: RowEditSource, options?: RowWriteOptions): RowWriteResult<TRow>;
}

export interface ChangeHistoryOptions<TRow = unknown> {
	/** The cell editing whose commits are steps; several for grids that share one history. */
	cells?: HistoryCellEditing<TRow> | readonly HistoryCellEditing<TRow>[];
	/**
	 * The row editing whose commits are steps; several for grids that rows move between, whose linked
	 * commits, such as of one drop, are one step.
	 */
	rows?: HistoryRowEditing<TRow> | readonly HistoryRowEditing<TRow>[];
	/** How many steps undo keeps; `100` by default, `0` keeps none. */
	limit?: MaybeRefOrGetter<number>;
}

/** A cell a step changed: its value before and after. */
export interface ChangeStepEdit extends CellAddress {
	before: unknown;
	after: unknown;
}

/** A step of cell edits: the cells one commit changed, and where the commit came from. */
export interface CellChangeStep {
	kind: 'cells';
	source: CellEditSource;
	edits: readonly ChangeStepEdit[];
}

/** A step of row changes: what one commit, or linked commits of several grids, changed. */
export interface RowChangeStep {
	kind: 'rows';
	source: RowEditSource;
	/** The changes made, in the order of their commits. */
	changes: readonly RowChange<unknown>[];
}

/**
 * One step of the history. Steps, like replays, are of any rows: a history may span grids, and a
 * feature of a grid cannot always say the type of its rows.
 */
export type ChangeStep = CellChangeStep | RowChangeStep;

/** What undo or redo of a step did: the write of its cells, or the writes of its rows, one per grid. */
export type ChangeReplay =
	| { kind: 'cells'; step: CellChangeStep; result: CellWriteResult }
	| { kind: 'rows'; step: RowChangeStep; results: readonly RowWriteResult[] };

/** A commit of rows in a step: its editing, and the changes the next undo or redo writes there. */
interface RowPart<TRow> {
	editing: HistoryRowEditing<TRow>;
	commit: RowCommit<TRow>;
	next: readonly RowChange<TRow>[];
}

type Entry<TRow> = { step: CellChangeStep; cells: HistoryCellEditing<TRow> } | { step: RowChangeStep; parts: RowPart<TRow>[] };

const DEFAULT_LIMIT = 100;

function toList<TItem>(items: TItem | readonly TItem[] | undefined): readonly TItem[] {
	if (items === undefined) {
		return [];
	}

	return isList(items) ? items : [items];
}

function isList<TItem>(items: TItem | readonly TItem[]): items is readonly TItem[] {
	return Array.isArray(items);
}

function isReplay(source: string) {
	return source === 'undo' || source === 'redo';
}

/**
 * Undo and redo of cell edits and row changes, in one stack: every commit of `cells` or `rows` is one
 * step, a whole paste, fill or drop included, and linked commits of rows, such as of a row dropped on
 * another grid, are one step with the commits they link to. Undo writes back what a step replaced, and
 * redo what it wrote, through `write` with the sources `'undo'` and `'redo'`, which are not steps
 * themselves.
 *
 * Steps are by row key, so they survive sorting and streaming. A write goes only where the rows still
 * hold what the step left: a cell or row changed since, such as by a stream, the server or another
 * edit, and a row that is gone, are skipped and listed in the results, rather than overwritten.
 */
export function useChangeHistory<TRow = unknown>(options: ChangeHistoryOptions<TRow>) {
	const done = shallowRef<readonly Entry<TRow>[]>([]);
	const undone = shallowRef<readonly Entry<TRow>[]>([]);

	if (toList(options.cells).length === 0 && toList(options.rows).length === 0) {
		throw new Error('[@vue-data-grid/engine] useChangeHistory() needs `cells`, `rows` or both: the editing whose commits are steps.');
	}

	function getLimit() {
		return Math.max(toValue(options.limit) ?? DEFAULT_LIMIT, 0);
	}

	function push(entry: Entry<TRow>) {
		const limit = getLimit();

		done.value = limit === 0 ? [] : [...done.value, entry].slice(-limit);
		undone.value = [];
	}

	function recordCells(cells: HistoryCellEditing<TRow>) {
		watch(cells.lastCommit, (commit) => {
			if (commit && !isReplay(commit.source)) {
				push({
					cells,
					step: {
						kind: 'cells',
						source: commit.source,
						edits: commit.edits.map(edit => ({ key: edit.key, column: edit.column, before: edit.before, after: edit.after })),
					},
				});
			}
		}, { flush: 'sync' });
	}

	toList(options.cells).forEach(recordCells);

	/** Adds a commit to the last step when it links to a commit of it; `false` otherwise. */
	function joinLast(editing: HistoryRowEditing<TRow>, commit: RowCommit<TRow>) {
		const last = done.value.at(-1);

		if (!last || !('parts' in last) || commit.link === null || !last.parts.some(part => part.commit === commit.link)) {
			return false;
		}

		const joined: Entry<TRow> = {
			step: { ...last.step, changes: [...last.step.changes, ...commit.changes] },
			parts: [...last.parts, { editing, commit, next: commit.undo }],
		};

		done.value = [...done.value.slice(0, -1), joined];

		return true;
	}

	function recordRows(editing: HistoryRowEditing<TRow>) {
		watch(editing.lastCommit, (commit) => {
			if (!commit || isReplay(commit.source) || joinLast(editing, commit)) {
				return;
			}

			push({
				step: { kind: 'rows', source: commit.source, changes: commit.changes },
				parts: [{ editing, commit, next: commit.undo }],
			});
		}, { flush: 'sync' });
	}

	toList(options.rows).forEach(recordRows);

	function replayCells(editing: HistoryCellEditing<TRow>, step: CellChangeStep, source: 'undo' | 'redo'): CellWriteResult<TRow> {
		const back = source === 'undo';

		return editing.write(step.edits.map(edit => ({
			key: edit.key,
			column: edit.column,
			value: back ? edit.before : edit.after,
			expected: back ? edit.after : edit.before,
		})), source);
	}

	/**
	 * Writes the next changes of each part, the last grid first for undo, and keeps the changes that
	 * take the write back for the replay after it.
	 */
	function replayRows(parts: readonly RowPart<TRow>[], source: 'undo' | 'redo') {
		const ordered = source === 'undo' ? [...parts].reverse() : parts;

		return ordered.map((part) => {
			const result = part.editing.write(part.next, source);

			part.next = result.commit?.undo ?? [];

			return result;
		});
	}

	function replay(entry: Entry<TRow>, source: 'undo' | 'redo'): ChangeReplay {
		if ('parts' in entry) {
			return { kind: 'rows', step: entry.step, results: replayRows(entry.parts, source) };
		}

		return { kind: 'cells', step: entry.step, result: replayCells(entry.cells, entry.step, source) };
	}

	/** Undoes the last step; `null` with nothing to undo. */
	function undo() {
		const entry = done.value.at(-1);

		if (!entry) {
			return null;
		}

		done.value = done.value.slice(0, -1);
		undone.value = [...undone.value, entry];

		return replay(entry, 'undo');
	}

	/** Redoes the last undone step; `null` with nothing to redo. */
	function redo() {
		const entry = undone.value.at(-1);

		if (!entry) {
			return null;
		}

		undone.value = undone.value.slice(0, -1);
		done.value = [...done.value, entry];

		return replay(entry, 'redo');
	}

	/** Forgets every step, such as after loading another data set. */
	function clear() {
		done.value = [];
		undone.value = [];
	}

	return {
		canUndo: computed(() => done.value.length > 0),
		canRedo: computed(() => undone.value.length > 0),
		/** The steps undo goes through, the last one last. */
		steps: computed((): readonly ChangeStep[] => done.value.map(entry => entry.step)),
		undo,
		redo,
		clear,
	};
}

/** Undo and redo as `useChangeHistory` gives them. */
export type ChangeHistory<TRow = unknown> = ReturnType<typeof useChangeHistory<TRow>>;
