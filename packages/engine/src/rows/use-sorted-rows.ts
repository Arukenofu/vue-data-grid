import { computed, type MaybeRefOrGetter, toValue } from 'vue';

import { type AnyColumn, type ColumnsInput, toColumnList } from '../columns/column';
import type { TableSort } from '../columns/sort';
import { stableComputed } from '../shared/stable-computed';
import { resolveSortedRows, type SortFrame } from './sort-rows';

export interface SortedRowsOptions<TRow> {
	rows: MaybeRefOrGetter<readonly TRow[]>;
	/** Usually `state.sort` or `scope.sort`. */
	sort: MaybeRefOrGetter<readonly TableSort[]>;
	columns: MaybeRefOrGetter<ColumnsInput | readonly AnyColumn[]>;
	/**
	 * Re-sort only rows that arrive as new objects. Correct only with immutable updates, where a changed
	 * row is a new object and an unchanged row is the same one; a row mutated in place is not noticed.
	 */
	delta?: MaybeRefOrGetter<boolean>;
}

/** Client-side sorting by the table's sort model; an unchanged order comes back as the same array. */
export function useSortedRows<TRow>(options: SortedRowsOptions<TRow>) {
	const frame = stableComputed<SortFrame<TRow>, null>(null, previous => resolveSortedRows(
		previous,
		toValue(options.rows),
		toValue(options.sort),
		toColumnList(toValue(options.columns)),
		toValue(options.delta) ?? false,
	));

	return computed(() => frame.value.rows);
}
