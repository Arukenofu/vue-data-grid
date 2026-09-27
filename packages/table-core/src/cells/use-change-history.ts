import { computed, type MaybeRefOrGetter, shallowRef, toValue, watch } from 'vue';

import type { CellAddress } from './cell-address';
import type { CellEditSource } from './cell-edit';
import type { CellEditing, CellWriteResult } from './use-cell-editing';

export interface ChangeHistoryOptions {
	/** How many steps undo keeps; `100` by default, `0` keeps none. */
	limit?: MaybeRefOrGetter<number>;
}

/** A cell a step changed: its value before and after. */
export interface ChangeStepEdit extends CellAddress {
	before: unknown;
	after: unknown;
}

/** One step of the history: the cells one commit changed, and where the commit came from. */
export interface ChangeStep {
	source: CellEditSource;
	edits: readonly ChangeStepEdit[];
}

const DEFAULT_LIMIT = 100;

/**
 * Undo and redo of cell edits: every commit of `editing` is one step, a whole paste or fill included.
 * Undo writes back the values a step replaced, and redo the values it wrote, through `editing.write`
 * with the sources `'undo'` and `'redo'`, which are not steps themselves. A step keeps the values, not
 * the rows.
 *
 * Steps are by row key and column, so they survive sorting and streaming. A write goes only to a cell
 * that still holds what the step left there: a cell changed since, such as by a stream, the server or
 * another edit, and a row that is gone, are skipped and listed in the result's `skipped`, rather than
 * overwritten with an old value.
 */
export function useChangeHistory<TRow = unknown>(
	editing: Pick<CellEditing<TRow>, 'lastCommit' | 'write'>,
	options: ChangeHistoryOptions = {},
) {
	const done = shallowRef<readonly ChangeStep[]>([]);
	const undone = shallowRef<readonly ChangeStep[]>([]);

	function getLimit() {
		return Math.max(toValue(options.limit) ?? DEFAULT_LIMIT, 0);
	}

	watch(editing.lastCommit, (commit) => {
		if (!commit || commit.source === 'undo' || commit.source === 'redo') {
			return;
		}

		const step: ChangeStep = {
			source: commit.source,
			edits: commit.edits.map(edit => ({ key: edit.key, column: edit.column, before: edit.before, after: edit.after })),
		};
		const limit = getLimit();

		done.value = limit === 0 ? [] : [...done.value, step].slice(-limit);
		undone.value = [];
	}, { flush: 'sync' });

	function replay(step: ChangeStep, source: 'undo' | 'redo'): CellWriteResult<TRow> {
		const back = source === 'undo';

		return editing.write(step.edits.map(edit => ({
			key: edit.key,
			column: edit.column,
			value: back ? edit.before : edit.after,
			expected: back ? edit.after : edit.before,
		})), source);
	}

	/** Undoes the last step; `null` with nothing to undo. */
	function undo() {
		const step = done.value.at(-1);

		if (!step) {
			return null;
		}

		done.value = done.value.slice(0, -1);
		undone.value = [...undone.value, step];

		return replay(step, 'undo');
	}

	/** Redoes the last undone step; `null` with nothing to redo. */
	function redo() {
		const step = undone.value.at(-1);

		if (!step) {
			return null;
		}

		undone.value = undone.value.slice(0, -1);
		done.value = [...done.value, step];

		return replay(step, 'redo');
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
		steps: computed(() => done.value),
		undo,
		redo,
		clear,
	};
}

/** Undo and redo as `useChangeHistory` gives them. */
export type ChangeHistory<TRow = unknown> = ReturnType<typeof useChangeHistory<TRow>>;
