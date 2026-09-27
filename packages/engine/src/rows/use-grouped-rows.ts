import { computed, type MaybeRefOrGetter, toValue } from 'vue';

import { type AnyColumn, type ColumnAggregates, toColumnList } from '../columns/column';
import { stableComputed } from '../shared/stable-computed';
import {
	buildRowGroups,
	type GroupColumns,
	type RowGroup,
	type RowGroupCache,
	type RowGroupLevel,
} from './row-groups';

export interface GroupedRowsOptions<TRow, TColumns extends GroupColumns = GroupColumns> {
	rows: MaybeRefOrGetter<readonly TRow[]>;
	/** Grouping levels, from the top; an empty list returns the rows unchanged. */
	by: MaybeRefOrGetter<readonly RowGroupLevel<TRow>[]>;
	/** Columns whose `aggregate` is computed for every group; they type `group.aggregates`. */
	columns?: MaybeRefOrGetter<TColumns | undefined>;
	createGroup: (group: RowGroup<TRow, ColumnAggregates<TColumns>>) => TRow;
}

interface GroupedFrame<TRow, TColumns extends GroupColumns> {
	rows: readonly TRow[];
	cache: RowGroupCache<TRow>;
	by: readonly RowGroupLevel<TRow>[];
	columns: readonly AnyColumn[];
	createGroup: (group: RowGroup<TRow, ColumnAggregates<TColumns>>) => TRow;
}

function isSameList<TItem>(current: readonly TItem[], next: readonly TItem[]) {
	return current.length === next.length && current.every((item, index) => item === next[index]);
}

/**
 * Grouping by value with aggregates, as a tree for `useRowTree`. A group under which no leaf changed
 * comes back as the same row, and an unchanged top level as the same array. Keep `createGroup` the
 * same function, or group rows are rebuilt every time.
 */
export function useGroupedRows<TRow, TColumns extends GroupColumns = GroupColumns>(
	options: GroupedRowsOptions<TRow, TColumns>,
) {
	const frame = stableComputed<GroupedFrame<TRow, TColumns>, null>(null, (previous) => {
		const rows = toValue(options.rows);
		const by = toValue(options.by);
		const given = toValue(options.columns);
		const columns = given ? toColumnList(given) : [];
		const { createGroup } = options;

		if (by.length === 0) {
			return { rows, cache: new Map(), by, columns, createGroup };
		}

		const reuse = previous !== null
			&& previous.createGroup === createGroup
			&& isSameList(previous.by, by)
			&& isSameList(previous.columns, columns);

		// The columns went through `toColumnList`: the same columns as a list, whose aggregates the type read.
		const build = createGroup as (group: RowGroup<TRow>) => TRow;
		const result = buildRowGroups(rows, { by, columns, createGroup: build }, reuse ? previous.cache : undefined);
		const same = reuse && isSameList(previous.rows, result.rows);

		return { rows: same ? previous.rows : result.rows, cache: result.cache, by, columns, createGroup };
	});

	return computed(() => frame.value.rows);
}
