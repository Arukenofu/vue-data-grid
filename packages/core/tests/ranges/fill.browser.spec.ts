import '../../src/style.css';

import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import type { GridBodyRow } from '../../src/components/context';
import { GridBody, GridCells, GridRow } from '../../src/components/grid-body';
import { GridFillHandle } from '../../src/components/grid-fill-handle';
import { GridFillPreview, GridRangeOverlay } from '../../src/components/grid-range-overlay';
import { GridRoot } from '../../src/components/grid-root';
import { editing, fill, navigation, ranges } from '../../src/data-grid/factories';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';

interface Row {
	id: string;
	price: number;
}

const columns = defineColumns({
	price: defineColumn<Row>()(row => row.price, { width: 100, editable: true, setValue: (row, price) => ({ ...row, price }) }),
});

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

function createGrid(rows: ShallowRef<Row[]>) {
	return useDataGrid({
		columns,
		rows,
		rowKey: 'id',
		rowHeight: 30,
		virtual: true,
		features: {
			navigation: navigation(),
			ranges: ranges(),
			editing: editing({
				onCommit: (commit) => {
					rows.value = [...commit.apply(rows.value)];
				},
			}),
			fill: fill(),
		},
	});
}

function setup() {
	const rows: ShallowRef<Row[]> = shallowRef(Array.from({ length: 30 }, (_, index) => ({ id: `r${index}`, price: index === 1 ? 5 : 0 })));
	let grid: ReturnType<typeof createGrid> | null = null;

	wrapper = mount(defineComponent({
		setup() {
			grid = createGrid(rows);

			return () => h(GridRoot, { grid: grid as DataGrid, style: { width: '300px', height: '240px', font: '14px sans-serif' } }, {
				default: () => h(GridBody, null, {
					default: ({ rows: bodyRows }: { rows: readonly GridBodyRow[] }) => [
						...bodyRows.map(row => h(GridRow, { key: row.key, row }, { default: () => h(GridCells), $stable: true })),
						h(GridRangeOverlay, { key: 'ranges' }, {
							default: ({ corner }: { corner: boolean }) => (corner ? h(GridFillHandle) : null),
						}),
						h(GridFillPreview, { key: 'fill' }),
					],
				}),
			});
		},
	}), { attachTo: document.body });

	return { rows, grid: grid as unknown as ReturnType<typeof createGrid> };
}

function centre(element: Element) {
	const box = element.getBoundingClientRect();

	return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function pointer(type: string, target: EventTarget, point: { x: number; y: number }) {
	target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: point.x, clientY: point.y }));
}

describe('the fill handle in a browser', () => {
	it('stands on the end corner of the range, and dragging it down fills a series', async () => {
		const { rows, grid } = setup();

		grid.ranges.select({ key: 'r0', column: 'price' });
		grid.ranges.select({ key: 'r1', column: 'price' }, 'extend');
		await nextTick();

		const handle = document.querySelector('[data-dg-part="fill-handle"]') as HTMLElement;
		const corner = document.querySelector('[data-dg-grid-row="1"] [data-dg-column="price"]')!.getBoundingClientRect();
		const box = handle.getBoundingClientRect();

		expect((box.left + box.right) / 2).toBeCloseTo(corner.right, 0);
		expect((box.top + box.bottom) / 2).toBeCloseTo(corner.bottom, 0);
		// The pointer takes it at the corner itself: nothing clips it, no cell lies over it.
		expect(document.elementFromPoint(corner.right, corner.bottom)).toBe(handle);

		pointer('pointerdown', handle, centre(handle));
		pointer('pointermove', window, centre(document.querySelector('[data-dg-grid-row="4"] [data-dg-column="price"]')!));
		await nextTick();

		expect(document.querySelector('[data-dg-part="range"][data-dg-state="fill"]')).not.toBeNull();

		pointer('pointerup', window, { x: 0, y: 0 });

		expect(rows.value.slice(0, 6).map(row => row.price)).toEqual([0, 5, 10, 15, 20, 0]);
		expect(grid.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 5, columnStart: 0, columnEnd: 1 }]);
	});
});
