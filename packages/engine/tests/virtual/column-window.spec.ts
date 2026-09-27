import { describe, expect, it } from 'vitest';

import type { ColumnPinSide, RenderedColumn, RuntimeColumn } from '../../src/columns/column';
import { type ColumnRange, type ColumnWindow, resolveColumnWindow } from '../../src/virtual/column-window';

const WIDTH = 100;

function rendered(name: string, index: number, pin?: ColumnPinSide): RenderedColumn {
	return {
		column: { name } as RuntimeColumn,
		key: name,
		index,
		pin,
		cellProps: Object.freeze({ key: name }),
		headerProps: Object.freeze({ key: name }),
	};
}

function build(spec: readonly (ColumnPinSide | undefined)[]) {
	return spec.map((pin, index) => rendered(`c${index}`, index, pin));
}

const getWidth = () => WIDTH;

const names = (columns: readonly RenderedColumn[]) =>
	columns.map(column => column.column?.name ?? `spacer:${column.spacer}`);

const plain = build([undefined, undefined, undefined, undefined, undefined, undefined]);

const range = (start: number, end: number): ColumnRange => ({ start, end });

describe('resolveColumnWindow — no window', () => {
	it('without a range the whole set comes back as the same array', () => {
		const result = resolveColumnWindow(plain, null, getWidth);

		expect(result.rendered).toBe(plain);
		expect(result.leadingWidth).toBe(0);
		expect(result.trailingWidth).toBe(0);
	});

	it('a range over the whole set adds no spacers', () => {
		expect(resolveColumnWindow(plain, range(0, plain.length), getWidth).rendered).toBe(plain);
	});

	it('an empty set passes through', () => {
		expect(resolveColumnWindow([], range(0, 0), getWidth).rendered).toEqual([]);
	});
});

describe('resolveColumnWindow — spacers', () => {
	it('a spacer as wide as the skipped columns stands left of the window', () => {
		const result = resolveColumnWindow(plain, range(2, 6), getWidth);

		expect(names(result.rendered)).toEqual(['spacer:start', 'c2', 'c3', 'c4', 'c5']);
		expect(result.leadingWidth).toBe(2 * WIDTH);
	});

	it('a spacer of its own stands right of the window', () => {
		const result = resolveColumnWindow(plain, range(0, 4), getWidth);

		expect(names(result.rendered)).toEqual(['c0', 'c1', 'c2', 'c3', 'spacer:end']);
		expect(result.trailingWidth).toBe(2 * WIDTH);
	});

	it('a window in the middle of the set gets both spacers', () => {
		const result = resolveColumnWindow(plain, range(2, 4), getWidth);

		expect(names(result.rendered)).toEqual(['spacer:start', 'c2', 'c3', 'spacer:end']);
		expect(result.leadingWidth).toBe(2 * WIDTH);
		expect(result.trailingWidth).toBe(2 * WIDTH);
	});

	it('the spacer width is a number in the style, not a variable', () => {
		const result = resolveColumnWindow(plain, range(2, 4), getWidth);
		const [spacer] = result.rendered;

		expect(spacer.cellProps.style).toBe('flex:0 0 200px;min-width:200px');
		expect(String(spacer.cellProps.style)).not.toContain('var(');
	});

	it('a spacer has no declaration and no role: the markup gives it one', () => {
		const [spacer] = resolveColumnWindow(plain, range(2, 4), getWidth).rendered;

		expect(spacer.column).toBeNull();
		expect(spacer.index).toBe(-1);
		expect(spacer.cellProps).not.toHaveProperty('role');
		expect(spacer.cellProps['data-dg-spacer']).toBe('start');
	});

	it('header and body share one props object for a spacer', () => {
		const [spacer] = resolveColumnWindow(plain, range(2, 4), getWidth).rendered;

		expect(spacer.headerProps).toBe(spacer.cellProps);
	});

	it('the given compiler builds the spacer style from the width as a number', () => {
		const [spacer] = resolveColumnWindow(plain, range(2, 4), getWidth, null, width => `width:${width}px`).rendered;

		expect(spacer.cellProps.style).toBe('width:200px');
	});

	it('spacers of different widths are counted from the real column widths', () => {
		const widths: Record<string, number> = { c0: 30, c1: 70, c4: 10, c5: 20 };
		const result = resolveColumnWindow(plain, range(2, 4), name => widths[name] ?? 0);

		expect(result.leadingWidth).toBe(100);
		expect(result.trailingWidth).toBe(30);
	});
});

describe('resolveColumnWindow — row headers', () => {
	function withHeader(index: number) {
		return plain.map(column => (column.index === index ? { ...column, rowHeader: true } : column));
	}

	const keys = (columns: readonly RenderedColumn[]) => columns.map(column => column.key);

	it('a row header before the range stays in its place, the skipped columns around it become spacers', () => {
		const result = resolveColumnWindow(withHeader(1), range(4, 6), getWidth);

		expect(keys(result.rendered)).toEqual(['dg-spacer-start-1', 'c1', 'dg-spacer-start', 'c4', 'c5']);
		expect(result.leadingWidth).toBe(3 * WIDTH);
		expect(result.rendered[0].spacer).toBe('start');
	});

	it('a row header first in the scrolling part needs no spacer before it', () => {
		const result = resolveColumnWindow(withHeader(0), range(3, 5), getWidth);

		expect(keys(result.rendered)).toEqual(['c0', 'dg-spacer-start', 'c3', 'c4', 'dg-spacer-end']);
	});

	it('a row header after the range splits the end side the same way', () => {
		const result = resolveColumnWindow(withHeader(4), range(0, 2), getWidth);

		expect(keys(result.rendered)).toEqual(['c0', 'c1', 'dg-spacer-end', 'c4', 'dg-spacer-end-1']);
		expect(result.trailingWidth).toBe(3 * WIDTH);
	});

	it('a row header inside the range changes nothing', () => {
		const result = resolveColumnWindow(withHeader(3), range(2, 4), getWidth);

		expect(keys(result.rendered)).toEqual(['dg-spacer-start', 'c2', 'c3', 'dg-spacer-end']);
	});

	it('an empty range keeps the row header between the spacers of both sides', () => {
		const result = resolveColumnWindow(withHeader(2), range(4, 4), getWidth);

		expect(keys(result.rendered)).toEqual(['dg-spacer-start-1', 'c2', 'dg-spacer-start', 'dg-spacer-end']);
	});

	it('the window stays the same object while the row header and the range hold', () => {
		const columns = withHeader(1);
		const previous = resolveColumnWindow(columns, range(4, 6), getWidth);

		expect(resolveColumnWindow(columns, range(4, 6), getWidth, previous)).toBe(previous);
	});
});

