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
import { GridRoot } from '../../src/components/grid-root';
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
