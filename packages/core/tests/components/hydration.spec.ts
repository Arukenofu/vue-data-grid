import { defineColumnGroups, defineColumns, type RenderedColumn, type RenderedGroup } from '@vue-data-grid/engine';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	TableGroupCell,
	TableGroupContent,
	TableGroupRow,
	TableHeader,
	TableHeaderCell,
	TableHeaderContent,
	TableHeaderRow,
} from '../../src/components/table-header';
import { TableRoot } from '../../src/components/table-root';
import { useDataTable } from '../../src/data-table/use-data-table';

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

/** A table whose header shows content parts, as a styled header does, next to nothing else. */
const App = defineComponent({
	setup() {
		const table = useDataTable({ columns, groups, rows: [{ id: 'a', name: 'Ann' }], rowKey: 'id', rowHeight: 30 });

		return () => h(TableRoot, { table, label: 'People' }, {
			default: () => h(TableHeader, null, {
				default: ({ groups: levels }: { groups: readonly (readonly RenderedGroup[])[] }) => [
					...levels.map((_cells, level) => h(TableGroupRow, { key: `level-${level}`, level }, {
						default: ({ cells }: { cells: readonly RenderedGroup[] }) => cells.map(cell => h(TableGroupCell, { key: cell.key, cell }, {
							default: () => [h(TableGroupContent)],
						})),
					})),
					h(TableHeaderRow, { key: 'columns' }, {
						default: ({ columns: shown }: { columns: readonly RenderedColumn[] }) => shown.map(column => h(TableHeaderCell, { key: column.key, column }, {
							default: () => [h(TableHeaderContent)],
						})),
					}),
				],
			}),
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
});
