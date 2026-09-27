import { type AnyColumn, type ColumnAggregates, type ColumnsInput, toColumnList } from '../columns/column';
import { type AggregateParts, finishAggregates, mergeAggregateParts, readAggregateParts } from './aggregate';

/** A grouping level; a column from `defineColumns` fits as is. */
export interface RowGroupLevel<TRow> {
	name: string;
	value: (row: TRow) => unknown;
}

/** Columns that aggregate for groups: an object from `defineColumns`, typing the aggregates, or an array. */
export type GroupColumns = ColumnsInput | readonly AnyColumn[];

/**
 * A group, passed to `createGroup` to build its row. `TAggregates` types `aggregates`; with columns
 * from `defineColumns` it is `ColumnAggregates` of them.
 */
export interface RowGroup<TRow, TAggregates = Readonly<Record<string, unknown>>> {
	/** The path from the root, unique in the tree and never equal to a leaf key. */
	key: string;
	level: number;
	/** The level's `name` from `by`. */
	name: string;
	value: unknown;
	/** Every leaf under the group, on all levels. */
	rows: readonly TRow[];
	/** The ready children: rows of subgroups, or leaves. */
	children: readonly TRow[];
	/**
	 * Aggregates of `columns` over the group's leaves, by column name: `number | null` for `sum` and
	 * `avg`, the value or `null` for `min` and `max`, a number for `count`, what a function returns.
	 */
	aggregates: TAggregates;
}

export interface GroupRowsOptions<TRow, TColumns extends GroupColumns = GroupColumns> {
	/** Grouping levels, from the top. */
	by: readonly RowGroupLevel<TRow>[];
	/** Columns whose `aggregate` is computed for every group; they type `group.aggregates`. */
	columns?: TColumns;
	/**
	 * Builds the group row, of the same type as the leaves: `group.key` in the key field,
	 * `group.children` in the children field for `useRowTree`, aggregates in the value fields. Columns
	 * then read a group row with the same `value` as a leaf.
	 */
	createGroup: (group: RowGroup<TRow, ColumnAggregates<TColumns>>) => TRow;
}

/** A group row from the previous pass, returned again when nothing under the group changed. */
export interface GroupCacheEntry<TRow> {
	value: unknown;
	children: readonly TRow[];
	row: TRow;
	/** The group's built-in aggregates in a form its parent merges without reading the leaves. */
	parts: AggregateParts;
}

export type RowGroupCache<TRow> = ReadonlyMap<string, GroupCacheEntry<TRow>>;

function toGroupValue(value: unknown) {
	return value instanceof Date ? value.getTime() : value;
}

function isSameList<TItem>(current: readonly TItem[], next: readonly TItem[]) {
	return current.length === next.length && current.every((item, index) => item === next[index]);
}

/**
 * Rows arranged into a tree of groups by the values of `by`. Groups come in the order their values
 * first appear, and leaves in the order of `rows`. A group under which no leaf changed comes back as
 * its row from `previous`. Built-in aggregates of a group are merged from its subgroups, so a change
 * under one group costs a pass over that group's leaves, not over all leaves above it.
 */
export function buildRowGroups<TRow, TColumns extends GroupColumns = GroupColumns>(
	rows: readonly TRow[],
	options: GroupRowsOptions<TRow, TColumns>,
	previous: RowGroupCache<TRow> = new Map(),
) {
	const columns = options.columns ? toColumnList(options.columns) : [];
	const cache = new Map<string, GroupCacheEntry<TRow>>();

	function build(leaves: readonly TRow[], level: number, parent: string): { rows: TRow[]; parts: AggregateParts[] | null } {
		const by = options.by[level];

		if (!by) {
			return { rows: [...leaves], parts: null };
		}

		const buckets = new Map<unknown, { value: unknown; rows: TRow[] }>();

		for (const row of leaves) {
			const value = by.value(row);
			const id = toGroupValue(value);
			const bucket = buckets.get(id);

			if (bucket) {
				bucket.rows.push(row);
			} else {
				buckets.set(id, { value, rows: [row] });
			}
		}

		const used = new Map<string, number>();
		const groups = [...buckets.values()].map((bucket) => {
			const base = `${parent}${parent ? '/' : ''}group:${by.name}=${String(bucket.value)}`;
			const repeat = used.get(base) ?? 0;
			const key = repeat === 0 ? base : `${base}~${repeat}`;

			used.set(base, repeat + 1);

			const children = build(bucket.rows, level + 1, key);
			const known = previous.get(key);

			const same = known !== undefined
				&& Object.is(toGroupValue(known.value), toGroupValue(bucket.value))
				&& isSameList(known.children, children.rows);

			let entry: GroupCacheEntry<TRow>;

			if (same) {
				entry = { ...known, value: bucket.value };
			} else {
				const parts = children.parts
					? mergeAggregateParts(columns, children.parts)
					: readAggregateParts(columns, bucket.rows);

				entry = {
					value: bucket.value,
					children: children.rows,
					parts,
					row: options.createGroup({
						key,
						level,
						name: by.name,
						value: bucket.value,
						rows: bucket.rows,
						children: children.rows,
						// Built from the same columns the type reads: a key for each `aggregate`, of its result.
						aggregates: finishAggregates(columns, parts, bucket.rows) as ColumnAggregates<TColumns>,
					}),
				};
			}

			cache.set(key, entry);

			return entry;
		});

		return { rows: groups.map(entry => entry.row), parts: groups.map(entry => entry.parts) };
	}

	return { rows: build(rows, 0, '').rows, cache };
}

/** Rows arranged into a tree of groups by the values of `by`, in the order the values first appear. */
export function groupRows<TRow, TColumns extends GroupColumns = GroupColumns>(
	rows: readonly TRow[],
	options: GroupRowsOptions<TRow, TColumns>,
) {
	return buildRowGroups(rows, options).rows;
}
