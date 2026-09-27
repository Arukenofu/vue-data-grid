import { describe, expect, it } from 'vitest';

import { type AnyColumnInput, type ColumnGeometry, normalizeColumn } from '../../src/columns/column';
import {
	compileCellStyle,
	getColumnCellSelector,
	getColumnSelector,
	getColumnToken,
	getGeometryKey,
	getGrowVariable,
	getPinOffsets,
	getPinVariable,
	getWidthVariable,
} from '../../src/render/geometry';

const value = () => 0;

function geometry(name: string, rest: Partial<ColumnGeometry> = {}): ColumnGeometry {
	return { name, width: 120, minWidth: 80, flex: 0, align: 'left', resizable: false, ...rest };
}

const declarations = (style: string) => new Map(style.split(';').map((part) => {
	const at = part.indexOf(':');

	return [part.slice(0, at), part.slice(at + 1)] as const;
}));

describe('variable names', () => {
	it('are built from the column', () => {
		expect(getWidthVariable('price')).toBe('--dg-width-price');
		expect(getGrowVariable('price')).toBe('--dg-grow-price');
		expect(getPinVariable('start', 'price')).toBe('--dg-pin-start-price');
		expect(getPinVariable('end', 'price')).toBe('--dg-pin-end-price');
	});

	it('escapes characters that are not valid in a `<dashed-ident>` as `·<hex>·`', () => {
		expect(getWidthVariable('day.high')).toBe('--dg-width-day·2e·high');
		expect(getWidthVariable('a b')).toBe('--dg-width-a·20·b');
		expect(getWidthVariable('a·b')).toBe('--dg-width-a·b7·b');
		expect(getWidthVariable('😀')).toBe('--dg-width-·1f600·');
	});

	it('passes ASCII word characters, hyphens and non-Latin letters as is', () => {
		expect(getWidthVariable('day-high_1')).toBe('--dg-width-day-high_1');
		expect(getWidthVariable('цена')).toBe('--dg-width-цена');
		expect(getWidthVariable('価格')).toBe('--dg-width-価格');
	});

	it('gives different names different variables', () => {
		const names = ['a.b', 'a b', 'a_b', 'a-b', 'a·2e·b', 'a·b', 'ab', 'цена', 'мера'];
		const variables = new Set(names.map(getWidthVariable));

		expect(variables.size).toBe(names.length);
	});

	it('produces a name the style declaration accepts both as text and through `setProperty`', () => {
		const element = document.createElement('div');
		const name = getWidthVariable('day.high цена');

		element.style.cssText = `${name}: 5px`;
		expect(element.style.getPropertyValue(name).trim()).toBe('5px');

		element.style.setProperty(name, '7px');
		expect(element.style.getPropertyValue(name).trim()).toBe('7px');
	});
});

describe('getColumnCellSelector', () => {
	it('targets the cells of a column by `data-dg-column`', () => {
		expect(getColumnCellSelector('price')).toBe('[data-dg-column="price"]');
	});

	it('escapes a quote', () => {
		expect(getColumnCellSelector('a"b')).toBe('[data-dg-column="a\\"b"]');
	});

	it('escapes a backslash', () => {
		expect(getColumnCellSelector('a\\b')).toBe('[data-dg-column="a\\\\b"]');
	});
});

