import { defineColumnGroups, defineColumns, type RenderedColumn, type RenderedGroup } from '@vue-data-grid/engine';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	GridGroupCell,
	GridGroupContent,
	GridGroupRow,
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
} from '../../src/components/grid-header';
import type { CellContext, HeaderContext } from '../../src/columns/column-fields';
import { GridRoot } from '../../src/components/grid-root';
import { GridCellTemplate, GridHeaderTemplate } from '../../src/components/grid-templates';
import { renderBody, renderHeader } from '../support/parts';
import { useDataGrid } from '../../src/data-grid/use-data-grid';

interface Row {
	id: string;
	name: string;
}

const columns = defineColumns({
	handle: { value: (row: Row) => row.id, header: () => '' },
	name: { value: (row: Row) => row.name, label: 'Name' },
});

const groups = defineColumnGroups({
	tools: { children: ['handle'], header: () => '' },
	person: { children: ['name'], label: 'Person' },
});

/** A grid whose header shows content parts, as a styled header does, next to nothing else. */
const App = defineComponent({
	setup() {
		const grid = useDataGrid({ columns, groups, rows: [{ id: 'a', name: 'Ann' }], rowKey: 'id', rowHeight: 30 });

		return () => h(GridRoot, { grid, label: 'People' }, {
			default: () => h(GridHeader, null, {
				default: ({ groups: levels }: { groups: readonly (readonly RenderedGroup[])[] }) => [
					...levels.map((_cells, level) => h(GridGroupRow, { key: `level-${level}`, level }, {
						default: ({ cells }: { cells: readonly RenderedGroup[] }) => cells.map(cell => h(GridGroupCell, { key: cell.key, cell }, {
							default: () => [h(GridGroupContent)],
						})),
					})),
					h(GridHeaderRow, { key: 'columns' }, {
						default: ({ columns: shown }: { columns: readonly RenderedColumn[] }) => shown.map(column => h(GridHeaderCell, { key: column.key, column }, {
							default: () => [h(GridHeaderContent)],
						})),
					}),
				],
			}),
		});
	},
});

/** A grid with a cell and a header template of a column, before the header and the body. */
const TemplatesApp = defineComponent({
	setup() {
		const grid = useDataGrid({ columns, rows: [{ id: 'a', name: 'Ann' }], rowKey: 'id', rowHeight: 30 });

		return () => h(GridRoot, { grid, label: 'People' }, {
			default: () => [
				h(GridCellTemplate, { column: columns.name }, { default: ({ value }: CellContext<Row, string>) => h('b', value) }),
				h(GridHeaderTemplate, { column: columns.name }, { default: ({ column }: HeaderContext) => h('i', column.label) }),
				renderHeader(),
				renderBody(),
			],
		});
	},
});

afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('hydration', () => {
	it('hydrates header and group cells whose `header` field renders an empty string', async () => {
		const container = document.createElement('div');

		container.innerHTML = await renderToString(createSSRApp(App));
		document.body.append(container);

		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const app = createSSRApp(App);

		app.mount(container);

		expect(warn.mock.calls.map(call => String(call[0])).filter(message => message.includes('Hydration'))).toEqual([]);

		app.unmount();
	});

	it('leaves out on the server a template after the body in the slot of the root, and warns', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const LateApp = defineComponent({
			setup() {
				const grid = useDataGrid({ columns, rows: [{ id: 'a', name: 'Ann' }], rowKey: 'id', rowHeight: 30 });

				return () => h(GridRoot, { grid, label: 'People' }, {
					default: () => [
						renderBody(),
						h(GridCellTemplate, { column: columns.name }, { default: ({ value }: CellContext<Row, string>) => h('b', value) }),
					],
				});
			},
		});

		expect(await renderToString(createSSRApp(LateApp))).not.toContain('<b>Ann</b>');
		expect(warn.mock.calls.map(call => String(call[0])).filter(message => message.includes('came after the cells'))).toHaveLength(1);
	});

	it('warns on the server of a template inside a component of its own, after the cells it fills', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const Template = defineComponent({
			setup: () => () => h(GridCellTemplate, { column: columns.name }, { default: ({ value }: CellContext<Row, string>) => h('b', value) }),
		});
		const NestedApp = defineComponent({
			setup() {
				const grid = useDataGrid({ columns, rows: [{ id: 'a', name: 'Ann' }], rowKey: 'id', rowHeight: 30 });

				return () => h(GridRoot, { grid, label: 'People' }, { default: () => [renderBody(), h(Template)] });
			},
		});

		const html = await renderToString(createSSRApp(NestedApp));

		expect(html).not.toContain('<b>Ann</b>');
		expect(warn.mock.calls.map(call => String(call[0])).filter(message => message.includes('came after the cells'))).toHaveLength(1);
	});

	it('renders the column templates on the server, and hydrates them', async () => {
		const container = document.createElement('div');
		const html = await renderToString(createSSRApp(TemplatesApp));

		expect(html).toContain('<b>Ann</b>');
		expect(html).toContain('<i>Name</i>');

		container.innerHTML = html;
		document.body.append(container);

		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const app = createSSRApp(TemplatesApp);

		app.mount(container);

		expect(warn.mock.calls.map(call => String(call[0])).filter(message => message.includes('Hydration'))).toEqual([]);
		expect(container.querySelector('[data-dg-part="body"] b')?.textContent).toBe('Ann');

		app.unmount();
	});
});
