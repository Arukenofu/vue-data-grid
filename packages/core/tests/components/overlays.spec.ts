import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, effectScope, h, nextTick, type ShallowRef, shallowRef, type VNodeChild } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGridAnnouncer } from '../../src/announcer/use-grid-announcer';
import { selectionColumn } from '../../src/columns/service-columns';
import type { GridMessages } from '../../src/components/messages';
import { GridEmpty, GridLoading } from '../../src/components/grid-overlays';
import { GridRoot } from '../../src/components/grid-root';
import { selection, sorting } from '../../src/data-grid/factories';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';
import { renderBody, renderFooter, renderHeader } from '../support/parts';

interface Row {
	id: string;
	price: number;
}

const column = defineColumn<Row>({ sortable: true });

const columns = defineColumns({
	select: selectionColumn<Row>(),
	id: column(row => row.id, { label: 'Id', resizable: true }),
	price: column(row => row.price, { label: 'Price' }),
});

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

interface Setup {
	rows?: Row[];
	loading?: ShallowRef<boolean>;
	messages?: Partial<GridMessages>;
	content?: () => VNodeChild;
}

function render(setup: Setup = {}) {
	const rows = shallowRef(setup.rows ?? [{ id: 'a', price: 1 }, { id: 'b', price: 2 }]);
	let grid: DataGrid | null = null;

	wrapper = mount(defineComponent({
		setup() {
			grid = useDataGrid({
				columns,
				rows,
				rowKey: 'id',
				rowHeight: 30,
				features: {
					sorting: sorting(),
					selection: selection(),
				},
			}) as DataGrid;

			return () => h(GridRoot, { grid: grid as DataGrid, messages: setup.messages }, {
				default: setup.content ?? (() => [
					renderHeader(),
					renderBody(),
					h(GridEmpty),
					setup.loading?.value ? h(GridLoading) : null,
					renderFooter(),
				]),
			});
		},
	}), { attachTo: document.body });

	return { rows, grid: grid as unknown as DataGrid };
}

const grid = () => wrapper?.get('[data-dg-part="grid"]');
const announced = () => wrapper?.get('[data-dg-part="announcer"]').text();

describe('GridEmpty', () => {
	it('shows one row over every column while there are no rows, counted in the rows', async () => {
		render({ rows: [] });
		await nextTick();

		const empty = wrapper?.get('[data-dg-part="empty"]');

		expect(empty?.attributes()).toMatchObject({ role: 'row', 'aria-rowindex': '2' });
		expect(empty?.get('[data-dg-part="empty-cell"]').attributes()).toMatchObject({ role: 'gridcell', 'aria-colspan': '3' });
		expect(empty?.text()).toBe('No rows');
		expect(grid()?.attributes('aria-rowcount')).toBe('3');
		expect(wrapper?.get('[data-dg-part="foot"] [role="row"]').attributes('aria-rowindex')).toBe('3');
	});

	it('goes away, and stops counting, once rows come', async () => {
		const { rows } = render({ rows: [] });

		await nextTick();
		rows.value = [{ id: 'a', price: 1 }];
		await nextTick();
		await nextTick();

		expect(wrapper?.find('[data-dg-part="empty"]').exists()).toBe(false);
		expect(grid()?.attributes('aria-rowcount')).toBe('3');
	});
});

describe('GridLoading', () => {
	it('makes the grid busy while it is shown, and says so', async () => {
		const loading = shallowRef(false);

		render({ loading });
		loading.value = true;
		await nextTick();
		await nextTick();

		expect(grid()?.attributes('aria-busy')).toBe('true');
		expect(wrapper?.get('[data-dg-part="loading"]').attributes('aria-hidden')).toBe('true');
		expect(announced()).toBe('Loading…');

		loading.value = false;
		await nextTick();
		await nextTick();

		expect(grid()?.attributes('aria-busy')).toBeUndefined();
	});

	it('stands above the footer, by its height', async () => {
		const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function measure(this: HTMLElement) {
			return this.dataset.dgPart === 'foot' ? 36 : 0;
		});

		render({ loading: shallowRef(true) });
		await nextTick();

		const bar = wrapper?.get('[data-dg-part="loading"]').element as HTMLElement | undefined;

		expect(bar?.style.insetBlockEnd).toBe('36px');
		height.mockRestore();
	});
});

describe('announcements', () => {
	it('say the whole sort, and the number of selected rows', async () => {
		const { grid } = render();

		grid.state.multiSort.value = true;
		grid.scope.toggleSort('price', true);
		grid.scope.toggleSort('id', true);
		await nextTick();

		expect(announced()).toBe('Sorted by Price descending, then Id descending');

		grid.selection?.toggle('a');
		await nextTick();

		expect(announced()).toBe('1 row selected');
	});

	it('an announcement renders the live region alone, not the grid', async () => {
		let renders = 0;
		const { grid } = render({
			content: () => {
				renders += 1;

				return [renderHeader(), renderBody()];
			},
		});

		await nextTick();

		const before = renders;

		grid.selection?.toggle('a');
		await nextTick();

		expect(announced()).toBe('1 row selected');
		expect(renders).toBe(before);
	});

	it('a repeated message changes the region, so it is said again', () => {
		const { grid } = render();
		const scope = effectScope();
		const announcer = scope.run(() => useGridAnnouncer(grid)) as ReturnType<typeof useGridAnnouncer>;

		announcer.announce('Saved');
		const first = announcer.message.value;

		announcer.announce('Saved');

		expect(first).toBe('Saved');
		expect(announcer.message.value).not.toBe(first);
		expect(announcer.message.value.trim()).toBe('Saved');
		scope.stop();
	});
});

describe('messages', () => {
	it('replace the strings of every part', async () => {
		render({
			rows: [],
			messages: {
				selectAllRows: 'Выбрать все строки',
				selectRow: 'Выбрать строку',
				empty: 'Нет строк',
				resizeColumn: label => `Ширина: ${label}`,
			},
		});
		await nextTick();

		expect(wrapper?.get('[role="columnheader"] input').attributes('aria-label')).toBe('Выбрать все строки');
		expect(wrapper?.get('[data-dg-part="resize-handle"]').attributes('aria-label')).toBe('Ширина: Id');
		expect(wrapper?.get('[data-dg-part="empty"]').text()).toBe('Нет строк');
	});
});
