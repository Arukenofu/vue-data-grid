import { computed, customRef, defineComponent, nextTick, ref, shallowRef, watchEffect } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, onTestFinished } from 'vitest';

import type { CellRange } from '../../src/cells/cell-range';
import { type CellRangesOptions, useCellRanges } from '../../src/cells/use-cell-ranges';
import { type RenderedColumn, toRuntimeColumn } from '../../src/columns/column';
import { defineColumns } from '../../src/columns/define-columns';
import type { TableScope } from '../../src/engine/scope';
import { useTableEngine } from '../../src/engine/use-table-engine';

interface Row {
	symbol: string;
	price: number;
	cap: number;
}

const columns = defineColumns({
	symbol: { value: (row: Row) => row.symbol, label: 'Symbol' },
	price: { value: (row: Row) => row.price, label: 'Price', format: (value: number) => value.toFixed(1) },
	cap: { value: (row: Row) => row.cap, label: 'Cap' },
	number: { value: (row: Row) => row.symbol, label: '#', kind: 'service' },
});

function createScope() {
	const rows = shallowRef<Row[]>([
		{ symbol: 'A', price: 1, cap: 10 },
		{ symbol: 'B', price: 2, cap: 20 },
		{ symbol: 'C', price: 3, cap: 30 },
	]);
	const shown = shallowRef<(keyof typeof columns)[]>(['symbol', 'price', 'cap']);

	const rowKeys = computed(() => rows.value.map(row => row.symbol));
	const scope = {
		rows,
		rowKeys,
		getRowIndex: (key: string) => rowKeys.value.indexOf(key),
		columns: computed(() => shown.value.map(name => ({
			column: toRuntimeColumn(columns[name]),
		}) as RenderedColumn)),
	} as unknown as TableScope;

	return { rows, shown, scope };
}

function setup(options: CellRangesOptions = {}) {
	const { rows, shown, scope } = createScope();

	return { rows, shown, ranges: useCellRanges(scope, options) };
}

