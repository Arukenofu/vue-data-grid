import { defineColumn, defineColumns, toCsv } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rowNumberColumn, selectionColumn, treeColumn } from '../../src/columns/service-columns';
import { TableRoot } from '../../src/components/table-root';
import { type TableBodyRow, useBodyRowContext } from '../../src/components/context';
import { TableBody } from '../../src/components/table-body';
import { TableSelectionCheckbox } from '../../src/components/table-service-parts';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';
import { selection, sorting, tree } from '../../src/data-table/factories';
import { renderBody, renderHeader } from '../support/parts';

interface Row {
	id: string;
	name: string;
	parent?: string;
}

const column = defineColumn<Row>({ sortable: true });

const columns = defineColumns({
	select: selectionColumn<Row>(),
	number: rowNumberColumn<Row>(),
	name: treeColumn(column(row => row.name, { label: 'Name', format: value => value.toUpperCase() })),
});

const rows: Row[] = [
	{ id: 'a', name: 'alpha' },
	{ id: 'b', name: 'beta', parent: 'a' },
	{ id: 'c', name: 'gamma' },
];

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	vi.restoreAllMocks();
});

function render<TTable extends DataTable<Row>>(create: () => TTable) {
	let table: TTable | null = null;

	wrapper = mount(defineComponent({
		setup() {
			table = create();

			return () => h(TableRoot, { table: table as DataTable }, { default: () => [renderHeader(), renderBody()] });
		},
	}), { attachTo: document.body });

	return table as unknown as TTable;
}

function withFeatures() {
	return useDataTable({
		columns,
		rows,
		rowKey: 'id',
		rowHeight: 30,
		sort: [{ name: 'name', direction: 'asc' }],
		features: {
			tree: tree({ parentKey: 'parent', defaultExpanded: -1 }),
			selection: selection(),
		},
	});
}

const bodyRows = () => wrapper?.findAll('[data-dg-part="body"] [role="row"]') ?? [];

describe('service columns — declarations', () => {
	it('selection and row numbers are service columns: pinned, sized, left out of CSV', () => {
		expect(columns.select).toMatchObject({ kind: 'service', pinned: 'start', width: 40 });
		expect(columns.number.kind).toBe('service');
		expect(columns.name.kind).toBe('data');
		expect(toCsv({ columns: Object.values(columns), rows })).toBe('Name\r\nALPHA\r\nBETA\r\nGAMMA');
	});

	it('the options change the place and the size, never the kind', () => {
		const custom = selectionColumn<Row>({ pinned: 'end', width: 48, label: 'Pick' });

		expect(custom).toMatchObject({ kind: 'service', pinned: 'end', width: 48, label: 'Pick' });
	});
});

describe('service columns — rendered', () => {
	it('number the rows and give the tree column its indent and toggle', () => {
		render(withFeatures);

		const [first, second, third] = bodyRows();

		expect(first.get('[data-dg-column="number"]').text()).toBe('1');
		expect(third.get('[data-dg-column="number"]').text()).toBe('3');
		expect(first.get('[data-dg-column="name"]').text()).toBe('▾ALPHA');
		expect(second.get('[data-dg-part="tree-indent"]').attributes('style')).toContain('--dg-level: 1');
		expect(second.get('[data-dg-part="tree-toggle"]').element.tagName).toBe('SPAN');
		// The top level has no indent to draw.
		expect(first.find('[data-dg-part="tree-indent"]').exists()).toBe(false);
	});

	it('a tree without groups draws neither indents nor the room of toggles', () => {
		render(() => useDataTable({
			columns,
			rows: rows.map(({ id, name }): Row => ({ id, name })),
			rowKey: 'id',
			rowHeight: 30,
			features: {
				tree: tree({ parentKey: 'parent' }),
				selection: selection(),
			},
		}));

		const names = bodyRows().map(row => row.get('[data-dg-column="name"]'));

		expect(names.map(cell => cell.text())).toEqual(['ALPHA', 'BETA', 'GAMMA']);
		expect(names.some(cell => cell.find('[data-dg-part="tree-toggle"], [data-dg-part="tree-indent"]').exists())).toBe(false);
	});

	it('the toggle collapses a group of the tree', async () => {
		render(withFeatures);

		await bodyRows()[0].get('button[data-dg-part="tree-toggle"]').trigger('click');

		expect(bodyRows().map(row => row.get('[data-dg-column="name"]').text())).toEqual(['▸ALPHA', 'GAMMA']);
	});

	it('the checkboxes select rows, a group its leaves, and the header one every row', async () => {
		const table = render(withFeatures);
		const { selection } = table;

		await bodyRows()[0].get('input').trigger('click');

		expect(selection.selectedKeys.value).toEqual(['b']);
		expect((bodyRows()[1].get('input').element as HTMLInputElement).checked).toBe(true);

		await wrapper?.get('[role="columnheader"] input').trigger('click');

		expect(selection.isAllSelected.value).toBe(true);
		expect(wrapper?.get('[role="columnheader"] input').attributes('aria-label')).toBe('Select all rows');
	});

	it('Shift+click selects the range from the last row toggled', async () => {
		const table = render(withFeatures);
		const { selection } = table;

		await bodyRows()[1].get('input').trigger('click');
		await bodyRows()[2].get('input').trigger('click', { shiftKey: true });

		expect(new Set(selection.selectedKeys.value)).toEqual(new Set(['b', 'c']));
	});

	it('a checkbox shows the selection after a click that leaves its row as it was', async () => {
		render(withFeatures);

		const box = (index: number) => bodyRows()[index].get('input').element as HTMLInputElement;

		await bodyRows()[1].get('input').trigger('click');
		await bodyRows()[2].get('input').trigger('click', { shiftKey: true });
		// The range shrinks to the anchor: `b` stays selected, though the browser unticked its box.
		await bodyRows()[1].get('input').trigger('click', { shiftKey: true });

		expect(box(1).checked).toBe(true);
		expect(box(2).checked).toBe(false);
	});

	it('the select-all checkbox stays unticked while there is nothing to select', async () => {
		render(() => useDataTable({
			columns,
			rows: [],
			rowKey: 'id',
			rowHeight: 30,
			features: { selection: selection() },
		}));

		const box = wrapper?.get('[role="columnheader"] input');

		await box?.trigger('click');

		expect(box?.element).toBeInstanceOf(HTMLInputElement);
		expect((box?.element as HTMLInputElement | undefined)?.checked).toBe(false);
	});

	it('a checkbox without the selection feature renders nothing and says why in development', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		render(() => useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30 }));
		await nextTick();

		expect(wrapper?.findAllComponents(TableSelectionCheckbox).length).toBeGreaterThan(0);
		expect(wrapper?.findAll('input')).toHaveLength(0);
		// Once for the part, not once for each row.
		expect(warn.mock.calls.filter(([message]) => String(message).includes('<TableSelectionCheckbox>'))).toHaveLength(1);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('needs the `selection` feature'));
	});
});

