import type { ColumnPinSide, RenderedColumn } from '../columns/column';
import { getColumnToken, type GridCellStyles } from './geometry';

/** A cell of a column span: a run of shown columns on one pin side, in the span or around it. */
export interface ColumnSpanCell {
	/** For `v-for`: unique within the span. */
	key: string;
	/** Whether its columns are in the span; the other cells hold the place of the columns around it. */
	inside: boolean;
	/** Its columns in display order; empty for an inset of the row. */
	columns: readonly string[];
	pin: ColumnPinSide | undefined;
	/** Whether the span goes on past the start or the end edge of this cell, into another pin side. */
	continues: { start: boolean; end: boolean };
	/** Frozen: the style, and `data-dg-columns` and `data-dg-pinned`, by which a resize reaches it. */
	props: Readonly<Record<string, unknown>>;
}

export interface ColumnSpanOptions {
	insets: { start: number; end: number };
	getPinOffset: (name: string) => number;
	getGrow: (name: string) => number;
	cellStyles: GridCellStyles;
}

/** The geometry of a cell over a run of neighbouring shown columns on one pin side. */
export interface ColumnRunGeometry {
	/** The style of `cellStyles.group`; `undefined` without it. */
	style: string | undefined;
	/** `data-dg-columns`: the tokens of the columns, by which a resize reaches the cell. */
	tokens: string;
}

/** The sum of the grow of columns, which a cell over them grows by. */
export function getColumnRunGrow(names: readonly string[], getGrow: (name: string) => number) {
	let grow = 0;

	for (const name of names) {
		grow += getGrow(name);
	}

	return grow;
}

/**
 * The style and the column tokens of a cell over a run of neighbouring shown columns on one pin side,
 * such as a column group or a piece of a column span: laid out, stuck and resized with the cells under
 * it. A run pinned at the end sticks by its last column.
 */
export function getColumnRunGeometry(
	items: readonly RenderedColumn[],
	grow: number,
	options: Pick<ColumnSpanOptions, 'getPinOffset' | 'cellStyles'>,
): ColumnRunGeometry {
	const names = items.map(item => item.key);
	const { pin } = items[0];
	const edge = pin === 'end' ? names[names.length - 1] : names[0];

	return {
		style: options.cellStyles.group?.({
			columns: items.flatMap(item => (item.column ? [item.column] : [])),
			pin,
			offset: pin ? options.getPinOffset(edge) : 0,
			grow,
		}),
		tokens: names.map(getColumnToken).join(' '),
	};
}

const NO_CELLS: readonly ColumnSpanCell[] = Object.freeze([]);

const NO_CONTINUATION = Object.freeze({ start: false, end: false });

function isSameCell(current: ColumnSpanCell, next: ColumnSpanCell) {
	return current.key === next.key
		&& current.inside === next.inside
		&& current.pin === next.pin
		&& current.continues.start === next.continues.start
		&& current.continues.end === next.continues.end
		&& current.props.style === next.props.style
		&& current.props['data-dg-columns'] === next.props['data-dg-columns'];
}

function createInset(side: ColumnPinSide, width: number, cellStyles: GridCellStyles): ColumnSpanCell {
	const key = `dg-inset-${side}`;

	return {
		key,
		inside: false,
		columns: [],
		pin: undefined,
		continues: NO_CONTINUATION,
		props: Object.freeze({ key, style: cellStyles.spacer(width) }),
	};
}

/**
 * A row across the grid that spans shown columns `[start, end)` of `columns`: the span split by pin
 * side, between cells holding the place of the columns around it and of the insets. Each cell is
 * styled as a group cell of its columns (`cellStyles.group`), so it lays out, sticks and resizes with
 * the cells under it without a render. Overlays over the body, such as cell ranges, are drawn on it.
 *
 * Cells that did not change come back from `previous`, and so does the array when none did. Empty
 * for an empty span and without `cellStyles.group`.
 */
export function resolveColumnSpan(
	columns: readonly RenderedColumn[],
	start: number,
	end: number,
	options: ColumnSpanOptions,
	previous: readonly ColumnSpanCell[] = NO_CELLS,
): readonly ColumnSpanCell[] {
	const { cellStyles } = options;
	const first = Math.max(start, 0);
	const last = Math.min(end, columns.length);

	if (!cellStyles.group || first >= last) {
		return NO_CELLS;
	}

	// Runs of neighbours on the same pin side and on the same side of the span edges.
	const runs: { inside: boolean; items: RenderedColumn[] }[] = [];

	columns.forEach((item, index) => {
		const run = runs[runs.length - 1];
		const inside = index >= first && index < last;

		if (run && run.inside === inside && run.items[0].pin === item.pin) {
			run.items.push(item);
		} else {
			runs.push({ inside, items: [item] });
		}
	});

	const cells: ColumnSpanCell[] = [];

	if (options.insets.start > 0) {
		cells.push(createInset('start', options.insets.start, cellStyles));
	}

	runs.forEach(({ inside, items }, index) => {
		const names = items.map(item => item.key);
		const { pin } = items[0];
		const geometry = getColumnRunGeometry(items, getColumnRunGrow(names, options.getGrow), options);

		cells.push({
			key: names[0],
			inside,
			columns: names,
			pin,
			continues: inside
				? { start: runs[index - 1]?.inside ?? false, end: runs[index + 1]?.inside ?? false }
				: NO_CONTINUATION,
			props: Object.freeze({
				key: names[0],
				'data-dg-columns': geometry.tokens,
				'data-dg-pinned': pin,
				style: geometry.style,
			}),
		});
	});

	if (options.insets.end > 0) {
		cells.push(createInset('end', options.insets.end, cellStyles));
	}

	const reused = cells.map((cell) => {
		const before = previous.find(item => item.key === cell.key);

		return before && isSameCell(before, cell) ? before : cell;
	});

	return reused.length === previous.length && reused.every((cell, index) => cell === previous[index]) ? previous : reused;
}