describe('useCellRanges', () => {
	it('a click sets a one-cell range, Shift extends it', () => {
		const { ranges } = setup();

		ranges.select({ index: 0, column: 'symbol' });
		ranges.select({ index: 1, column: 'price' }, 'extend');

		expect(ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 }]);
		expect(ranges.isSelected({ index: 1, column: 'symbol' })).toBe(true);
		expect(ranges.isSelected({ index: 2, column: 'symbol' })).toBe(false);
		expect(ranges.isSelected({ index: 0, column: 'cap' })).toBe(false);
	});

	it('Ctrl adds a range, a plain click replaces them all', () => {
		const { ranges } = setup();

		ranges.select({ index: 0, column: 'symbol' });
		ranges.select({ index: 2, column: 'cap' }, 'add');

		expect(ranges.selectedRanges.value).toHaveLength(2);

		ranges.select({ index: 1, column: 'price' });

		expect(ranges.selectedRanges.value).toHaveLength(1);
	});

	it('the text of the last range is TSV through `format`', () => {
		const { ranges } = setup();

		ranges.select({ index: 1, column: 'price' });
		ranges.select({ index: 2, column: 'cap' }, 'extend');

		expect(ranges.getText()).toBe('2.0\t20\r\n3.0\t30');
		expect(ranges.getText({ headers: true })).toBe('Price\tCap\r\n2.0\t20\r\n3.0\t30');
	});

	it('range columns are counted in the current display order', () => {
		const { ranges, shown } = setup();

		ranges.select({ index: 0, column: 'symbol' });
		ranges.select({ index: 0, column: 'price' }, 'extend');
		shown.value = ['price', 'cap', 'symbol'];

		expect(ranges.getText()).toBe('1.0\t10\tA');
	});

	it('a range whose corner column is hidden falls out', () => {
		const { ranges, shown } = setup();

		ranges.select({ index: 0, column: 'cap' });
		shown.value = ['symbol', 'price'];

		expect(ranges.bounds.value).toEqual([]);
		expect(ranges.getText()).toBe('');
	});

	it('`add` drops the ranges the new one covers, and they come back as it shrinks', () => {
		const { ranges } = setup();

		ranges.select({ key: 'B', column: 'price' });
		ranges.select({ key: 'A', column: 'symbol' }, 'add');
		ranges.select({ key: 'C', column: 'cap' }, 'extend');

		expect(ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 3 }]);

		ranges.select({ key: 'A', column: 'symbol' }, 'extend');

		expect(ranges.bounds.value).toEqual([
			{ rowStart: 1, rowEnd: 2, columnStart: 1, columnEnd: 2 },
			{ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 },
		]);
	});

	it('`subtract` takes a cell out of a range, cutting it into the rectangles around it', () => {
		const { ranges } = setup();

		ranges.selectAll();
		ranges.select({ key: 'B', column: 'price' }, 'subtract');

		expect(ranges.bounds.value).toEqual([
			{ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 3 },
			{ rowStart: 1, rowEnd: 2, columnStart: 0, columnEnd: 1 },
			{ rowStart: 1, rowEnd: 2, columnStart: 2, columnEnd: 3 },
			{ rowStart: 2, rowEnd: 3, columnStart: 0, columnEnd: 3 },
		]);
		expect(ranges.isSelected({ index: 1, column: 'price' })).toBe(false);
		expect(ranges.isSelected({ index: 1, column: 'cap' })).toBe(true);
		// The pieces address their rows by key, as the composable does.
		expect(ranges.selectedRanges.value[0]).toEqual({ anchor: { key: 'A', column: 'symbol' }, focus: { key: 'A', column: 'cap' } });
	});

	it('`extend` after `subtract` grows the cut, and shrinking it gives the cells back', () => {
		const { ranges } = setup();

		ranges.selectAll();
		ranges.select({ key: 'A', column: 'symbol' }, 'subtract');
		ranges.select({ key: 'C', column: 'symbol' }, 'extend');

		expect(ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 3, columnStart: 1, columnEnd: 3 }]);

		ranges.select({ key: 'A', column: 'symbol' }, 'extend');

		expect(ranges.bounds.value).toHaveLength(2);
		expect(ranges.isSelected({ index: 1, column: 'symbol' })).toBe(true);
		expect(ranges.isSelected({ index: 0, column: 'symbol' })).toBe(false);
	});

	it('`subtract` over the only selected cell leaves no range; a range it misses stays the same object', () => {
		const { ranges } = setup();

		ranges.select({ key: 'A', column: 'symbol' });
		ranges.select({ key: 'C', column: 'cap' }, 'add');

		const kept = ranges.selectedRanges.value[1];

		ranges.select({ key: 'A', column: 'symbol' }, 'subtract');

		expect(ranges.selectedRanges.value).toEqual([kept]);
		expect(ranges.selectedRanges.value[0]).toBe(kept);
	});

	it('a plain `extend` after other changes drags the last range again', () => {
		const { ranges } = setup();

		ranges.selectAll();
		ranges.select({ key: 'B', column: 'price' }, 'subtract');
		ranges.select({ key: 'A', column: 'symbol' }, 'add');
		ranges.select({ key: 'A', column: 'price' }, 'extend');
		ranges.clear();
		ranges.select({ key: 'A', column: 'symbol' });
		ranges.select({ key: 'B', column: 'symbol' }, 'extend');

		expect(ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 1 }]);
	});

	it('`selectAll` and `clear`', () => {
		const { ranges } = setup();

		ranges.selectAll();

		expect(ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 3 }]);

		ranges.clear();

		expect(ranges.selectedRanges.value).toEqual([]);
	});
});

describe('useCellRanges — service columns', () => {
	it('ranges skip service columns: they are not among the columns bounds count in', () => {
		const { shown, ranges } = setup();

		shown.value = ['number', 'symbol', 'price'];
		ranges.selectAll();

		expect(ranges.columns.value.map(column => column.name)).toEqual(['symbol', 'price']);
		expect(ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 3, columnStart: 0, columnEnd: 2 }]);
		expect(ranges.isSelected({ index: 0, column: 'number' })).toBe(false);
		expect(ranges.getText()).toBe('A\t1.0\r\nB\t2.0\r\nC\t3.0');
	});

	it('`canSelectColumn` lets ranges span them', () => {
		const { shown, ranges } = setup({ canSelectColumn: () => true });

		shown.value = ['number', 'symbol'];
		ranges.select({ index: 0, column: 'number' });
		ranges.select({ index: 0, column: 'symbol' }, 'extend');

		expect(ranges.getText()).toBe('A\tA');
	});
});