describe('the sort indicator', () => {
	it('keeps its place while the column is unsorted, and shows the direction once sorted', async () => {
		render(() => useDataTable({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: { sorting: sorting() },
		}));

		const indicator = () => wrapper?.get('[data-dg-column="name"] [data-dg-part="sort-indicator"]');

		expect(indicator()?.attributes('aria-hidden')).toBe('true');
		expect(indicator()?.text()).toBe('');
		expect(indicator()?.attributes('data-dg-state')).toBe('none');

		await wrapper?.get('[role="columnheader"][data-dg-column="name"]').trigger('click');

		expect(indicator()?.text()).toBe('▼');
		expect(indicator()?.attributes('data-dg-state')).toBe('desc');
		expect(wrapper?.find('[data-dg-column="select"] [data-dg-part="sort-indicator"]').exists()).toBe(false);
	});
});

describe('the selection checkbox on another element', () => {
	const custom = defineColumns({
		pick: { value: () => null, kind: 'service', cell: ({ key }) => h(TableSelectionCheckbox, { as: 'span', row: key }) },
		name: column(row => row.name),
	});

	it('takes the checkbox role and `aria-checked`, toggles on Space and leaves Enter alone', async () => {
		const table = render(() => useDataTable({
			columns: custom,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: { selection: selection() },
		}));
		const box = () => bodyRows()[0].get('[role="checkbox"]');

		expect(box().attributes()).toMatchObject({ 'aria-checked': 'false', tabindex: '0', 'data-dg-state': 'unchecked' });
		expect(box().attributes('type')).toBeUndefined();

		await box().trigger('keydown', { key: ' ' });

		expect(table.selection.isSelected('a')).toBe(true);
		expect(box().attributes()).toMatchObject({ 'aria-checked': 'true', 'data-dg-state': 'checked' });

		const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

		box().element.dispatchEvent(enter);

		expect(enter.defaultPrevented).toBe(true);
		expect(table.selection.isSelected('a')).toBe(true);
	});

	it('takes its row as a body row too, outside a `TableRow`', () => {
		wrapper = mount(defineComponent({
			setup() {
				const table = useDataTable({
					columns,
					rows,
					rowKey: 'id',
					rowHeight: 30,
					features: { selection: selection() },
				});

				return () => h(TableRoot, { table: table as DataTable }, {
					default: () => h(TableBody, null, {
						default: ({ rows: shown }: { rows: readonly TableBodyRow[] }) => shown.map(row => h(TableSelectionCheckbox, { key: row.key, row })),
					}),
				});
			},
		}), { attachTo: document.body });

		expect(wrapper.findAll('input').map(input => input.attributes('data-dg-state'))).toEqual(['unchecked', 'unchecked', 'unchecked']);
	});

	it('`useBodyRowContext` gives its fallback outside a row, and throws without one', () => {
		const results: unknown[] = [];

		mount(defineComponent({
			setup() {
				results.push(useBodyRowContext(null));

				try {
					useBodyRowContext();
				} catch (error) {
					results.push((error as Error).message);
				}

				return () => null;
			},
		})).unmount();

		expect(results).toEqual([null, 'useBodyRowContext() must be called inside <TableRow>']);
	});
});
