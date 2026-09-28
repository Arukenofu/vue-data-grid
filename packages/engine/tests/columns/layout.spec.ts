import { describe, expect, it } from 'vitest';

import type { ColumnLayout, ColumnPinSide } from '../../src/columns/column';
import { type GridLayout, resolveLayout } from '../../src/columns/layout';

interface ColumnOptions {
	hiddenByDefault?: boolean;
	pinned?: ColumnPinSide;
	pinnable?: boolean;
}

function column(name: string, options: ColumnOptions = {}): ColumnLayout {
	return {
		name,
		hiddenByDefault: options.hiddenByDefault ?? false,
		pinned: options.pinned,
		pinnable: options.pinnable ?? false,
	};
}

function layout(value: Partial<GridLayout> = {}): GridLayout {
	return { order: [], hidden: [], widths: {}, pinned: {}, ...value };
}

describe('resolveLayout — no layout yet', () => {
	it('the order comes from the declaration', () => {
		const columns = [column('a'), column('b'), column('c')];

		expect(resolveLayout(columns, null).order).toEqual(['a', 'b', 'c']);
	});

	it('hidden columns come from `hiddenByDefault`', () => {
		const columns = [column('a'), column('b', { hiddenByDefault: true })];

		expect(resolveLayout(columns, null).hidden).toEqual(['b']);
	});

	it('there are no widths: they appear only after a resize', () => {
		expect(resolveLayout([column('a')], null).widths).toEqual({});
	});

	it('the default pin is taken only from `pinnable` columns', () => {
		const columns = [
			column('locked', { pinned: 'start' }),
			column('free', { pinned: 'start', pinnable: true }),
			column('right', { pinned: 'end', pinnable: true }),
		];

		expect(resolveLayout(columns, null).pinned).toEqual({ free: 'start', right: 'end' });
	});

	it('an empty set gives an empty layout', () => {
		expect(resolveLayout([], null)).toEqual(layout());
	});
});

describe('resolveLayout — a layout that needs no changes', () => {
	it('returns the same object when there are no new columns', () => {
		const stored = layout({ order: ['a', 'b'], hidden: ['b'], widths: { a: 200 } });

		expect(resolveLayout([column('a'), column('b')], stored)).toBe(stored);
	});

	it('the stored order beats the declaration order', () => {
		const stored = layout({ order: ['b', 'a'] });

		expect(resolveLayout([column('a'), column('b')], stored).order).toEqual(['b', 'a']);
	});

	it('a column no longer declared stays in the order', () => {
		const stored = layout({ order: ['a', 'dropped', 'b'] });

		expect(resolveLayout([column('a'), column('b')], stored).order).toEqual(['a', 'dropped', 'b']);
	});

	it('widths are carried over by reference', () => {
		const widths = { a: 200 };
		const stored = layout({ order: ['a'], widths });

		expect(resolveLayout([column('a'), column('b')], stored).widths).toBe(widths);
	});
});

describe('resolveLayout — new columns take their declared place', () => {
	it('a column in the middle of the set goes right after the nearest known column on its left', () => {
		const columns = [column('a'), column('fresh'), column('b')];
		const stored = layout({ order: ['a', 'b'] });

		expect(resolveLayout(columns, stored).order).toEqual(['a', 'fresh', 'b']);
	});

	it('a column before every known one goes first', () => {
		const columns = [column('fresh'), column('a'), column('b')];
		const stored = layout({ order: ['a', 'b'] });

		expect(resolveLayout(columns, stored).order).toEqual(['fresh', 'a', 'b']);
	});

	it('several new columns in a row keep their order', () => {
		const columns = [column('a'), column('x'), column('y'), column('b')];
		const stored = layout({ order: ['a', 'b'] });

		expect(resolveLayout(columns, stored).order).toEqual(['a', 'x', 'y', 'b']);
	});

	it('a new column at the end is appended', () => {
		const columns = [column('a'), column('b'), column('fresh')];
		const stored = layout({ order: ['a', 'b'] });

		expect(resolveLayout(columns, stored).order).toEqual(['a', 'b', 'fresh']);
	});

	it('the stored order serves as the anchor, not the declared one', () => {
		const columns = [column('a'), column('fresh'), column('b')];
		const stored = layout({ order: ['b', 'a'] });

		expect(resolveLayout(columns, stored).order).toEqual(['b', 'a', 'fresh']);
	});

	it('a new column hidden by default is added to the hidden ones', () => {
		const columns = [column('a'), column('fresh', { hiddenByDefault: true })];
		const stored = layout({ order: ['a'], hidden: ['a'] });

		expect(resolveLayout(columns, stored).hidden).toEqual(['a', 'fresh']);
	});

	it('a new column shown by default is not added to the hidden ones', () => {
		const columns = [column('a'), column('fresh')];
		const stored = layout({ order: ['a'], hidden: ['a'] });

		expect(resolveLayout(columns, stored).hidden).toEqual(['a']);
	});

	it('a hidden column the user has shown does not become hidden again', () => {
		const columns = [column('a', { hiddenByDefault: true })];
		const stored = layout({ order: ['a'], hidden: [] });

		expect(resolveLayout(columns, stored).hidden).toEqual([]);
	});

	it('a new column pinned by default is added to the pins without touching the old ones', () => {
		const columns = [
			column('a', { pinned: 'start', pinnable: true }),
			column('fresh', { pinned: 'end', pinnable: true }),
		];
		const stored = layout({ order: ['a'], pinned: { a: 'end' } });

		expect(resolveLayout(columns, stored).pinned).toEqual({ a: 'end', fresh: 'end' });
	});
});

describe('resolveLayout — a record without `pinned`', () => {
	it('a record of the old schema gets the default pins', () => {
		const columns = [column('a', { pinned: 'start', pinnable: true }), column('b')];
		const stored = { order: ['a', 'b'], hidden: [], widths: {} } as unknown as GridLayout;

		expect(resolveLayout(columns, stored).pinned).toEqual({ a: 'start' });
	});

	it('such a record is rebuilt rather than returned as is', () => {
		const stored = { order: ['a'], hidden: [], widths: {} } as unknown as GridLayout;

		expect(resolveLayout([column('a')], stored)).not.toBe(stored);
	});
});

describe('resolveLayout — collapsed groups', () => {
	it('survive rebuilding the layout for new columns', () => {
		const stored = layout({ order: ['a'], collapsed: { quote: true } });

		expect(resolveLayout([column('a'), column('b')], stored).collapsed).toEqual({ quote: true });
	});
});
