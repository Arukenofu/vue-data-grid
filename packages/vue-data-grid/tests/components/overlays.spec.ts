import { defineColumn, defineColumns } from '@vue-data-grid/core';
import { mount } from '@vue/test-utils';
import { defineComponent, effectScope, h, nextTick, type ShallowRef, shallowRef, type VNodeChild } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTableAnnouncer } from '../../src/announcer/use-table-announcer';
import { selectionColumn } from '../../src/columns/service-columns';
import type { TableMessages } from '../../src/components/messages';
import { TableEmpty, TableLoading } from '../../src/components/table-overlays';
import { TableRoot } from '../../src/components/table-root';
import { selection, sorting } from '../../src/data-table/factories';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';
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
	messages?: Partial<TableMessages>;
	content?: () => VNodeChild;
}

function render(setup: Setup = {}) {
	const rows = shallowRef(setup.rows ?? [{ id: 'a', price: 1 }, { id: 'b', price: 2 }]);
	let table: DataTable | null = null;

	wrapper = mount(defineComponent({
		setup() {
			table = useDataTable({
				columns,
				rows,
				rowKey: 'id',
				rowHeight: 30,
				features: {
					sorting: sorting(),
					selection: selection(),
				},
			}) as DataTable;

			return () => h(TableRoot, { table: table as DataTable, messages: setup.messages }, {
				default: setup.content ?? (() => [
					renderHeader(),
					renderBody(),
					h(TableEmpty),
					setup.loading?.value ? h(TableLoading) : null,
					renderFooter(),
				]),
			});
		},
	}), { attachTo: document.body });

	return { rows, table: table as unknown as DataTable };
}

const grid = () => wrapper?.get('[data-tc-part="table"]');
const announced = () => wrapper?.get('[data-tc-part="announcer"]').text();

describe('TableEmpty', () => {
	it('shows one row over every column while there are no rows, counted in the rows', async () => {
		render({ rows: [] });
		await nextTick();

		const empty = wrapper?.get('[data-tc-part="empty"]');

		expect(empty?.attributes()).toMatchObject({ role: 'row', 'aria-rowindex': '2' });
		expect(empty?.get('[data-tc-part="empty-cell"]').attributes()).toMatchObject({ role: 'gridcell', 'aria-colspan': '3' });
		expect(empty?.text()).toBe('No rows');
		expect(grid()?.attributes('aria-rowcount')).toBe('3');
		expect(wrapper?.get('[data-tc-part="foot"] [role="row"]').attributes('aria-rowindex')).toBe('3');
	});

	it('goes away, and stops counting, once rows come', async () => {
		const { rows } = render({ rows: [] });

		await nextTick();
		rows.value = [{ id: 'a', price: 1 }];
		await nextTick();
		await nextTick();

		expect(wrapper?.find('[data-tc-part="empty"]').exists()).toBe(false);
		expect(grid()?.attributes('aria-rowcount')).toBe('3');
	});
});

describe('TableLoading', () => {
	it('makes the table busy while it is shown, and says so', async () => {
		const loading = shallowRef(false);

		render({ loading });
		loading.value = true;
		await nextTick();
		await nextTick();

		expect(grid()?.attributes('aria-busy')).toBe('true');
		expect(wrapper?.get('[data-tc-part="loading"]').attributes('aria-hidden')).toBe('true');
		expect(announced()).toBe('Loading…');

		loading.value = false;
		await nextTick();
		await nextTick();

		expect(grid()?.attributes('aria-busy')).toBeUndefined();
	});

	it('stands above the footer, by its height', async () => {
		const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function measure(this: HTMLElement) {
			return this.dataset.tcPart === 'foot' ? 36 : 0;
		});

		render({ loading: shallowRef(true) });
		await nextTick();

		const bar = wrapper?.get('[data-tc-part="loading"]').element as HTMLElement | undefined;

		expect(bar?.style.insetBlockEnd).toBe('36px');
		height.mockRestore();
	});
});

describe('announcements', () => {
	it('say the whole sort, and the number of selected rows', async () => {
		const { table } = render();

		table.state.multiSort.value = true;
		table.scope.toggleSort('price', true);
		table.scope.toggleSort('id', true);
		await nextTick();

		expect(announced()).toBe('Sorted by Price descending, then Id descending');

		table.selection?.toggle('a');
		await nextTick();

		expect(announced()).toBe('1 row selected');
	});

	it('an announcement renders the live region alone, not the table', async () => {
		let renders = 0;
		const { table } = render({
			content: () => {
				renders += 1;

				return [renderHeader(), renderBody()];
			},
		});

		await nextTick();

		const before = renders;

		table.selection?.toggle('a');
		await nextTick();

		expect(announced()).toBe('1 row selected');
		expect(renders).toBe(before);
	});

	it('a repeated message changes the region, so it is said again', () => {
		const { table } = render();
		const scope = effectScope();
		const announcer = scope.run(() => useTableAnnouncer(table)) as ReturnType<typeof useTableAnnouncer>;

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
		expect(wrapper?.get('[data-tc-part="resize-handle"]').attributes('aria-label')).toBe('Ширина: Id');
		expect(wrapper?.get('[data-tc-part="empty"]').text()).toBe('Нет строк');
	});
});