describe('getColumnSelector', () => {
	it('finds both the column cells and the group cells above it, but not groups above neighbours', () => {
		const root = document.createElement('div');

		root.innerHTML = '<i data-dg-column="price"></i><b data-dg-columns="price cap"></b><s data-dg-columns="bid ask"></s>';

		expect([...root.querySelectorAll(getColumnSelector('price'))].map(element => element.tagName))
			.toEqual(['I', 'B']);
	});

	it('uses the same column token in a group list as in variables', () => {
		expect(getColumnToken('day high')).toBe('day·20·high');
	});

	it('does not match group cells of a column whose name differs only in escaped characters', () => {
		const root = document.createElement('div');

		root.innerHTML = `<b data-dg-columns="${getColumnToken('a b')}"></b><s data-dg-columns="${getColumnToken('a.b')}"></s>`;

		expect([...root.querySelectorAll(getColumnSelector('a b'))].map(element => element.tagName)).toEqual(['B']);
	});

	const SELECTABLE = ['price', 'day.high', 'a b', 'a]b', 'a:b', 'a=b'];

	it.each(SELECTABLE)('finds exactly its own element by name %j', (name) => {
		const root = document.createElement('div');

		for (const item of [...SELECTABLE, 'other']) {
			const element = document.createElement('i');

			element.setAttribute('data-dg-column', item);
			root.append(element);
		}

		const found = root.querySelectorAll(getColumnSelector(name));

		expect(found).toHaveLength(1);
		expect(found[0].getAttribute('data-dg-column')).toBe(name);
	});
});

describe('compileCellStyle — plain cell', () => {
	it('gives the basis, the grow factor and the minimum, and nothing else', () => {
		const style = declarations(compileCellStyle(geometry('price'), undefined, 0));

		expect([...style.keys()]).toEqual(['flex', 'min-width']);
		expect(style.get('flex')).toBe('0 1 120px');
		expect(style.get('min-width')).toBe('120px');
	});

	it('a column that is not resizable gets a number, without a variable', () => {
		expect(compileCellStyle(geometry('price'), undefined, 0)).not.toContain('var(');
	});

	it('a resizable column gets a variable with the declared width as fallback', () => {
		const style = declarations(compileCellStyle(geometry('price', { resizable: true }), undefined, 0));

		expect(style.get('flex')).toBe('0 1 var(--dg-width-price, 120px)');
		expect(style.get('min-width')).toBe('var(--dg-width-price, 120px)');
	});

	it('`flex` of a column that is not resizable is a number', () => {
		const style = declarations(compileCellStyle(geometry('price', { flex: 2 }), undefined, 0));

		expect(style.get('flex')).toBe('2 1 120px');
	});

	it('`flex` of a resizable column is a variable: grow is zeroed once the user sets the width', () => {
		const style = declarations(compileCellStyle(geometry('price', { flex: 2, resizable: true }), undefined, 0));

		expect(style.get('flex')).toBe('var(--dg-grow-price, 2) 1 var(--dg-width-price, 120px)');
	});

	it('`flex: 0` adds no grow variable: there is nothing to zero', () => {
		expect(compileCellStyle(geometry('price', { resizable: true }), undefined, 0)).not.toContain('--dg-grow');
	});

	it('`maxWidth` gets into the style only when set', () => {
		expect(compileCellStyle(geometry('a'), undefined, 0)).not.toContain('max-width');
		expect(compileCellStyle(geometry('a', { maxWidth: 300 }), undefined, 0)).toContain('max-width:300px');
	});
});

describe('compileCellStyle — the look is left to CSS', () => {
	it('alignment, display and overflow are not in the style', () => {
		const style = compileCellStyle(geometry('a', { align: 'right' }), 'start', 0);

		expect(style).not.toContain('justify-content');
		expect(style).not.toContain('display');
		expect(style).not.toContain('overflow');
	});

	it('a scrolling cell gets no `position`: its content box is up to CSS', () => {
		expect(compileCellStyle(geometry('a'), undefined, 0)).not.toContain('position');
	});
});

