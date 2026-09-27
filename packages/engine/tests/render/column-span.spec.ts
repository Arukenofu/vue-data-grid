import { describe, expect, it } from 'vitest';

import { type ColumnPinSide, type RenderedColumn, toRuntimeColumn } from '../../src/columns/column';
import { defineColumns } from '../../src/columns/define-columns';
import { type ColumnSpanOptions, resolveColumnSpan } from '../../src/render/column-span';
import { FLEX_CELL_STYLES } from '../../src/render/geometry';

const value = () => 0;

const declared = defineColumns({
	number: { value, width: 40 },
	a: { value, width: 100, resizable: true },
	b: { value, width: 100 },
	c: { value, width: 100, flex: 1 },
	total: { value, width: 80 },
});

const PINS: Record<string, ColumnPinSide | undefined> = { number: 'start', total: 'end' };

function createColumns(names: readonly (keyof typeof declared)[] = ['number', 'a', 'b', 'c', 'total']) {
	return names.map((name, index) => ({
		column: toRuntimeColumn(declared[name]),
		key: name,
		index,
		pin: PINS[name],
	}) as RenderedColumn);
}

const options: ColumnSpanOptions = {
	insets: { start: 0, end: 0 },
	getPinOffset: () => 0,
	getGrow: name => (name === 'c' ? 1 : 0),
	cellStyles: FLEX_CELL_STYLES,
};

function summarize(start: number, end: number, overrides: Partial<ColumnSpanOptions> = {}) {
	return resolveColumnSpan(createColumns(), start, end, { ...options, ...overrides })
		.map(cell => ({ columns: cell.columns, inside: cell.inside, pin: cell.pin, continues: cell.continues }));
}

describe('resolveColumnSpan', () => {
	it('splits the row into runs around the span, each run on one pin side', () => {
		expect(summarize(1, 3)).toEqual([
			{ columns: ['number'], inside: false, pin: 'start', continues: { start: false, end: false } },
			{ columns: ['a', 'b'], inside: true, pin: undefined, continues: { start: false, end: false } },
			{ columns: ['c'], inside: false, pin: undefined, continues: { start: false, end: false } },
			{ columns: ['total'], inside: false, pin: 'end', continues: { start: false, end: false } },
		]);
	});

	it('a span across pin sides is cut into pieces that know they continue', () => {
		expect(summarize(0, 5).map(cell => [cell.columns, cell.pin, cell.continues])).toEqual([
			[['number'], 'start', { start: false, end: true }],
			[['a', 'b', 'c'], undefined, { start: true, end: true }],
			[['total'], 'end', { start: true, end: false }],
		]);
	});

	it('a cell is styled as a group of its columns, so it sizes and sticks with them', () => {
		const [pinned, inside] = resolveColumnSpan(createColumns(), 0, 3, { ...options, getPinOffset: () => 12 });

		expect(inside.props.style).toBe(FLEX_CELL_STYLES.group?.({
			columns: [toRuntimeColumn(declared.a), toRuntimeColumn(declared.b)],
			pin: undefined,
			offset: 0,
			grow: 0,
		}));
		expect(inside.props.style).toContain('var(--dg-width-a, 100px)');
		expect(pinned.props.style).toContain('position:sticky');
		expect(pinned.props.style).toContain('12px');
	});

	it('the grow of a run is the sum of its columns, as in the row under it', () => {
		const [, , after] = resolveColumnSpan(createColumns(), 1, 3, options);

		expect(after.props.style).toMatch(/^flex:1 /);
	});

	it('cells carry the attributes a resize and a pin reach cells by', () => {
		const [pinned, inside] = resolveColumnSpan(createColumns(), 1, 3, options);

		expect(inside.props).toMatchObject({ 'data-dg-columns': 'a b', 'data-dg-pinned': undefined });
		expect(pinned.props).toMatchObject({ 'data-dg-columns': 'number', 'data-dg-pinned': 'start' });
		expect(Object.isFrozen(inside.props)).toBe(true);
	});

	it('insets of the row hold their place at both ends', () => {
		const cells = resolveColumnSpan(createColumns(), 1, 2, { ...options, insets: { start: 44, end: 40 } });

		expect(cells[0]).toMatchObject({ key: 'dg-inset-start', inside: false, columns: [] });
		expect(cells[0].props.style).toBe(FLEX_CELL_STYLES.spacer(44));
		expect(cells[cells.length - 1].props.style).toBe(FLEX_CELL_STYLES.spacer(40));
	});

	it('an empty span, or styles without `group`, give no cells', () => {
		expect(resolveColumnSpan(createColumns(), 2, 2, options)).toEqual([]);
		expect(resolveColumnSpan(createColumns(), 0, 2, { ...options, cellStyles: { ...FLEX_CELL_STYLES, group: undefined } }))
			.toEqual([]);
	});

	it('returns the previous array while nothing changed, and keeps the cells that did not', () => {
		const first = resolveColumnSpan(createColumns(), 1, 3, options);

		expect(resolveColumnSpan(createColumns(), 1, 3, options, first)).toBe(first);

		const wider = resolveColumnSpan(createColumns(), 1, 4, options, first);

		expect(wider).not.toBe(first);
		expect(wider[0]).toBe(first[0]);
		expect(wider[wider.length - 1]).toBe(first[first.length - 1]);
	});
});
