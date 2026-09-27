import '../../src/style.css';

import { defineColumn, defineColumns } from '@vue-stack/table-core';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import type { TableBodyRow } from '../../src/components/context';
import { TableBody, TableCells, TableRow } from '../../src/components/table-body';
import { TableFillHandle } from '../../src/components/table-fill-handle';
import { TableFillPreview, TableRangeOverlay } from '../../src/components/table-range-overlay';
import { TableRoot } from '../../src/components/table-root';
import { editing, fill, navigation, ranges } from '../../src/data-table/factories';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';

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

function createTable(rows: ShallowRef<Row[]>) {
	return useDataTable({
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
	let table: ReturnType<typeof createTable> | null = null;

	wrapper = mount(defineComponent({
		setup() {
			table = createTable(rows);

			return () => h(TableRoot, { table: table as DataTable, style: { width: '300px', height: '240px', font: '14px sans-serif' } }, {
				default: () => h(TableBody, null, {
					default: ({ rows: bodyRows }: { rows: readonly TableBodyRow[] }) => [
						...bodyRows.map(row => h(TableRow, { key: row.key, row }, { default: () => h(TableCells), $stable: true })),
						h(TableRangeOverlay, { key: 'ranges' }, {
							default: ({ corner }: { corner: boolean }) => (corner ? h(TableFillHandle) : null),
						}),
						h(TableFillPreview, { key: 'fill' }),
					],
				}),
			});
		},
	}), { attachTo: document.body });

	return { rows, table: table as unknown as ReturnType<typeof createTable> };
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
		const { rows, table } = setup();

		table.ranges.select({ key: 'r0', column: 'price' });
		table.ranges.select({ key: 'r1', column: 'price' }, 'extend');
		await nextTick();

		const handle = document.querySelector('[data-tc-part="fill-handle"]') as HTMLElement;
		const corner = document.querySelector('[data-tc-grid-row="1"] [data-tc-column="price"]')!.getBoundingClientRect();
		const box = handle.getBoundingClientRect();

		expect((box.left + box.right) / 2).toBeCloseTo(corner.right, 0);
		expect((box.top + box.bottom) / 2).toBeCloseTo(corner.bottom, 0);
		// The pointer takes it at the corner itself: nothing clips it, no cell lies over it.
		expect(document.elementFromPoint(corner.right, corner.bottom)).toBe(handle);

		pointer('pointerdown', handle, centre(handle));
		pointer('pointermove', window, centre(document.querySelector('[data-tc-grid-row="4"] [data-tc-column="price"]')!));
		await nextTick();

		expect(document.querySelector('[data-tc-part="range"][data-tc-state="fill"]')).not.toBeNull();

		pointer('pointerup', window, { x: 0, y: 0 });

		expect(rows.value.slice(0, 6).map(row => row.price)).toEqual([0, 5, 10, 15, 20, 0]);
		expect(table.ranges.bounds.value).toEqual([{ rowStart: 0, rowEnd: 5, columnStart: 0, columnEnd: 1 }]);
	});
});
