import { type CellPosition, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridBodyRow } from '../../src/components/context';
import { GridBody, GridCells, GridRow } from '../../src/components/grid-body';
import { GridRoot } from '../../src/components/grid-root';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';
import { type CellDragEnd, useCellDrag } from '../../src/ranges/use-cell-drag';

interface Row {
	id: string;
	price: number;
}

const columns = defineColumns({
	id: { value: (row: Row) => row.id, width: 100 },
	price: { value: (row: Row) => row.price, width: 100 },
});

const ROW_HEIGHT = 30;

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

function setup() {
	const cells: CellPosition[] = [];
	const ends: CellDragEnd[] = [];
	let drag: ReturnType<typeof useCellDrag> | null = null;

	wrapper = mount(defineComponent({
		setup() {
			const grid = useDataGrid({
				columns,
				rows: ['a', 'b', 'c', 'd'].map((id, index) => ({ id, price: index })),
				rowKey: 'id',
				rowHeight: ROW_HEIGHT,
			});

			drag = useCellDrag(grid, {
				getColumns: () => ['price'],
				autoScroll: false,
				onCell: cell => cells.push(cell),
				onEnd: end => ends.push(end),
			});

			return () => h(GridRoot, { grid: grid as DataGrid }, {
				default: () => h(GridBody, null, {
					default: ({ rows }: { rows: readonly GridBodyRow[] }) => rows.map(row => h(
						GridRow,
						{ key: row.key, row },
						{ default: () => h(GridCells), $stable: true },
					)),
				}),
			});
		},
	}), { attachTo: document.body });

	placeCells();

	return { drag: drag!, cells, ends };
}

/** Lays the rows out one under another, as a browser would, for the pointer to find them. */
function placeCells() {
	const body = document.querySelector('[data-dg-part="body"]') as HTMLElement;

	body.getBoundingClientRect = () => new DOMRect(0, 0, 200, ROW_HEIGHT * 4);

	for (const cell of document.querySelectorAll<HTMLElement>('[data-dg-column]')) {
		const row = Number(cell.closest('[data-dg-grid-row]')?.getAttribute('data-dg-grid-row'));
		const left = cell.getAttribute('data-dg-column') === 'id' ? 0 : 100;

		cell.getBoundingClientRect = () => new DOMRect(left, row * ROW_HEIGHT, 100, ROW_HEIGHT);
	}

	const root = document.querySelector('[data-dg-part="grid"]') as HTMLElement;

	root.getBoundingClientRect = () => new DOMRect(0, 0, 200, ROW_HEIGHT * 4);
	Object.defineProperty(root, 'clientHeight', { value: ROW_HEIGHT * 4 });
}

function move(x: number, y: number) {
	window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }));
}

describe('useCellDrag', () => {
	it('reports each cell the pointer reaches once, the cell of the press as reached', async () => {
		const { drag, cells } = setup();

		await nextTick();
		drag.start(new PointerEvent('pointerdown', { clientX: 150, clientY: 10 }), { index: 0, column: 'price' });
		move(150, 12);
		move(150, 40);
		move(160, 45);
		move(150, 70);

		expect(cells).toEqual([{ index: 1, column: 'price' }, { index: 2, column: 'price' }]);
	});

	it('gives the nearest cell of a column it reaches, and the edge row past the rows', async () => {
		const { drag, cells } = setup();

		await nextTick();
		drag.start(new PointerEvent('pointerdown', { clientX: 150, clientY: 10 }));
		move(20, 40);
		move(150, 500);

		expect(cells).toEqual([{ index: 1, column: 'price' }, { index: 3, column: 'price' }]);
	});

	it('ends on pointer up, and as cancelled on `cancel`', async () => {
		const { drag, ends } = setup();

		await nextTick();
		drag.start(new PointerEvent('pointerdown'));

		expect(drag.dragging.value).toBe(true);

		window.dispatchEvent(new PointerEvent('pointerup'));
		drag.start(new PointerEvent('pointerdown'));
		drag.cancel();

		expect(ends).toEqual([{ cancelled: false }, { cancelled: true }]);
		expect(drag.dragging.value).toBe(false);
	});
});
