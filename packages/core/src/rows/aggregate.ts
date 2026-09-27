import type { AggregateName, AnyColumn, RuntimeColumn } from '../columns/column';
import { compareValues, isEmptyValue } from './compare';

type AggregateColumn = AnyColumn | RuntimeColumn;

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function pickValue(current: unknown, value: unknown, sign: 1 | -1) {
	return !isEmptyValue(value) && (current === null || sign * compareValues(value, current) > 0) ? value : current;
}

function sum(values: readonly unknown[]) {
	const numbers = values.filter(isNumber);

	return numbers.length === 0 ? null : numbers.reduce((total, value) => total + value, 0);
}

function pick(values: readonly unknown[], sign: 1 | -1) {
	return values.reduce<unknown>((result, value) => pickValue(result, value, sign), null);
}

const AGGREGATES: Record<AggregateName, (values: readonly unknown[], rows: readonly unknown[]) => unknown> = {
	sum,
	avg: (values) => {
		const numbers = values.filter(isNumber);

		return numbers.length === 0 ? null : numbers.reduce((total, value) => total + value, 0) / numbers.length;
	},
	min: values => pick(values, -1),
	max: values => pick(values, 1),
	count: (_values, rows) => rows.length,
};

/**
 * The column's `aggregate` over rows; `undefined` for a column without one. `sum` and `avg` count
 * finite numbers only, `min` and `max` skip empty values, and all four give `null` when nothing is
 * left; `count` is the number of rows.
 */
export function aggregateColumn(column: AggregateColumn, rows: readonly unknown[]) {
	const runtime = column as RuntimeColumn;
	const { aggregate } = runtime;

	if (aggregate === undefined) {
		return undefined;
	}

	const values = rows.map(row => runtime.value(row));

	return typeof aggregate === 'function' ? aggregate(values, rows) : AGGREGATES[aggregate](values, rows);
}

/** The `aggregate` of every column that has one, by column name. */
export function aggregateRows(columns: readonly AggregateColumn[], rows: readonly unknown[]) {
	const result: Record<string, unknown> = {};

	for (const column of columns) {
		if (column.aggregate !== undefined) {
			result[column.name] = aggregateColumn(column, rows);
		}
	}

	return result;
}

type MergeableName = Exclude<AggregateName, 'count'>;

/** A built-in aggregate of one column in a form that merges: a group combines those of its subgroups. */
export interface AggregatePart {
	/** The sum of finite numbers, for `sum` and `avg`. */
	total: number;
	/** How many finite numbers `total` holds. */
	numbers: number;
	/** The value `min` or `max` picked so far; `null` without one. */
	picked: unknown;
}

/** Parts of the built-in aggregates of a group, by column name. */
export type AggregateParts = ReadonlyMap<string, AggregatePart>;

function getMergeable(column: AggregateColumn): MergeableName | null {
	const { aggregate } = column;

	return typeof aggregate === 'string' && aggregate !== 'count' ? aggregate : null;
}

function isPicked(aggregate: MergeableName) {
	return aggregate === 'min' || aggregate === 'max';
}

function getSign(aggregate: MergeableName) {
	return aggregate === 'max' ? 1 : -1;
}

/** Parts of the built-in aggregates over rows: one read of each value. */
export function readAggregateParts(columns: readonly AggregateColumn[], rows: readonly unknown[]): AggregateParts {
	const parts = new Map<string, AggregatePart>();

	for (const column of columns) {
		const aggregate = getMergeable(column);

		if (!aggregate) {
			continue;
		}

		const runtime = column as RuntimeColumn;
		const part: AggregatePart = { total: 0, numbers: 0, picked: null };

		for (const row of rows) {
			const value = runtime.value(row);

			if (isPicked(aggregate)) {
				part.picked = pickValue(part.picked, value, getSign(aggregate));
			} else if (isNumber(value)) {
				part.total += value;
				part.numbers += 1;
			}
		}

		parts.set(column.name, part);
	}

	return parts;
}

/** Parts of a group from the parts of its subgroups, without reading a row. */
export function mergeAggregateParts(
	columns: readonly AggregateColumn[],
	children: readonly AggregateParts[],
): AggregateParts {
	const parts = new Map<string, AggregatePart>();

	for (const column of columns) {
		const aggregate = getMergeable(column);

		if (!aggregate) {
			continue;
		}

		const part: AggregatePart = { total: 0, numbers: 0, picked: null };

		for (const child of children) {
			const item = child.get(column.name);

			if (item) {
				part.total += item.total;
				part.numbers += item.numbers;
				part.picked = isPicked(aggregate) ? pickValue(part.picked, item.picked, getSign(aggregate)) : null;
			}
		}

		parts.set(column.name, part);
	}

	return parts;
}

/**
 * Every `aggregate` by column name: built-in ones from `parts`, `count` and functions over `rows`. A
 * `sum` merged from parts adds the sums of subgroups, which may differ from a flat sum in the last
 * digit.
 */
export function finishAggregates(columns: readonly AggregateColumn[], parts: AggregateParts, rows: readonly unknown[]) {
	const result: Record<string, unknown> = {};

	for (const column of columns) {
		const aggregate = getMergeable(column);
		const part = parts.get(column.name);

		if (column.aggregate === undefined) {
			continue;
		}

		if (!aggregate || !part) {
			result[column.name] = aggregateColumn(column, rows);
		} else if (isPicked(aggregate)) {
			result[column.name] = part.picked;
		} else if (part.numbers === 0) {
			result[column.name] = null;
		} else {
			result[column.name] = aggregate === 'sum' ? part.total : part.total / part.numbers;
		}
	}

	return result;
}
