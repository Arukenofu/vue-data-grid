import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GridEmpty } from '../../src/components/grid-overlays';
import { GridPlaceholderRows, type PlaceholderCellSlotContext } from '../../src/components/grid-placeholder-rows';
import { GridRoot } from '../../src/components/grid-root';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';
import { renderBody, renderHeader } from '../support/parts';

interface Row {
	id: string;
	price: number;
}

const column = defineColumn<Row>();

const columns = defineColumns({
	id: column('id', { label: 'Id', width: 80, pinned: 'start' }),
	price: column('price', { label: 'Price', width: 100 }),
});

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

interface Setup {
	count?: ShallowRef<number>;
	props?: { edge?: 'top' | 'bottom'; rowHeight?: number };
	slot?: (context: PlaceholderCellSlotContext) => string;
	rows?: readonly Row[];
	rowHeight?: number;
	/** Where the part stands; by the side of its edge by default. */
	before?: boolean;
	empty?: boolean;
}

const ROWS: readonly Row[] = [{ id: 'a', price: 1 }, { id: 'b', price: 2 }];

function render(setup: Setup = {}) {
	const count = setup.count ?? shallowRef(2);
	const before = setup.before ?? setup.props?.edge === 'top';
	let grid: DataGrid | null = null;

	function renderPlaceholders() {
		return count.value > 0
			? h(GridPlaceholderRows, { count: count.value, ...setup.props }, setup.slot ? { default: setup.slot } : undefined)
			: null;
	}

	wrapper = mount(defineComponent({
		setup() {
			grid = useDataGrid({
				columns,
				rows: setup.rows ?? ROWS,
				rowKey: 'id',
				rowHeight: setup.rowHeight ?? ((row: Row) => (row.id === 'a' ? 30 : 44)),
			}) as DataGrid;

			return () => h(GridRoot, { grid: grid as DataGrid }, {
				default: () => [
					renderHeader(),
					before ? renderPlaceholders() : null,
					renderBody(),
					before ? null : renderPlaceholders(),
					setup.empty ? h(GridEmpty) : null,
				],
			});
		},
	}), { attachTo: document.body });

	return { count, grid: grid as unknown as DataGrid };
}

const placeholders = () => wrapper?.findAll('[data-dg-part="placeholder-row"]') ?? [];
const gridElement = () => wrapper?.get('[data-dg-part="grid"]');

describe('GridPlaceholderRows', () => {
	it('renders `count` rows with a cell for each column, laid out as the columns', () => {
		render();

		const rows = placeholders();
		const cells = rows[0].findAll('[data-dg-part="placeholder-cell"]');

		expect(rows).toHaveLength(2);
		expect(cells.map(cell => cell.attributes('data-dg-column'))).toEqual(['id', 'price']);
		expect(cells[0].attributes('data-dg-pinned')).toBe('start');
	});

	it('are hidden from screen readers and left out of the rows, while the grid is busy', async () => {
		const { count } = render();

		await nextTick();

		const block = wrapper?.get('[data-dg-part="placeholder-rows"]');

		expect(block?.attributes('aria-hidden')).toBe('true');
		expect(block?.find('[role]').exists()).toBe(false);
		expect(gridElement()?.attributes('aria-rowcount')).toBe('3');
		expect(gridElement()?.attributes('aria-busy')).toBe('true');

		count.value = 0;
		await nextTick();

		expect(gridElement()?.attributes('aria-busy')).toBeUndefined();
	});

	it('take the height of the row at their edge, or their own', async () => {
		render();
		expect(placeholders()[0].attributes('style')).toBe('height: 44px;');
		wrapper?.unmount();

		render({ props: { edge: 'top' } });
		expect(placeholders()[0].attributes('style')).toBe('height: 30px;');
		expect(wrapper?.get('[data-dg-part="placeholder-rows"]').attributes('data-dg-edge')).toBe('top');
		wrapper?.unmount();

		render({ props: { rowHeight: 50 } });
		expect(placeholders()[0].attributes('style')).toBe('height: 50px;');
	});

	it('take the one height of every row without rows', () => {
		render({ rows: [], rowHeight: 36 });

		expect(placeholders()[0].attributes('style')).toBe('height: 36px;');
	});

	it('draw no placeholder cell in a spacer of the column window', async () => {
		const many = defineColumns(Object.fromEntries(Array.from({ length: 30 }, (_, index) => [
			`c${index}`,
			column('price', { label: `C${index}`, width: 100 }),
		])));
		let grid: DataGrid | null = null;

		wrapper = mount(defineComponent({
			setup() {
				grid = useDataGrid({ columns: many, rows: ROWS, rowKey: 'id', rowHeight: 30, virtual: true }) as DataGrid;

				return () => h(GridRoot, { grid: grid as DataGrid }, {
					default: () => [renderBody(), h(GridPlaceholderRows, { count: 1 })],
				});
			},
		}), { attachTo: document.body });
		await nextTick();

		const cells = placeholders()[0].findAll(':scope > *');
		const spacers = cells.filter(cell => cell.attributes('data-dg-spacer') !== undefined);

		expect(spacers.length).toBeGreaterThan(0);
		expect(spacers.every(cell => cell.attributes('data-dg-part') === undefined)).toBe(true);
		expect(cells.length - spacers.length).toBe(placeholders()[0].findAll('[data-dg-part="placeholder-cell"]').length);
	});

	it('warn once they stand on the other side of the body from their edge', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		render({ props: { edge: 'top' }, before: false });
		await nextTick();

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('<GridPlaceholderRows edge="top"> belongs before <GridBody>');
		warn.mockRestore();
	});

	it('keep `GridEmpty` away while they stand for the rows on their way', async () => {
		const { count } = render({ rows: [], empty: true });

		await nextTick();
		expect(wrapper?.find('[data-dg-part="empty"]').exists()).toBe(false);

		count.value = 0;
		await nextTick();
		expect(wrapper?.find('[data-dg-part="empty"]').exists()).toBe(true);
	});

	it('render the slot in each cell with its column and the place of the row', () => {
		render({ slot: ({ column, index }) => `${column.name}:${index}` });

		expect(placeholders()[1].findAll('[data-dg-part="placeholder-cell"]').map(cell => cell.text())).toEqual(['id:1', 'price:1']);
	});
});
