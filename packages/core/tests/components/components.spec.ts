import { defineColumn, defineColumnGroups, defineColumns, type RenderedColumn } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef, type VNodeChild } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TableBodyRow } from '../../src/components/context';
import { type CellSlotContext, TableBody, TableCells, TableRow } from '../../src/components/table-body';
import { TableFooter } from '../../src/components/table-footer';
import { TableGroupToggle, TableHeader, TableHeaderCell, TableHeaderRow } from '../../src/components/table-header';
import { TableRoot } from '../../src/components/table-root';
import { navigation, sorting, tree } from '../../src/data-table/factories';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';
import { renderBody, renderFooter, renderHeader } from '../support/parts';

interface Row {
	id: string;
	price: number;
	parent?: string;
}

let cellRenders = 0;

const column = defineColumn<Row>({ sortable: true });

const columns = defineColumns({
	id: column(row => row.id, { label: 'Id', sortOrder: ['asc', 'desc'] }),
	price: column(row => row.price, {
		label: 'Price',
		aggregate: 'sum',
		cell: ({ value }) => {
			cellRenders += 1;

			return `$${value}`;
		},
		footer: ({ aggregate }) => `Total ${aggregate}`,
	}),
});

const initial: Row[] = [
	{ id: 'a', price: 3 },
	{ id: 'b', price: 1 },
	{ id: 'c', price: 2 },
];

type Rows = ShallowRef<Row[]>;

/** Makes the table for a test; without features by default. */
type CreateTable = (rows: Rows) => DataTable<Row>;

const plainTable: CreateTable = rows => useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30 });

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	cellRenders = 0;
	document.body.innerHTML = '';
});

function render(content: () => VNodeChild, create: CreateTable = plainTable) {
	const rows = shallowRef(initial);

	wrapper = mount(defineComponent({
		setup() {
			const table = create(rows) as DataTable;

			return () => h(TableRoot, { table, label: 'Quotes' }, { default: content });
		},
	}), { attachTo: document.body });

	return { wrapper, rows };
}

const whole = () => [renderHeader(), renderBody(), renderFooter()];

const texts = (selector: string) => wrapper?.findAll(selector).map(element => element.text()) ?? [];

describe('table parts — composed', () => {
	it('render the whole table from the table object, roles and counts included', async () => {
		render(whole);
		// The footer row counts itself once mounted.
		await nextTick();

		const grid = wrapper?.get('[data-dg-part="table"]');

		expect(grid?.attributes()).toMatchObject({ role: 'grid', 'aria-label': 'Quotes', 'aria-rowcount': '5' });
		expect(texts('[role="columnheader"]')).toEqual(['Id', 'Price']);
		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a$3', 'b$1', 'c$2']);
		expect(texts('[data-dg-part="foot"] [role="row"]')).toEqual(['Total 6']);
		// Text of the `footer` field is on one line, as the text of body cells.
		expect(texts('[data-dg-part="foot"] [data-dg-part="cell-text"]')).toEqual(['Total 6']);
		expect(wrapper?.get('[data-dg-part="foot"] [role="row"]').attributes('aria-rowindex')).toBe('5');
	});

	it('a header click sorts, and Shift adds the column to the sort', async () => {
		render(whole, rows => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			multiSort: true,
			features: { sorting: sorting() },
		}));

		await wrapper?.findAll('[role="columnheader"]')[1].trigger('click');

		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a$3', 'c$2', 'b$1']);
		expect(wrapper?.findAll('[role="columnheader"]')[1].attributes('aria-sort')).toBe('descending');
	});

	it('a footer row stops counting once it is gone', async () => {
		const shown = shallowRef(true);

		render(() => [renderBody(), shown.value ? renderFooter() : null]);
		await nextTick();
		expect(wrapper?.get('[data-dg-part="table"]').attributes('aria-rowcount')).toBe('5');

		shown.value = false;
		await nextTick();

		expect(wrapper?.get('[data-dg-part="table"]').attributes('aria-rowcount')).toBe('4');
	});
});