describe('useCellRanges — external ranges', () => {
	/** Like `defineModel` under `v-model`: a written value comes back only on the next tick. */
	function createDelayedModel() {
		let value: readonly CellRange[] = [];

		return customRef<readonly CellRange[]>((track, trigger) => ({
			get: () => {
				track();

				return value;
			},
			set: (next) => {
				void nextTick(() => {
					value = next;
					trigger();
				});
			},
		}));
	}

	it('changes in a row within one handler do not lose each other before the model returns the value', async () => {
		const model = createDelayedModel();
		const external = useCellRanges(createScope().scope, { ranges: model });

		external.select({ index: 0, column: 'symbol' });
		external.select({ index: 1, column: 'price' }, 'extend');
		await nextTick();

		const expected = [{ anchor: { index: 0, column: 'symbol' }, focus: { index: 1, column: 'price' } }];

		expect(external.selectedRanges.value).toEqual(expected);
		expect(model.value).toEqual(expected);
	});

	it('after a write from outside, `extend` drags the last range rather than going on with a cut', () => {
		const { scope } = createScope();
		const model = shallowRef<readonly CellRange[]>([]);
		const ranges = useCellRanges(scope, { ranges: model });

		ranges.select({ key: 'A', column: 'symbol' });
		ranges.select({ key: 'A', column: 'symbol' }, 'subtract');
		model.value = [{ anchor: { key: 'B', column: 'symbol' }, focus: { key: 'B', column: 'symbol' } }];
		ranges.select({ key: 'C', column: 'symbol' }, 'extend');

		expect(ranges.bounds.value).toEqual([{ rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 1 }]);
	});

	it('a write from outside reaches the ranges', async () => {
		const model = shallowRef<readonly CellRange[]>([]);
		const external = useCellRanges(createScope().scope, { ranges: model });

		model.value = [{ anchor: { index: 2, column: 'cap' }, focus: { index: 2, column: 'cap' } }];
		await nextTick();

		expect(external.bounds.value).toEqual([{ rowStart: 2, rowEnd: 3, columnStart: 2, columnEnd: 3 }]);
	});
});

describe('useCellRanges — corners by key or by index', () => {
	it('a corner at a row key stays on its row when the rows re-sort', () => {
		const { ranges, rows } = setup();

		ranges.select({ key: 'B', column: 'symbol' });
		rows.value = [...rows.value].reverse();

		expect(ranges.bounds.value).toEqual([{ rowStart: 1, rowEnd: 2, columnStart: 0, columnEnd: 1 }]);
		expect(ranges.isSelected({ index: 1, column: 'symbol' })).toBe(true);
	});

	it('a corner at an index stays in its place while the rows under it change', () => {
		const { ranges, rows } = setup();

		ranges.select({ index: 0, column: 'symbol' });
		rows.value = [...rows.value].reverse();

		expect(ranges.bounds.value[0]).toMatchObject({ rowStart: 0, rowEnd: 1 });
	});

	it('a range falls out while the row of a corner is gone', () => {
		const { ranges, rows } = setup();

		ranges.select({ key: 'A', column: 'symbol' });
		ranges.select({ key: 'C', column: 'price' }, 'extend');
		rows.value = rows.value.filter(row => row.symbol !== 'C');

		expect(ranges.bounds.value).toEqual([]);
		expect(ranges.resolveEdge({ key: 'C', column: 'price' })).toBeNull();
	});

	it('`edgeAt` addresses rows by key, or by index with the `corners` option', () => {
		const byKey = setup();

		expect(byKey.ranges.edgeAt({ index: 1, column: 'price' })).toEqual({ key: 'B', column: 'price' });

		const byIndex = setup({ corners: 'index' });

		expect(byIndex.ranges.edgeAt({ index: 1, column: 'price' })).toEqual({ index: 1, column: 'price' });
	});

	it('`selectAll` keeps every row through sorting and rows that come later', () => {
		const { ranges, rows } = setup();

		ranges.selectAll();
		rows.value = [...rows.value].reverse();
		rows.value = [...rows.value, { symbol: 'D', price: 4, cap: 40 }];

		expect(ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 3 }]);
		expect(ranges.resolveEdge(ranges.selectedRanges.value[0].focus)).toEqual({ index: 3, column: 'cap' });
	});

	it('Shift on a range whose first row is gone starts a new range at the cell', () => {
		const { ranges, rows } = setup();

		ranges.select({ key: 'A', column: 'symbol' });
		rows.value = rows.value.filter(row => row.symbol !== 'A');
		ranges.select({ key: 'C', column: 'price' }, 'extend');

		expect(ranges.bounds.value).toEqual([{ rowStart: 1, rowEnd: 2, columnStart: 1, columnEnd: 2 }]);
	});

	it('`resolveEdge` tells the cell a corner stands on now', () => {
		const { ranges, rows } = setup();

		rows.value = [...rows.value].reverse();

		expect(ranges.resolveEdge({ key: 'A', column: 'cap' })).toEqual({ index: 2, column: 'cap' });
		expect(ranges.resolveEdge({ index: 1, column: 'nope' })).toBeNull();
	});
});

