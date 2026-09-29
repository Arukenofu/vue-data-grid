import type { ColumnPinSide, RenderedColumn } from '../columns/column';
import { getFlexSpacerStyle } from '../render/geometry';

/** A run of columns next to each other, such as the ones in view: indexes in `columns`. */
export interface ColumnRange {
	/** Half-open range `[start, end)` of indexes in `columns`. */
	start: number;
	end: number;
}

export interface ColumnWindow {
	/** The window plus pinned and row header columns, with spacers in place of the skipped columns. */
	rendered: readonly RenderedColumn[];
	/** Width of the skipped columns before the range, px: the spacers on that side together. */
	leadingWidth: number;
	/** Width of the skipped columns after the range, px. */
	trailingWidth: number;
}

function getSpacerKey(side: ColumnPinSide, distance: number) {
	return distance === 0 ? `dg-spacer-${side}` : `dg-spacer-${side}-${distance}`;
}

function createSpacerColumn(key: string, side: ColumnPinSide, style: string): RenderedColumn {
	const props = Object.freeze({
		key,
		'data-dg-spacer': side,
		style,
	});

	return {
		column: null,
		key,
		index: -1,
		spacer: side,
		cellProps: props,
		headerProps: props,
	};
}

// Reuse the spacer while its style holds: the window comparison relies on its reference.
function resolveSpacer(
	previous: ColumnWindow | null | undefined,
	key: string,
	side: ColumnPinSide,
	width: number,
	spacerStyle: (width: number) => string,
) {
	const style = spacerStyle(width);
	const existing = previous?.rendered.find(column => column.key === key);

	return existing && existing.cellProps.style === style ? existing : createSpacerColumn(key, side, style);
}

function isSameWindow(
	previous: ColumnWindow | null | undefined,
	rendered: readonly RenderedColumn[],
	leadingWidth: number,
	trailingWidth: number,
): previous is ColumnWindow {
	return previous !== null
		&& previous !== undefined
		&& previous.leadingWidth === leadingWidth
		&& previous.trailingWidth === trailingWidth
		&& previous.rendered.length === rendered.length
		&& previous.rendered.every((column, index) => column === rendered[index]);
}

/** A run of skipped columns of the scrolling part, which one spacer stands for. */
interface SkippedRun {
	side: ColumnPinSide;
	width: number;
}

function isSkippedRun(part: RenderedColumn | SkippedRun): part is SkippedRun {
	return 'width' in part;
}

/**
 * Builds the column window from the virtualizer's range: pinned columns at both edges, row header
 * columns wherever they stand, and spacers in place of the skipped columns. A row header outside the
 * range splits the skipped columns on its side into two spacers, keyed by their distance from the
 * range: `dg-spacer-start` next to it, `dg-spacer-start-1` past the row header. An unchanged window
 * returns `previous` as is, so a scroll frame that keeps the same columns invalidates nothing
 * downstream.
 */
export function resolveColumnWindow(
	columns: readonly RenderedColumn[],
	range: ColumnRange | null,
	getWidth: (name: string) => number,
	previous?: ColumnWindow | null,
	spacerStyle: (width: number) => string = getFlexSpacerStyle,
): ColumnWindow {
	let pinnedStart = 0;
	let pinnedEnd = columns.length;

	while (pinnedStart < columns.length && columns[pinnedStart].pin === 'start') {
		pinnedStart += 1;
	}

	while (pinnedEnd > pinnedStart && columns[pinnedEnd - 1].pin === 'end') {
		pinnedEnd -= 1;
	}

	const start = range ? Math.min(Math.max(range.start, pinnedStart), pinnedEnd) : pinnedStart;
	const end = range ? Math.min(Math.max(range.end, start), pinnedEnd) : pinnedEnd;
	const parts: (RenderedColumn | SkippedRun)[] = [];
	let leadingWidth = 0;
	let trailingWidth = 0;

	for (let index = pinnedStart; index < pinnedEnd; index += 1) {
		const column = columns[index];

		if ((index >= start && index < end) || column.rowHeader) {
			parts.push(column);
			continue;
		}

		const side: ColumnPinSide = index < start ? 'start' : 'end';
		const width = getWidth(column.column?.name ?? '');
		const last = parts[parts.length - 1];

		// A run never crosses the range, even an empty one: the spacers on its two sides differ.
		if (last !== undefined && isSkippedRun(last) && last.side === side) {
			last.width += width;
		} else {
			parts.push({ side, width });
		}

		if (side === 'start') {
			leadingWidth += width;
		} else {
			trailingWidth += width;
		}
	}

	const runs = parts.filter(isSkippedRun).filter(part => part.width > 0);

	if (runs.length === 0 && parts.length === pinnedEnd - pinnedStart) {
		return previous?.rendered === columns ? previous : { rendered: columns, leadingWidth: 0, trailingWidth: 0 };
	}

	const leading = runs.filter(part => part.side === 'start').length;
	let passed = 0;

	const middle = parts.flatMap((part): RenderedColumn[] => {
		if (!isSkippedRun(part)) {
			return [part];
		}

		if (part.width === 0) {
			return [];
		}

		// Distance from the range: counted down on the start side, up on the end side.
		const distance = part.side === 'start' ? leading - 1 - passed : passed - leading;

		passed += 1;

		return [resolveSpacer(previous, getSpacerKey(part.side, distance), part.side, part.width, spacerStyle)];
	});

	const rendered = [...columns.slice(0, pinnedStart), ...middle, ...columns.slice(pinnedEnd)];

	return isSameWindow(previous, rendered, leadingWidth, trailingWidth)
		? previous
		: { rendered, leadingWidth, trailingWidth };
}
