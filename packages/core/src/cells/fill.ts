import type { CellGrid, CellPosition } from './cell-address';
import type { CellWrite } from './cell-edit';
import type { RangeBounds } from './cell-range';

export interface FillOptions {
	/**
	 * Continue numbers as a linear series, as a spreadsheet does: `1, 2` goes on `3, 4`. A single number
	 * and anything that is not a number are repeated either way. `true` by default.
	 */
	series?: boolean;
}

/** Digits a number of a series keeps, as a spreadsheet does: the noise of floating point goes, big integers stay. */
const SIGNIFICANT_DIGITS = 15;

function getDistance(index: number, start: number, end: number) {
	if (index < start) {
		return start - index;
	}

	return index >= end ? index - end + 1 : 0;
}

/**
 * Where a fill from `source` reaches when the pointer is over the cell at `row` and `column`: `source`
 * stretched to that row or that column, along the one the cell is farther out on, as a spreadsheet's
 * fill handle does. `source` itself while the cell is inside it.
 */
export function getFillTarget(source: RangeBounds, row: number, column: number): RangeBounds {
	const rows = getDistance(row, source.rowStart, source.rowEnd);
	const columns = getDistance(column, source.columnStart, source.columnEnd);

	if (rows === 0 && columns === 0) {
		return source;
	}

	return rows >= columns
		? { ...source, rowStart: Math.min(source.rowStart, row), rowEnd: Math.max(source.rowEnd, row + 1) }
		: { ...source, columnStart: Math.min(source.columnStart, column), columnEnd: Math.max(source.columnEnd, column + 1) };
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The linear trend through the values by least squares, as a function of the offset from the first;
 * `null` when they are not all numbers. Integers on an integer step stay exact.
 */
function getTrend(values: readonly unknown[]) {
	if (values.length < 2 || !values.every(isFiniteNumber)) {
		return null;
	}

	const count = values.length;
	const meanIndex = (count - 1) / 2;
	let sum = 0;

	for (const value of values) {
		sum += value;
	}

	const meanValue = sum / count;
	let covariance = 0;
	let variance = 0;

	for (const [index, value] of values.entries()) {
		covariance += (index - meanIndex) * (value - meanValue);
		variance += (index - meanIndex) ** 2;
	}

	const step = covariance / variance;
	const start = meanValue - step * meanIndex;
	const exact = Number.isInteger(step) && Number.isInteger(start);

	return (offset: number) => {
		const value = start + step * offset;

		return exact ? value : Number.parseFloat(value.toPrecision(SIGNIFICANT_DIGITS));
	};
}

/**
 * The cells a fill from `source` writes over the rest of `target`, which stretches it one way, as
 * `getFillTarget` gives, as writes into the cells of `grid`: each line along the fill, a column for a
 * fill down or up, continues its own values in `source`, which `getValue` reads. Numbers go on as a
 * linear series, everything else repeats in order, backwards for a fill up or left.
 */
export function resolveFill(
	source: RangeBounds,
	target: RangeBounds,
	grid: CellGrid,
	getValue: (cell: CellPosition) => unknown,
	options: FillOptions = {},
): CellWrite[] {
	const vertical = target.rowStart !== source.rowStart || target.rowEnd !== source.rowEnd;
	const series = options.series ?? true;
	const writes: CellWrite[] = [];

	const lines = vertical
		? { start: source.columnStart, end: source.columnEnd }
		: { start: source.rowStart, end: source.rowEnd };
	const along = vertical
		? { start: source.rowStart, end: source.rowEnd, from: target.rowStart, to: target.rowEnd }
		: { start: source.columnStart, end: source.columnEnd, from: target.columnStart, to: target.columnEnd };
	const length = along.end - along.start;

	if (length <= 0) {
		return writes;
	}

	const toCell = (line: number, position: number) => (vertical ? { row: position, column: line } : { row: line, column: position });

	for (let line = lines.start; line < lines.end; line += 1) {
		const values = Array.from({ length }, (_, offset) => {
			const cell = toCell(line, along.start + offset);

			return getValue({ index: cell.row, column: grid.columns[cell.column] });
		});
		const trend = series ? getTrend(values) : null;

		for (let position = along.from; position < along.to; position += 1) {
			if (position >= along.start && position < along.end) {
				continue;
			}

			const offset = position - along.start;
			const cell = toCell(line, position);

			writes.push({
				key: grid.keys[cell.row],
				column: grid.columns[cell.column],
				value: trend ? trend(offset) : values[((offset % length) + length) % length],
			});
		}
	}

	return writes;
}