describe('resolveColumnWindow — pinned columns', () => {
	const pinned = build(['start', 'start', undefined, undefined, undefined, 'end']);

	it('pinned columns are never windowed: they are always in the set, in their places', () => {
		const result = resolveColumnWindow(pinned, range(3, 4), getWidth);

		expect(names(result.rendered)).toEqual(['c0', 'c1', 'spacer:start', 'c3', 'spacer:end', 'c5']);
	});

	it('a range that reaches into pinned columns is cut to the scrolling part', () => {
		const result = resolveColumnWindow(pinned, range(0, 10), getWidth);

		expect(result.rendered).toBe(pinned);
	});

	it('the left spacer measures only the skipped scrolling columns', () => {
		const result = resolveColumnWindow(pinned, range(4, 5), getWidth);

		expect(result.leadingWidth).toBe(2 * WIDTH);
	});

	it('a set of pinned columns only is not cut by the window', () => {
		const onlyPinned = build(['start', 'end']);

		expect(resolveColumnWindow(onlyPinned, range(0, 1), getWidth).rendered).toBe(onlyPinned);
	});
});

describe('resolveColumnWindow — reference stability', () => {
	it('a scroll frame without a change of columns returns the previous window', () => {
		const previous = resolveColumnWindow(plain, range(2, 4), getWidth);
		const next = resolveColumnWindow(plain, range(2, 4), getWidth, previous);

		expect(next).toBe(previous);
	});

	it('a range change gives a new window', () => {
		const previous = resolveColumnWindow(plain, range(2, 4), getWidth);
		const next = resolveColumnWindow(plain, range(3, 5), getWidth, previous);

		expect(next).not.toBe(previous);
		expect(names(next.rendered)).toEqual(['spacer:start', 'c3', 'c4', 'spacer:end']);
	});

	it('a spacer of the same width is reused by reference', () => {
		const previous = resolveColumnWindow(plain, range(2, 4), getWidth);
		const next = resolveColumnWindow(plain, range(2, 5), getWidth, previous);

		expect(next.rendered[0]).toBe(previous.rendered[0]);
	});

	it('a spacer of another width is recreated', () => {
		const previous = resolveColumnWindow(plain, range(2, 4), getWidth);
		const next = resolveColumnWindow(plain, range(3, 5), getWidth, previous);

		expect(next.rendered[0]).not.toBe(previous.rendered[0]);
	});

	it('going back to the full set returns the previous window if the set is the same', () => {
		const previous = resolveColumnWindow(plain, null, getWidth);
		const next = resolveColumnWindow(plain, null, getWidth, previous);

		expect(next).toBe(previous);
	});

	it('a change of columns with the same range gives a new window', () => {
		const previous = resolveColumnWindow(plain, range(2, 4), getWidth);
		const rebuilt = build(Array.from({ length: 6 }, () => undefined));
		const next = resolveColumnWindow(rebuilt, range(2, 4), getWidth, previous);

		expect(next).not.toBe(previous);
	});

	it('an unchanged window does not recreate its array either', () => {
		const first = resolveColumnWindow(plain, range(1, 5), getWidth);
		const second = resolveColumnWindow(plain, range(1, 5), getWidth, first);

		expect(second.rendered).toBe(first.rendered);
	});
});

describe('resolveColumnWindow — degenerate ranges', () => {
	it('an inverted range collapses into an empty window between spacers', () => {
		const result = resolveColumnWindow(plain, range(4, 2), getWidth);

		expect(names(result.rendered)).toEqual(['spacer:start', 'spacer:end']);
		expect(result.leadingWidth + result.trailingWidth).toBe(6 * WIDTH);
	});

	it('a range past the end of the set is cut', () => {
		const result = resolveColumnWindow(plain, range(10, 20), getWidth);

		expect(names(result.rendered)).toEqual(['spacer:start']);
	});

	it('a negative start is cut to zero', () => {
		const result = resolveColumnWindow(plain, range(-5, 2), getWidth);

		expect(names(result.rendered)).toEqual(['c0', 'c1', 'spacer:end']);
	});

	it('zero width of skipped columns draws no spacer', () => {
		const result = resolveColumnWindow(plain, range(2, 4), () => 0);

		expect(names(result.rendered)).toEqual(['c2', 'c3']);
	});
});

describe('resolveColumnWindow — result shape', () => {
	it('the window always has three fields', () => {
		const result: ColumnWindow = resolveColumnWindow(plain, range(1, 3), getWidth);

		expect(Object.keys(result).sort()).toEqual(['leadingWidth', 'rendered', 'trailingWidth']);
	});

	it('the source set is not modified', () => {
		const snapshot = names(plain);

		resolveColumnWindow(plain, range(1, 3), getWidth);

		expect(names(plain)).toEqual(snapshot);
	});
});