describe('table parts — composition', () => {
	it('the default slot of each part gets its context and replaces its content', () => {
		render(() => [
			h(TableHeader, {}, {
				default: ({ columns: shown }: { columns: readonly RenderedColumn[] }) => `${shown.length} columns`,
			}),
			h(TableBody, {}, {
				default: ({ rows }: { rows: readonly TableBodyRow[] }) => rows.map(row => h(TableRow, { key: row.key, row }, {
					default: () => h(TableCells, null, {
						default: ({ key, value }: CellSlotContext) => `${key}=${String(value)}`,
					}),
				})),
			}),
		]);

		expect(wrapper?.get('[data-dg-part="head"]').text()).toBe('2 columns');
		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a=aa=3', 'b=bb=1', 'c=cc=2']);
	});

	it('`as` renders another element, `asChild` merges the part into its only child', () => {
		render(() => [
			h(TableHeader, { as: 'section' }),
			h(TableBody, {}, {
				default: ({ rows }: { rows: readonly TableBodyRow[] }) => rows.map(row => h(TableRow, { key: row.key, row, asChild: true }, {
					default: () => h('article', { class: 'mine', role: 'listitem' }, 'row'),
				})),
			}),
		]);

		const row = wrapper?.get('article');

		expect(wrapper?.get('section').attributes('data-dg-part')).toBe('head');
		expect(row?.attributes()).toMatchObject({ class: 'mine', role: 'listitem', 'data-dg-part': 'row', 'aria-rowindex': '2' });
	});

	it('column fields get their column, and a tree cell its node', async () => {
		const fields = defineColumns({
			id: column(row => row.id, {
				header: ({ column: own }) => `head:${own.name}`,
				cell: ({ column: own, node }) => `${own.name}:${node?.level}`,
				footer: ({ column: own }) => `foot:${own.name}`,
			}),
		});

		render(whole, rows => useDataTable({
			columns: fields,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: { tree: tree({ parentKey: 'parent' }) },
		}));
		await nextTick();

		expect(texts('[role="columnheader"]')).toEqual(['head:id']);
		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['id:0', 'id:0', 'id:0']);
		expect(texts('[data-dg-part="foot"] [role="row"]')).toEqual(['foot:id']);
	});

	it('the table refs get the root element of a component rendered through `as`', () => {
		const Box = defineComponent({
			setup: (_props, { slots }) => () => h('div', { class: 'box' }, slots.default?.()),
		});
		let table: DataTable | null = null;

		render(() => [h(TableHeader, { as: Box }), renderBody(), h(TableFooter, { as: Box })], (rows) => {
			const created = plainTable(rows);

			table = created as DataTable;

			return created;
		});

		const current = table as DataTable | null;

		expect(current?.head.value).toBeInstanceOf(HTMLElement);
		expect(current?.head.value?.getAttribute('data-dg-part')).toBe('head');
		expect(current?.foot.value?.getAttribute('data-dg-part')).toBe('foot');
	});

	it('the table takes its accessible name from `label`, else from an `aria-label` attribute', () => {
		wrapper = mount(defineComponent({
			setup() {
				const table = plainTable(shallowRef(initial)) as DataTable;

				return () => h(TableRoot, { table, 'aria-label': 'Orders' }, { default: whole });
			},
		}), { attachTo: document.body });

		expect(wrapper.get('[data-dg-part="table"]').attributes('aria-label')).toBe('Orders');
	});

	it('cells outside a row say where they belong', () => {
		expect(() => render(() => h(TableCells)))
			.toThrow('useBodyRowContext() must be called inside <TableRow>');
	});

	it('a part renders no other part by itself: its slot holds them', async () => {
		render(() => [h(TableHeader), h(TableBody), h(TableFooter)]);
		await nextTick();

		expect(wrapper?.get('[data-dg-part="head"]').element.children).toHaveLength(0);
		expect(wrapper?.get('[data-dg-part="body"]').element.children).toHaveLength(0);
		expect(wrapper?.get('[data-dg-part="table"]').attributes('aria-rowcount')).toBe('4');
	});

	it('a cell shows its own content where the slot renders nothing for it', () => {
		render(() => [
			h(TableHeader, null, {
				default: () => h(TableHeaderRow, null, {
					default: ({ columns: shown }: { columns: readonly RenderedColumn[] }) => shown.map(item => h(TableHeaderCell, { key: item.key, column: item })),
				}),
			}),
			h(TableBody, null, {
				default: ({ rows }: { rows: readonly TableBodyRow[] }) => rows.map(row => h(TableRow, { key: row.key, row }, {
					default: () => h(TableCells, { as: 'span', class: 'mine' }, {
						default: ({ column: own, value }: CellSlotContext) => (own.name === 'id' ? `#${String(value)}` : null),
					}),
				})),
			}),
		]);

		expect(texts('[role="columnheader"]')).toEqual(['Id', 'Price']);
		expect(wrapper?.find('[data-dg-part="sort-indicator"]').exists()).toBe(false);
		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['#a$3', '#b$1', '#c$2']);
		// Each cell is a plain element, with the part's attributes.
		expect(wrapper?.findAll('[data-dg-part="body"] span.mine[data-dg-column]')).toHaveLength(6);
		expect(wrapper?.findAllComponents(TableCells)).toHaveLength(3);
	});
});

