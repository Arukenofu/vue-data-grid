import { type MaybeRefOrGetter, onScopeDispose, shallowReactive, toValue, watch } from 'vue';

import { type RuntimeColumn, toRuntimeColumn } from '../columns/column';
import type { GridScope } from '../engine/scope';
import { compareValues, isEmptyValue } from '../rows/compare';
import { getCellColumns } from './cell-address';

export type CellChangeDirection = 'up' | 'down';

export interface CellChange {
	/** By the column's `compare` or `compareValues`; `null` when the old or the new value is empty. */
	direction: CellChangeDirection | null;
	/** When the change arrived, from `Date.now()`: a key that restarts an animation on the next change. */
	at: number;
}

export interface CellChangesOptions {
	/** How long a change is kept, ms; `1000` by default. */
	duration?: MaybeRefOrGetter<number>;
	/** Names of the columns to watch; every shown data column by default, without service ones. */
	columns?: MaybeRefOrGetter<readonly string[] | undefined>;
}

const DEFAULT_DURATION = 1000;

function getDirection(column: RuntimeColumn, before: unknown, after: unknown): CellChangeDirection | null {
	if (isEmptyValue(before) || isEmptyValue(after)) {
		return null;
	}

	const result = column.compare ? column.compare(after, before) : compareValues(after, before);

	if (result > 0) {
		return 'up';
	}

	return result < 0 ? 'down' : null;
}

/**
 * Recent changes of cell values, for flashing a cell or showing where a price went. A row that comes
 * as a new object under a known key is compared with the previous one column by column, through the
 * column's `equals`; a row that stays the same object costs nothing, so this pairs with `useRowStream`
 * and immutable updates. New rows are not changes. Rendering the change is up to the markup.
 */
export function useCellChanges(scope: GridScope, options: CellChangesOptions = {}) {
	const changes = shallowReactive(new Map<string, Readonly<Record<string, CellChange>>>());

	let seen = new Map<string, unknown>();
	let timer: ReturnType<typeof setTimeout> | null = null;

	function getDuration() {
		return toValue(options.duration) ?? DEFAULT_DURATION;
	}

	function getColumns() {
		const names = toValue(options.columns);

		if (!names) {
			return getCellColumns(scope.columns.value);
		}

		const wanted = new Set(names);

		return scope.orderedColumns.value.filter(column => wanted.has(column.name)).map(toRuntimeColumn);
	}

	function expire() {
		timer = null;

		const now = Date.now();
		const duration = getDuration();
		let next = Number.POSITIVE_INFINITY;

		for (const [key, entry] of changes) {
			const kept: Record<string, CellChange> = {};
			let removed = false;
			let left = 0;

			for (const [name, change] of Object.entries(entry)) {
				if (now - change.at >= duration) {
					removed = true;
				} else {
					kept[name] = change;
					left += 1;
					next = Math.min(next, change.at + duration);
				}
			}

			if (removed && left > 0) {
				changes.set(key, Object.freeze(kept));
			} else if (removed) {
				changes.delete(key);
			}
		}

		if (next !== Number.POSITIVE_INFINITY) {
			timer = setTimeout(expire, next - now);
		}
	}

	function record(rows: readonly unknown[]) {
		const keys = scope.rowKeys.value;
		const columns = getColumns();
		const now = Date.now();
		let changed = false;

		rows.forEach((row, index) => {
			const key = keys[index];
			const previous = seen.get(key);

			if (previous === row) {
				return;
			}

			seen.set(key, row);

			if (previous === undefined) {
				return;
			}

			let entry: Record<string, CellChange> | null = null;

			for (const column of columns) {
				const before = column.value(previous);
				const after = column.value(row);

				if (column.equals ? column.equals(before, after) : Object.is(before, after)) {
					continue;
				}

				entry ??= { ...changes.get(key) };
				entry[column.name] = { direction: getDirection(column, before, after), at: now };
			}

			if (entry) {
				changes.set(key, Object.freeze(entry));
				changed = true;
			}
		});

		// Rows were removed: forget them, or their keys would pile up under a stream of new ones.
		if (seen.size > rows.length) {
			seen = new Map(keys.map((key, index) => [key, rows[index]]));
		}

		if (changed && timer === null) {
			timer = setTimeout(expire, getDuration());
		}
	}

	watch(scope.rows, record, { immediate: true });

	function clear() {
		changes.clear();

		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	onScopeDispose(() => {
		if (timer !== null) {
			clearTimeout(timer);
		}
	});

	return {
		/**
		 * The row's changes by column name: one frozen object while they hold, so it serves as a memo
		 * token of the row. `undefined` without changes. Reactive per row: a change elsewhere does not
		 * wake a reader of this row.
		 */
		getChanges: (key: string) => changes.get(key),
		getChange: (key: string, column: string) => changes.get(key)?.[column],
		/** Forgets every change at once, such as after switching to another data set. */
		clear,
	};
}
