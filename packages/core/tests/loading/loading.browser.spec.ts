import '../../src/style.css';

import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import type { GridBodyRow } from '../../src/components/context';
import { GridBody, GridCells, GridRow } from '../../src/components/grid-body';
import { GridPlaceholderRows } from '../../src/components/grid-placeholder-rows';
import { GridRoot } from '../../src/components/grid-root';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';
import { renderHeader } from '../support/parts';

interface Row {
	id: string;
}

const ROW_HEIGHT = 30;

const column = defineColumn<Row>();

const columns = defineColumns({
	id: column('id', { label: 'Id', width: 120, pinned: 'start' }),
	name: column(row => `Name ${row.id}`, { label: 'Name', width: 200 }),
	code: column(row => row.id.toUpperCase(), { label: 'Code', width: 160 }),
});

function createRows(from: number, count: number) {
	return Array.from({ length: count }, (_, index) => ({ id: `r${from + index}` }));
}

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

interface Setup {
	rows: ShallowRef<readonly Row[]>;
	top: ShallowRef<number>;
	bottom: ShallowRef<number>;
	grid: DataGrid<Row>;
	root: HTMLElement;
}

/** `anchorAtTop` holds the rows in place at the very top, as a watched top edge does. */
function setup(options: { anchorAtTop?: boolean } = {}): Setup {
	const rows = shallowRef<readonly Row[]>(createRows(100, 100));
	const top = shallowRef(0);
	const bottom = shallowRef(0);
	let grid: DataGrid<Row> | null = null;

	wrapper = mount(defineComponent({
		setup() {
			grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: ROW_HEIGHT, virtual: true });

			if (options.anchorAtTop) {
				grid.holdAnchorAtTop();
			}

			return () => h(GridRoot, { grid: grid as DataGrid, style: { width: '360px', height: '240px' } }, {
				default: () => [
					renderHeader(),
					top.value > 0 ? h(GridPlaceholderRows, { key: 'top', count: top.value, edge: 'top' }) : null,
					h(GridBody, { key: 'body' }, {
						default: ({ rows: bodyRows }: { rows: readonly GridBodyRow[] }) => bodyRows.map(row => h(GridRow, { key: row.key, row }, {
							default: () => h(GridCells),
							$stable: true,
						})),
					}),
					bottom.value > 0 ? h(GridPlaceholderRows, { key: 'bottom', count: bottom.value }) : null,
				],
			});
		},
	}), { attachTo: document.body });

	const root = document.querySelector('[data-dg-part="grid"]') as HTMLElement;

	return { rows, top, bottom, grid: grid as unknown as DataGrid<Row>, root };
}

/** Lets the scroll event of a scroll from code come and the rows it brings render. */
async function settle() {
	await nextTick();
	await new Promise(resolve => requestAnimationFrame(resolve));
	await nextTick();
}

/** Where the row with this key stands on the screen. */
function rowTop(key: string) {
	const cell = [...document.querySelectorAll('[data-dg-part="body"] [data-dg-column="id"]')]
		.find(element => element.textContent === key);

	return cell?.getBoundingClientRect().top;
}

describe('loading at the top in a browser', () => {
	it('keeps the rows in view in place when a page comes in above them', async () => {
		const current = setup();

		current.root.scrollTop = 20 * ROW_HEIGHT;
		await settle();

		const before = rowTop('r120');

		current.rows.value = [...createRows(80, 20), ...current.rows.value];
		await settle();

		expect(current.root.scrollTop).toBe(40 * ROW_HEIGHT);
		expect(rowTop('r120')).toBe(before);
	});

	it('keeps them in place at the very top while the top edge is watched, where the page at the top is loaded', async () => {
		const current = setup({ anchorAtTop: true });

		await settle();

		const before = rowTop('r100');

		current.rows.value = [...createRows(80, 20), ...current.rows.value];
		await settle();

		expect(rowTop('r100')).toBe(before);
		expect(current.grid.scope.visibleRowRange.value.start).toBe(20);
	});

	it('shows the rows that come in at the very top otherwise, as a feed does', async () => {
		const current = setup();

		await settle();
		current.rows.value = [...createRows(80, 20), ...current.rows.value];
		await settle();

		expect(current.root.scrollTop).toBe(0);
		expect(rowTop('r80')).toBeDefined();
	});

	it('lands the next scroll where it goes after placeholder rows seen at the top leave without rows', async () => {
		const current = setup({ anchorAtTop: true });

		await settle();
		current.top.value = 3;
		await settle();
		current.root.scrollTop = 0;
		await settle();
		current.top.value = 0;
		await settle();

		current.root.scrollTop = 20 * ROW_HEIGHT;
		await settle();

		expect(current.root.scrollTop).toBe(20 * ROW_HEIGHT);
		expect(current.grid.scope.visibleRowRange.value.start).toBe(20);
	});

	it('placeholder rows at the top move the rows in view neither as they come nor as a page takes their place', async () => {
		const current = setup();

		current.root.scrollTop = 10 * ROW_HEIGHT;
		await settle();

		const before = rowTop('r110');
		const range = current.grid.scope.visibleRowRange.value;

		current.top.value = 3;
		await settle();

		expect(rowTop('r110')).toBe(before);
		expect(current.grid.scope.visibleRowRange.value).toEqual(range);
		expect(document.querySelectorAll('[data-dg-edge="top"] > [data-dg-part="placeholder-row"]')).toHaveLength(3);

		current.top.value = 0;
		current.rows.value = [...createRows(80, 20), ...current.rows.value];
		await settle();

		expect(rowTop('r110')).toBe(before);
	});
});

describe('placeholder rows in a browser', () => {
	it('lay their cells out as the columns, pinned ones included, right after the last row', async () => {
		const current = setup();

		current.rows.value = createRows(0, 3);
		current.bottom.value = 2;
		await settle();

		const placeholders = document.querySelectorAll('[data-dg-part="placeholder-row"]');
		const lastRow = document.querySelector('[data-dg-index="2"]') as HTMLElement;
		const header = (name: string) => document.querySelector(`[data-dg-part="head"] [data-dg-column="${name}"]`)!.getBoundingClientRect();
		const cell = (name: string) => placeholders[0].querySelector(`[data-dg-column="${name}"]`)!.getBoundingClientRect();

		expect(placeholders).toHaveLength(2);
		expect(placeholders[0].getBoundingClientRect().top).toBe(lastRow.getBoundingClientRect().bottom);
		expect(placeholders[0].getBoundingClientRect().height).toBe(ROW_HEIGHT);
		expect(cell('name').left).toBe(header('name').left);
		expect(cell('name').width).toBe(header('name').width);

		current.root.scrollLeft = 150;
		await settle();

		expect(cell('id').left).toBe(header('id').left);
		expect(cell('code').left).toBe(header('code').left);
	});
});