describe('table parts — the row memo', () => {
	it('a new row object renders its own row again, and no other', async () => {
		const { rows } = render(whole);

		expect(cellRenders).toBe(3);

		rows.value = rows.value.map(row => (row.id === 'b' ? { ...row, price: 5 } : row));
		await nextTick();

		expect(cellRenders).toBe(4);
		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a$3', 'b$5', 'c$2']);
	});

	it('in a tree too, where the rows read their own nodes', async () => {
		const { rows } = render(whole, source => useDataTable({
			columns,
			rows: source,
			rowKey: 'id',
			rowHeight: 30,
			features: { tree: tree({ parentKey: 'parent', defaultExpanded: -1 }) },
		}));

		rows.value = [{ id: 'a', price: 3 }, { id: 'c', price: 2, parent: 'a' }, { id: 'b', price: 1 }];
		await nextTick();
		cellRenders = 0;

		rows.value = rows.value.map(row => (row.id === 'b' ? { ...row, price: 5 } : row));
		await nextTick();

		expect(cellRenders).toBe(1);
		expect(wrapper?.get('[data-dg-part="body"] [role="row"]').attributes()).toMatchObject({ 'aria-level': '1', 'aria-expanded': 'true' });
	});
});

describe('table parts — groups and navigation', () => {
	it('a group row shows its groups, and the toggle collapses one', async () => {
		const groups = defineColumnGroups({ quote: { children: ['id', 'price'], showWhen: { price: 'expanded' } } });

		render(whole, rows => useDataTable({ columns, groups, rows, rowKey: 'id', rowHeight: 30 }));

		const toggle = wrapper?.getComponent(TableGroupToggle);

		expect(toggle?.attributes()).toMatchObject({ type: 'button', 'aria-expanded': 'true', 'aria-label': 'Collapse quote' });

		await toggle?.trigger('click');

		expect(texts('[role="columnheader"][data-dg-column]')).toEqual(['Id']);
		expect(wrapper?.getComponent(TableGroupToggle).attributes()).toMatchObject({
			'aria-expanded': 'false',
			'data-dg-part': 'group-toggle',
			'data-dg-state': 'collapsed',
		});
	});

	it('a group that cannot collapse gets no toggle', () => {
		const groups = defineColumnGroups({ quote: { children: ['id', 'price'] } });

		render(whole, rows => useDataTable({ columns, groups, rows, rowKey: 'id', rowHeight: 30 }));

		expect(wrapper?.find('[data-dg-part="group-toggle"]').exists()).toBe(false);
		expect(texts('[data-dg-part="head"] [role="row"]')[0]).toBe('quote');
	});

	it('with the navigation the keys reach a group cell, and Enter collapses the group', async () => {
		const groups = defineColumnGroups({ quote: { children: ['id', 'price'], showWhen: { price: 'expanded' } } });

		render(whole, rows => useDataTable({
			columns,
			groups,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: { navigation: navigation() },
		}));

		const header = wrapper?.get('[role="columnheader"][data-dg-column="price"]').element as HTMLElement;

		header.focus();
		header.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
		await vi.waitFor(() => expect(document.activeElement?.getAttribute('data-dg-group')).toBe('quote'));

		document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await nextTick();

		expect(texts('[role="columnheader"][data-dg-column]')).toEqual(['Id']);
	});

	it('with the navigation the table takes focus first and renders the exit after itself', () => {
		render(whole, rows => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: { navigation: navigation() },
		}));

		const grid = wrapper?.get('[data-dg-part="table"]');

		expect(grid?.attributes('tabindex')).toBe('0');
		expect(grid?.element.nextElementSibling?.getAttribute('tabindex')).toBe('0');
		expect(wrapper?.findComponent(TableHeaderCell).attributes('tabindex')).toBe('-1');
	});
});

describe('table parts — the resize handle', () => {
	const resizable = defineColumns({
		id: column(row => row.id, { label: 'Id', resizable: true }),
		price: column(row => row.price, { label: 'Price' }),
	});

	it('a handle renders for a resizable column only, and a click on it does not sort', async () => {
		render(whole, rows => useDataTable({ columns: resizable, rows, rowKey: 'id', rowHeight: 30 }));

		const handles = wrapper?.findAll('[role="columnheader"] [data-dg-part="resize-handle"]') ?? [];

		expect(handles).toHaveLength(1);
		expect(handles[0].attributes()).toMatchObject({ role: 'separator', 'aria-label': 'Resize Id' });

		await handles[0].trigger('click');

		expect(wrapper?.findAll('[role="columnheader"]')[0].attributes('aria-sort')).toBeUndefined();
	});
});
