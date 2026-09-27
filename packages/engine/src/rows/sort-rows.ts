import {
	type AnyColumn,
	type ColumnsInput,
	type RuntimeColumn,
	toColumnList,
	toRuntimeColumn,
} from '../columns/column';
import type { TableSort } from '../columns/sort';
import { compareValues, isEmptyValue } from './compare';

export interface SortKey {
	column: RuntimeColumn;
	sign: 1 | -1;
}

/** The previous sort, from which the next one re-sorts only what changed. */
export interface SortFrame<TRow> {
	source: readonly TRow[];
	rows: readonly TRow[];
	keys: readonly SortKey[];
	/** Sort values by row; kept only for the incremental re-sort. */
	values: Map<TRow, readonly unknown[]> | null;
}

function resolveKeys(sort: readonly TableSort[], columns: readonly AnyColumn[]) {
	const byName = new Map(columns.map(column => [column.name, column]));
	const keys: SortKey[] = [];

	for (const item of sort) {
		const column = byName.get(item.name);

		if (column) {
			keys.push({ column: toRuntimeColumn(column), sign: item.direction === 'asc' ? 1 : -1 });
		}
	}

	return keys;
}

function isSameKeys(current: readonly SortKey[], next: readonly SortKey[]) {
	return current.length === next.length
		&& current.every((key, index) => key.column === next[index].column && key.sign === next[index].sign);
}

function readValues(keys: readonly SortKey[], row: unknown) {
	return keys.map(key => key.column.value(row));
}

function compareRowValues(keys: readonly SortKey[], first: readonly unknown[], second: readonly unknown[]) {
	for (let index = 0; index < keys.length; index += 1) {
		const a = first[index];
		const b = second[index];
		const aEmpty = isEmptyValue(a);
		const bEmpty = isEmptyValue(b);

		if (aEmpty || bEmpty) {
			if (aEmpty !== bEmpty) {
				return aEmpty ? 1 : -1;
			}

			continue;
		}

		const { column, sign } = keys[index];
		const result = column.compare ? column.compare(a, b) : compareValues(a, b);

		if (result !== 0 && !Number.isNaN(result)) {
			return sign * result;
		}
	}

	return 0;
}

function sortAll<TRow>(rows: readonly TRow[], keys: readonly SortKey[], delta: boolean) {
	const values = rows.map(row => readValues(keys, row));
	const order = rows.map((_row, index) => index);

	order.sort((first, second) => compareRowValues(keys, values[first], values[second]) || first - second);

	return {
		source: rows,
		rows: order.map(index => rows[index]),
		keys,
		values: delta ? new Map(rows.map((row, index) => [row, values[index]])) : null,
	};
}

// Old rows keep their order and new ones are sorted and merged in: O(n + k log k). The previous
// frame's value map is taken over and mutated, so that frame must not be used afterwards.
function sortChanged<TRow>(previous: SortFrame<TRow>, rows: readonly TRow[], values: Map<TRow, readonly unknown[]>) {
	const { keys } = previous;
	const added = rows.filter(row => !values.has(row));
	let kept = previous.rows;

	if (kept.length + added.length !== rows.length) {
		const present = new Set(rows);

		kept = kept.filter((row) => {
			if (present.has(row)) {
				return true;
			}

			values.delete(row);

			return false;
		});
	}

	if (added.length === 0) {
		return kept === previous.rows ? { ...previous, source: rows } : { source: rows, rows: kept, keys, values };
	}

	for (const row of added) {
		values.set(row, readValues(keys, row));
	}

	const read = (row: TRow) => values.get(row) ?? [];

	added.sort((first, second) => compareRowValues(keys, read(first), read(second)));

	const result: TRow[] = [];
	let left = 0;
	let right = 0;

	while (left < kept.length && right < added.length) {
		if (compareRowValues(keys, read(added[right]), read(kept[left])) < 0) {
			result.push(added[right]);
			right += 1;
		} else {
			result.push(kept[left]);
			left += 1;
		}
	}

	while (left < kept.length) {
		result.push(kept[left]);
		left += 1;
	}

	while (right < added.length) {
		result.push(added[right]);
		right += 1;
	}

	return { source: rows, rows: result, keys, values };
}

/**
 * Rows in `sort` order on top of the previous frame. Without sort columns returns `rows` as is; with
 * the same keys and `delta`, places again only the rows that arrived as new objects.
 */
export function resolveSortedRows<TRow>(
	previous: SortFrame<TRow> | null,
	rows: readonly TRow[],
	sort: readonly TableSort[],
	columns: readonly AnyColumn[],
	delta: boolean,
): SortFrame<TRow> {
	const keys = resolveKeys(sort, columns);
	const sameKeys = previous !== null && isSameKeys(previous.keys, keys);

	if (keys.length === 0) {
		return sameKeys && previous.source === rows ? previous : { source: rows, rows, keys, values: null };
	}

	if (sameKeys && previous.source === rows) {
		return previous;
	}

	if (delta && sameKeys && previous.values) {
		return sortChanged(previous, rows, previous.values);
	}

	return sortAll(rows, keys, delta);
}

/**
 * Rows in `sort` order: columns compare their `value` with their `compare` or `compareValues`, empty
 * values go last in either direction, and equal rows keep their order.
 */
export function sortRows<TRow>(
	rows: readonly TRow[],
	sort: readonly TableSort[],
	columns: ColumnsInput | readonly AnyColumn[],
) {
	return resolveSortedRows(null, rows, sort, toColumnList(columns), false).rows;
}