describe('useCellRanges — per-row reactivity', () => {
	function watchRows(ranges: ReturnType<typeof useCellRanges>, rows: readonly number[]) {
		const runs = rows.map(() => 0);

		rows.forEach((row, index) => {
			watchEffect(() => {
				ranges.isSelected({ index: row, column: 'symbol' });
				runs[index] += 1;
			}, { flush: 'sync' });
		});

		return runs;
	}

	it('extending a range down wakes the row it takes, not the rows already in it', () => {
		const { ranges } = setup();

		ranges.select({ index: 0, column: 'symbol' });

		const runs = watchRows(ranges, [0, 1, 2]);

		ranges.select({ index: 1, column: 'symbol' }, 'extend');
		ranges.select({ index: 2, column: 'symbol' }, 'extend');

		expect(runs).toEqual([1, 2, 2]);
	});

	it('extending a range sideways wakes only the rows in it', () => {
		const { ranges } = setup();

		ranges.select({ index: 0, column: 'symbol' });
		ranges.select({ index: 1, column: 'symbol' }, 'extend');

		const runs = watchRows(ranges, [0, 1, 2]);

		ranges.select({ index: 1, column: 'price' }, 'extend');

		expect(runs).toEqual([2, 2, 1]);
	});

	it('`getSelectedColumns` is the same set while the row holds the same cells: a memo token', () => {
		const { ranges } = setup();

		ranges.select({ index: 0, column: 'symbol' });
		ranges.select({ index: 0, column: 'price' }, 'extend');

		const before = ranges.getSelectedColumns(0);

		ranges.select({ index: 1, column: 'price' }, 'extend');

		expect(ranges.getSelectedColumns(0)).toBe(before);
		expect([...before]).toEqual(['symbol', 'price']);
		expect(ranges.getSelectedColumns(2).size).toBe(0);
	});

	it('`bounds` is the same array while the ranges cover the same cells', () => {
		const { ranges, rows } = setup();

		ranges.select({ index: 0, column: 'symbol' });

		const before = ranges.bounds.value;

		rows.value = rows.value.map(row => ({ ...row, price: row.price + 1 }));

		expect(ranges.bounds.value).toBe(before);
	});
});

describe('useCellRanges — rectangles', () => {
	const sheet = defineColumns({
		number: { value: (row: Row) => row.symbol, width: 40, kind: 'service', pinned: 'start' },
		symbol: { value: (row: Row) => row.symbol, width: 100 },
		price: { value: (row: Row) => row.price, width: 100 },
		cap: { value: (row: Row) => row.cap, width: 100, pinned: 'end' },
	});

	function setupEngine() {
		const rows = shallowRef<Row[]>(['A', 'B', 'C', 'D'].map((symbol, index) => ({ symbol, price: index, cap: index * 10 })));
		let result: { engine: ReturnType<typeof useTableEngine<Row>>; ranges: ReturnType<typeof useCellRanges> } | null = null;

		const wrapper = mount(defineComponent({
			setup() {
				const engine = useTableEngine<Row>({
					columns: sheet,
					rows,
					root: shallowRef(null),
					rowKey: 'symbol',
					rowHeight: (row: Row) => (row.symbol === 'B' ? 50 : 30),
				});

				result = { engine, ranges: useCellRanges(engine.scope) };

				return () => null;
			},
		}));

		onTestFinished(() => wrapper.unmount());

		return { rows, ...result! };
	}

	it('a rectangle stands on the rows of the range by their heights', () => {
		const { ranges } = setupEngine();

		ranges.select({ index: 1, column: 'symbol' });
		ranges.select({ index: 2, column: 'price' }, 'extend');

		const [rect] = ranges.rects.value;

		expect(rect).toMatchObject({ top: 30, height: 80, bounds: { rowStart: 1, rowEnd: 3 } });
		expect(rect.cells.filter(cell => cell.inside).map(cell => cell.columns)).toEqual([['symbol', 'price']]);
	});

	it('a range across a pinned column is cut at the pin, with the service column left out', () => {
		const { ranges } = setupEngine();

		ranges.select({ index: 0, column: 'symbol' });
		ranges.select({ index: 0, column: 'cap' }, 'extend');

		const cells = ranges.rects.value[0].cells;

		expect(cells.map(cell => [cell.columns, cell.inside, cell.pin])).toEqual([
			[['number'], false, 'start'],
			[['symbol', 'price'], true, undefined],
			[['cap'], true, 'end'],
		]);
		expect(cells[1].continues).toEqual({ start: false, end: true });
	});

	it('one rectangle per range, in the order of `bounds`', () => {
		const { ranges } = setupEngine();

		ranges.select({ index: 0, column: 'symbol' });
		ranges.select({ index: 3, column: 'price' }, 'add');

		expect(ranges.rects.value.map(rect => rect.top)).toEqual([0, 110]);
	});

	it('rectangles that did not change are the same objects', () => {
		const { ranges, rows } = setupEngine();

		ranges.select({ index: 0, column: 'symbol' });

		const before = ranges.rects.value;

		rows.value = rows.value.map(row => ({ ...row, price: row.price + 1 }));

		expect(ranges.rects.value).toBe(before);

		ranges.select({ index: 3, column: 'price' }, 'add');

		expect(ranges.rects.value[0]).toBe(before[0]);
	});

	it('`grid` is the same object while the keys and the columns hold', () => {
		const { ranges, rows } = setupEngine();
		const before = ranges.grid.value;

		rows.value = rows.value.map(row => ({ ...row, price: row.price + 1 }));

		expect(ranges.grid.value).toBe(before);
	});

	it('a rectangle follows the heights of the rows above it', () => {
		const { ranges, rows } = setupEngine();

		ranges.select({ index: 2, column: 'symbol' });
		rows.value = rows.value.filter(row => row.symbol !== 'A');

		expect(ranges.rects.value[0]).toMatchObject({ top: 80, height: 30 });
	});
});