describe('compileCellStyle — pinning', () => {
	it('a start-pinned cell sticks to the inline start after the service column inset', () => {
		const style = declarations(compileCellStyle(geometry('symbol'), 'start', 40));

		expect(style.get('position')).toBe('sticky');
		expect(style.get('z-index')).toBe('var(--dg-pinned-z-index, 1)');
		expect(style.get('inset-inline-start'))
			.toBe('calc(var(--dg-inset-start, 0px) + var(--dg-pin-start-symbol, 40px))');
	});

	it('an end-pinned cell sticks to the inline end', () => {
		const style = declarations(compileCellStyle(geometry('actions'), 'end', 0));

		expect(style.get('inset-inline-end')).toBe('calc(var(--dg-inset-end, 0px) + var(--dg-pin-end-actions, 0px))');
	});

	it('uses no physical side, so a right-to-left table pins `start` to the right', () => {
		const style = declarations(compileCellStyle(geometry('symbol'), 'start', 0));

		expect(style.has('left')).toBe(false);
		expect(style.has('right')).toBe(false);
	});

	it('a scrolling cell gets no `z-index` at all', () => {
		expect(compileCellStyle(geometry('a'), undefined, 0)).not.toContain('z-index');
	});

	it('the offset goes into the variable fallback, not the value', () => {
		expect(compileCellStyle(geometry('a'), 'start', 220)).toContain('--dg-pin-start-a, 220px');
	});
});

describe('getPinOffsets', () => {
	const columns = [
		{ name: 'handle', width: 40 },
		{ name: 'symbol', width: 200 },
		{ name: 'price', width: 120 },
		{ name: 'actions', width: 44 },
		{ name: 'menu', width: 32 },
	];

	it('start-pinned columns get growing offsets in set order', () => {
		const offsets = getPinOffsets(columns, name => (name === 'handle' || name === 'symbol' ? 'start' : undefined));

		expect(offsets.get('handle')).toBe(0);
		expect(offsets.get('symbol')).toBe(40);
	});

	it('end-pinned columns are counted from the end', () => {
		const offsets = getPinOffsets(columns, name => (name === 'actions' || name === 'menu' ? 'end' : undefined));

		expect(offsets.get('menu')).toBe(0);
		expect(offsets.get('actions')).toBe(32);
	});

	it('scrolling columns get no offsets', () => {
		const offsets = getPinOffsets(columns, name => (name === 'symbol' ? 'start' : undefined));

		expect(offsets.has('price')).toBe(false);
		expect(offsets.size).toBe(1);
	});

	it('both edges are counted independently', () => {
		const offsets = getPinOffsets(columns, (name) => {
			if (name === 'handle' || name === 'symbol') {
				return 'start';
			}

			return name === 'menu' ? 'end' : undefined;
		});

		expect([...offsets]).toEqual([['handle', 0], ['symbol', 40], ['menu', 0]]);
	});

	it('without pinned columns the map is empty', () => {
		expect(getPinOffsets(columns, () => undefined).size).toBe(0);
	});
});

describe('getGeometryKey', () => {
	const column = normalizeColumn('price', { value, width: 120, resizable: true });

	it('equal inputs give equal keys', () => {
		expect(getGeometryKey(column, 'start', 10)).toBe(getGeometryKey(column, 'start', 10));
	});

	const variant = (input: Partial<AnyColumnInput>) =>
		normalizeColumn('price', { value, width: 120, resizable: true, ...input });

	it.each([
		['width', variant({ width: 200 })],
		['minimum', variant({ minWidth: 10 })],
		['maximum', variant({ maxWidth: 400 })],
		['grow', variant({ flex: 1 })],
		['alignment', variant({ align: 'right' })],
		['resize right', variant({ resizable: false })],
	] as const)('the key changes when the %s changes', (_label, next) => {
		expect(getGeometryKey(next, 'start', 10)).not.toBe(getGeometryKey(column, 'start', 10));
	});

	it('the key changes with the pin and the offset', () => {
		const base = getGeometryKey(column, 'start', 10);

		expect(getGeometryKey(column, 'end', 10)).not.toBe(base);
		expect(getGeometryKey(column, 'start', 11)).not.toBe(base);
	});

	it('changing the label, rights or functions leaves the key alone: the style does not depend on them', () => {
		const base = getGeometryKey(column, 'start', 10);
		const decorated = normalizeColumn('price', {
			value,
			width: 120,
			resizable: true,
			label: 'Price',
			sortable: true,
			hideable: true,
			format: () => '',
		});

		expect(getGeometryKey(decorated, 'start', 10)).toBe(base);
	});
});