describe('useCellRanges — cells and text', () => {
	it('copies text as it is: nothing that looks like a formula gets an apostrophe', () => {
		const { ranges, rows } = setup();

		rows.value = [{ symbol: '-5 apples', price: 1, cap: 10 }, { symbol: '=A1', price: 2, cap: 20 }];
		ranges.select({ index: 0, column: 'symbol' });
		ranges.select({ index: 1, column: 'symbol' }, 'extend');

		expect(ranges.getText()).toBe('-5 apples\r\n=A1');
	});

	it('`getCells` gives each selected cell once, by row key, however the ranges overlap', () => {
		const { ranges } = setup();

		ranges.select({ index: 0, column: 'symbol' });
		ranges.select({ index: 1, column: 'price' }, 'extend');
		ranges.select({ index: 1, column: 'symbol' }, 'add');
		ranges.select({ index: 2, column: 'symbol' }, 'extend');

		expect(ranges.getCells().map(cell => `${cell.key}:${cell.column}`)).toEqual([
			'A:symbol',
			'A:price',
			'B:symbol',
			'B:price',
			'C:symbol',
		]);
	});

	it('`selectBounds` selects a rectangle with corners by the `corners` option', () => {
		const { ranges } = setup();

		ranges.selectBounds({ rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 2 });

		expect(ranges.selectedRanges.value).toEqual([{ anchor: { key: 'B', column: 'symbol' }, focus: { key: 'C', column: 'price' } }]);
	});

	it('`isSelected` takes a cell by row key as well as by index', () => {
		const { ranges } = setup();

		ranges.select({ index: 1, column: 'price' });

		expect(ranges.isSelected({ key: 'B', column: 'price' })).toBe(true);
		expect(ranges.isSelected({ key: 'nope', column: 'price' })).toBe(false);
	});

	it('`grid` names the rows and the columns ranges count in', () => {
		const { ranges, shown } = setup();

		shown.value = ['symbol', 'cap'];

		expect(ranges.grid.value).toEqual({ keys: ['A', 'B', 'C'], columns: ['symbol', 'cap'] });
	});
});

describe('useCellRanges — a model in a deep ref', () => {
	it('`extend` after a Ctrl-subtract goes on with it, as with a shallow model', () => {
		const { scope, rows } = createScope();
		const model = ref<readonly CellRange[]>([]);
		const ranges = useCellRanges(scope, { ranges: model, corners: 'index' });

		rows.value = [...rows.value, { symbol: 'D', price: 4, cap: 40 }];
		ranges.select({ index: 0, column: 'symbol' });
		ranges.select({ index: 3, column: 'symbol' }, 'extend');
		ranges.select({ index: 1, column: 'symbol' }, 'subtract');
		ranges.select({ index: 2, column: 'symbol' }, 'extend');

		expect(ranges.bounds.value).toEqual([
			{ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 },
			{ rowStart: 3, rowEnd: 4, columnStart: 0, columnEnd: 1 },
		]);
	});
});
