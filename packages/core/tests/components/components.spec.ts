import { defineColumn, defineColumnGroups, defineColumns, type RenderedColumn } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, nextTick, type ShallowRef, shallowRef, type VNodeChild } from 'vue';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { CellContext, FooterContext, HeaderContext } from '../../src/columns/column-fields';
import { renderCellContent } from '../../src/components/cell-content';
import {
	createDataGridContext,
	createGridTemplatesContext,
	type GridBodyRow,
	useBodyRowContext,
	useDataGridContext,
	useGridTemplatesContext,
} from '../../src/components/context';
import { GridCellTemplate, GridEditorTemplate, GridFooterTemplate, GridHeaderTemplate } from '../../src/components/grid-templates';
import {
	type CellSlotContext,
	defineGridCells,
	GridBody,
	GridCells,
	type GridCellsComponent,
	type GridCellsSlots,
	GridRow,
} from '../../src/components/grid-body';
import { GridFooter } from '../../src/components/grid-footer';
import { GridGroupToggle, GridHeader, GridHeaderCell, GridHeaderRow } from '../../src/components/grid-header';
import { GridRoot } from '../../src/components/grid-root';
import { navigation, sorting, tree } from '../../src/data-grid/factories';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';
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

/** Makes the grid for a test; without features by default. */
type CreateGrid = (rows: Rows) => DataGrid<Row>;

const plainGrid: CreateGrid = rows => useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30 });

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	cellRenders = 0;
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

function render(content: () => VNodeChild, create: CreateGrid = plainGrid) {
	const rows = shallowRef(initial);

	wrapper = mount(defineComponent({
		setup() {
			const grid = create(rows) as DataGrid;

			return () => h(GridRoot, { grid, label: 'Quotes' }, { default: content });
		},
	}), { attachTo: document.body });

	return { wrapper, rows };
}

const whole = () => [renderHeader(), renderBody(), renderFooter()];

const texts = (selector: string) => wrapper?.findAll(selector).map(element => element.text()) ?? [];

describe('grid parts — composed', () => {
	it('render the whole grid from the grid object, roles and counts included', async () => {
		render(whole);
		// The footer row counts itself once mounted.
		await nextTick();

		const grid = wrapper?.get('[data-dg-part="grid"]');

		expect(grid?.attributes()).toMatchObject({ role: 'grid', 'aria-label': 'Quotes', 'aria-rowcount': '5' });
		expect(texts('[role="columnheader"]')).toEqual(['Id', 'Price']);
		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a$3', 'b$1', 'c$2']);
		expect(texts('[data-dg-part="foot"] [role="row"]')).toEqual(['Total 6']);
		// Text of the `footer` field is on one line, as the text of body cells.
		expect(texts('[data-dg-part="foot"] [data-dg-part="cell-text"]')).toEqual(['Total 6']);
		expect(wrapper?.get('[data-dg-part="foot"] [role="row"]').attributes('aria-rowindex')).toBe('5');
	});

	it('a header click sorts, and Shift adds the column to the sort', async () => {
		render(whole, rows => useDataGrid({
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
		expect(wrapper?.get('[data-dg-part="grid"]').attributes('aria-rowcount')).toBe('5');

		shown.value = false;
		await nextTick();

		expect(wrapper?.get('[data-dg-part="grid"]').attributes('aria-rowcount')).toBe('4');
	});
});

describe('grid parts — composition', () => {
	it('the default slot of each part gets its context and replaces its content', () => {
		render(() => [
			h(GridHeader, {}, {
				default: ({ columns: shown }: { columns: readonly RenderedColumn[] }) => `${shown.length} columns`,
			}),
			h(GridBody, {}, {
				default: ({ rows }: { rows: readonly GridBodyRow[] }) => rows.map(row => h(GridRow, { key: row.key, row }, {
					default: () => h(GridCells, null, {
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
			h(GridHeader, { as: 'section' }),
			h(GridBody, {}, {
				default: ({ rows }: { rows: readonly GridBodyRow[] }) => rows.map(row => h(GridRow, { key: row.key, row, asChild: true }, {
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

		render(whole, rows => useDataGrid({
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

	it('the grid refs get the root element of a component rendered through `as`', () => {
		const Box = defineComponent({
			setup: (_props, { slots }) => () => h('div', { class: 'box' }, slots.default?.()),
		});
		let grid: DataGrid | null = null;

		render(() => [h(GridHeader, { as: Box }), renderBody(), h(GridFooter, { as: Box })], (rows) => {
			const created = plainGrid(rows);

			grid = created as DataGrid;

			return created;
		});

		const current = grid as DataGrid | null;

		expect(current?.head.value).toBeInstanceOf(HTMLElement);
		expect(current?.head.value?.getAttribute('data-dg-part')).toBe('head');
		expect(current?.foot.value?.getAttribute('data-dg-part')).toBe('foot');
	});

	it('the grid takes its accessible name from `label`, else from an `aria-label` attribute', () => {
		wrapper = mount(defineComponent({
			setup() {
				const grid = plainGrid(shallowRef(initial)) as DataGrid;

				return () => h(GridRoot, { grid, 'aria-label': 'Orders' }, { default: whole });
			},
		}), { attachTo: document.body });

		expect(wrapper.get('[data-dg-part="grid"]').attributes('aria-label')).toBe('Orders');
	});

	it('cells outside a row say where they belong', () => {
		expect(() => render(() => h(GridCells)))
			.toThrow('useBodyRowContext() must be called inside <GridRow>');
	});

	it('a part renders no other part by itself: its slot holds them', async () => {
		render(() => [h(GridHeader), h(GridBody), h(GridFooter)]);
		await nextTick();

		expect(wrapper?.get('[data-dg-part="head"]').element.children).toHaveLength(0);
		expect(wrapper?.get('[data-dg-part="body"]').element.children).toHaveLength(0);
		expect(wrapper?.get('[data-dg-part="grid"]').attributes('aria-rowcount')).toBe('4');
	});

	it('a cell shows its own content where the slot renders nothing for it', () => {
		render(() => [
			h(GridHeader, null, {
				default: () => h(GridHeaderRow, null, {
					default: ({ columns: shown }: { columns: readonly RenderedColumn[] }) => shown.map(item => h(GridHeaderCell, { key: item.key, column: item })),
				}),
			}),
			h(GridBody, null, {
				default: ({ rows }: { rows: readonly GridBodyRow[] }) => rows.map(row => h(GridRow, { key: row.key, row }, {
					default: () => h(GridCells, { as: 'span', class: 'mine' }, {
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
		expect(wrapper?.findAllComponents(GridCells)).toHaveLength(3);
	});
});

describe('grid parts — the row memo', () => {
	it('a new row object renders its own row again, and no other', async () => {
		const { rows } = render(whole);

		expect(cellRenders).toBe(3);

		rows.value = rows.value.map(row => (row.id === 'b' ? { ...row, price: 5 } : row));
		await nextTick();

		expect(cellRenders).toBe(4);
		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a$3', 'b$5', 'c$2']);
	});

	it('in a tree too, where the rows read their own nodes', async () => {
		const { rows } = render(whole, source => useDataGrid({
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

describe('grid parts — cells with a slot for each column', () => {
	function renderSlotted(slots: Record<string, (context: CellSlotContext) => VNodeChild>) {
		return () => h(GridBody, {}, {
			default: ({ rows }: { rows: readonly GridBodyRow[] }) => rows.map(row => h(GridRow, { key: row.key, row }, {
				default: () => h(GridCells, null, slots),
			})),
		});
	}

	it('render a column with its slot, the other cells with the default slot, then their own content', () => {
		render(renderSlotted({
			id: ({ value }) => `id:${String(value)}`,
			price: ({ value }) => (value === 1 ? null : `p:${String(value)}`),
			default: ({ column: own }) => (own.name === 'price' ? 'default' : null),
		}));

		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['id:ap:3', 'id:bdefault', 'id:cp:2']);
	});

	it('a column named `_` renders its own content next to the flags of compiled slots', () => {
		const flagged = defineColumns({ _: { value: (row: Row) => row.id } });

		render(() => h(GridBody, {}, {
			default: ({ rows }: { rows: readonly GridBodyRow[] }) => rows.map(row => h(GridRow, { key: row.key, row }, {
				// Compiled slots carry their flags under `_`.
				default: () => h(GridCells, null, { default: () => null, _: 1 }),
			})),
		}), rows => useDataGrid({ columns: flagged, rows, rowKey: 'id', rowHeight: 30 }) as DataGrid<Row>);

		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a', 'b', 'c']);
	});

	it('`defineGridCells` gives `GridCells`, typed by the columns', () => {
		const Cells = defineGridCells(columns);
		type Slots = GridCellsSlots<typeof columns>;

		expect(Cells).toBe(GridCells);
		expectTypeOf(Cells).toEqualTypeOf<GridCellsComponent<typeof columns>>();
		expectTypeOf<Parameters<NonNullable<Slots['id']>>[0]>().toEqualTypeOf<CellContext<Row, string>>();
		expectTypeOf<Parameters<NonNullable<Slots['price']>>[0]>().toEqualTypeOf<CellContext<Row, number>>();
		expectTypeOf<Parameters<NonNullable<Slots['default']>>[0]>().toEqualTypeOf<CellContext<Row, unknown>>();
		// @ts-expect-error: no column has that name.
		expectTypeOf<Slots['nothing']>();
		// @ts-expect-error: a list of columns has no names to type the slots by.
		expect(defineGridCells(Object.values(columns))).toBe(GridCells);
	});
});

describe('grid parts — column templates', () => {
	const templates = (price: () => VNodeChild = () => 'template') => [
		h(GridCellTemplate, { column: columns.id }, { default: ({ value, key }: CellContext<Row, string>) => `${key}:${value}` }),
		h(GridCellTemplate, { column: columns.price }, { default: price }),
		h(GridHeaderTemplate, { column: columns.price }, { default: ({ column: own }: HeaderContext) => `head:${own.name}` }),
		h(GridFooterTemplate, { column: columns.price }, {
			default: ({ aggregate }: FooterContext<Row, number | null>) => `sum:${aggregate}`,
		}),
	];

	const lateWarnings = (warn: { mock: { calls: unknown[][] } }) => warn.mock.calls
		.map(call => String(call[0]))
		.filter(message => message.includes('came after the cells'));

	it('render the cells, the header and the footer of their column', async () => {
		render(() => [...templates(), ...whole()]);
		await nextTick();

		expect(texts('[role="columnheader"]')).toEqual(['Id', 'head:price']);
		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a:atemplate', 'b:btemplate', 'c:ctemplate']);
		expect(texts('[data-dg-part="foot"] [role="row"]')).toEqual(['sum:6']);
	});

	it('a template that renders nothing leaves the column\'s own content, and the slot of a part comes first', () => {
		render(() => [
			...templates(() => null),
			h(GridBody, {}, {
				default: ({ rows }: { rows: readonly GridBodyRow[] }) => rows.map(row => h(GridRow, { key: row.key, row }, {
					default: () => h(GridCells, null, {
						default: ({ column: own }: CellSlotContext) => (own.name === 'id' ? 'slot' : null),
					}),
				})),
			}),
		]);

		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['slot$3', 'slot$1', 'slot$2']);
	});

	it('a template after the body fills its cells once mounted, and warns that a server render misses it', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		render(() => [renderBody(), templates()]);
		await nextTick();

		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a:atemplate', 'b:btemplate', 'c:ctemplate']);
		expect(lateWarnings(warn)).toEqual([
			expect.stringContaining('<GridCellTemplate> of column "id"'),
			expect.stringContaining('<GridCellTemplate> of column "price"'),
		]);
	});

	it('a template inside a component of its own before the body warns of nothing', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const Templates = defineComponent({ setup: () => () => templates() });

		render(() => [h(Templates), renderBody()]);

		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a:atemplate', 'b:btemplate', 'c:ctemplate']);
		expect(warn).not.toHaveBeenCalled();
	});

	it('a render of the root with stable slots of its templates renders no row again', async () => {
		const tick = shallowRef(0);
		let calls = 0;

		render(() => [
			h('span', { class: 'tick' }, tick.value),
			h(GridCellTemplate, { column: columns.id }, {
				default: ({ value }: CellContext<Row, string>) => {
					calls += 1;

					return value;
				},
				$stable: true,
			}),
			renderBody(),
		]);

		const before = calls;

		tick.value += 1;
		await nextTick();

		expect(wrapper?.get('.tick').text()).toBe('1');
		expect(calls).toBe(before);
	});

	it('a slot that reads the render around it renders the cells of its column again when that changes', async () => {
		const label = shallowRef('old');

		render(() => {
			const captured = label.value;

			return [
				h(GridCellTemplate, { column: columns.id }, { default: ({ value }: CellContext<Row, string>) => `${captured}:${value}` }),
				h(GridHeaderTemplate, { column: columns.id }, { default: () => `head-${captured}` }),
				renderHeader(),
				renderBody(),
			];
		});

		label.value = 'new';
		await nextTick();

		expect(texts('[data-dg-part="body"] [data-dg-column="id"]')).toEqual(['new:a', 'new:b', 'new:c']);
		expect(texts('[role="columnheader"]')[0]).toBe('head-new');
	});

	it('a `v-if` that swaps two templates of a column renders the one shown', async () => {
		const compact = shallowRef(true);

		render(() => [
			compact.value
				? h(GridCellTemplate, { key: 'short', column: columns.price }, { default: () => 'short' })
				: h(GridCellTemplate, { key: 'long', column: columns.price }, { default: () => 'long' }),
			renderBody(),
		]);

		compact.value = false;
		await nextTick();

		expect(texts('[data-dg-part="body"] [data-dg-column="price"]')).toEqual(['long', 'long', 'long']);
	});

	it('templates that swap their columns fill the columns they stand for now', async () => {
		const swapped = shallowRef(false);

		render(() => [
			h(GridCellTemplate, { key: 'one', column: swapped.value ? columns.price : columns.id }, { default: () => 'one' }),
			h(GridCellTemplate, { key: 'two', column: swapped.value ? columns.id : columns.price }, { default: () => 'two' }),
			renderBody(),
		]);

		swapped.value = true;
		await nextTick();

		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['twoone', 'twoone', 'twoone']);
	});

	it('of two templates of a column the first one renders, with a warning, and the second takes over when it goes', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const first = shallowRef(true);
		const Second = defineComponent({
			setup: () => () => h(GridCellTemplate, { column: columns.id }, { default: () => 'second' }),
		});

		render(() => [
			first.value ? h(GridCellTemplate, { column: columns.id }, { default: () => 'first' }) : null,
			h(Second),
			renderBody(),
		]);

		expect(texts('[data-dg-part="body"] [data-dg-column="id"]')).toEqual(['first', 'first', 'first']);
		expect(warn.mock.calls.map(call => String(call[0])).filter(message => message.includes('two <GridCellTemplate>'))).toHaveLength(1);

		first.value = false;
		await nextTick();

		expect(texts('[data-dg-part="body"] [data-dg-column="id"]')).toEqual(['second', 'second', 'second']);
	});

	it('a template kept by `KeepAlive` fills its column only while it is shown', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		const First = defineComponent({ setup: () => () => h(GridCellTemplate, { column: columns.id }, { default: () => 'A' }) });
		const Second = defineComponent({ setup: () => () => h(GridCellTemplate, { column: columns.id }, { default: () => 'B' }) });
		const shown = shallowRef<typeof First>(First);

		render(() => [h(KeepAlive, null, { default: () => h(shown.value) }), renderBody()]);

		shown.value = Second;
		await nextTick();

		expect(texts('[data-dg-part="body"] [data-dg-column="id"]')).toEqual(['B', 'B', 'B']);

		shown.value = First;
		await nextTick();

		expect(texts('[data-dg-part="body"] [data-dg-column="id"]')).toEqual(['A', 'A', 'A']);
	});

	it('a template that comes and goes after the grid mounted fills its cells and warns of nothing', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const shown = shallowRef(false);

		render(() => [shown.value ? templates() : null, renderBody()]);
		await nextTick();

		shown.value = true;
		await nextTick();

		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a:atemplate', 'b:btemplate', 'c:ctemplate']);
		expect(warn).not.toHaveBeenCalled();

		shown.value = false;
		await nextTick();

		expect(texts('[data-dg-part="body"] [role="row"]')).toEqual(['a$3', 'b$1', 'c$2']);
	});

	it('a column marked `tree` without `treeColumn()` renders its template', () => {
		const marked = defineColumns({ id: { value: (row: Row) => row.id, tree: true } });

		render(
			() => [h(GridCellTemplate, { column: marked.id }, { default: () => 'T' }), renderBody()],
			rows => useDataGrid({ columns: marked, rows, rowKey: 'id', rowHeight: 30 }) as DataGrid<Row>,
		);

		expect(texts('[data-dg-part="body"] [data-dg-column="id"]')).toEqual(['T', 'T', 'T']);
	});

	it('a template outside a grid with templates throws an error that names the fix', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		expect(() => mount(() => h(GridCellTemplate, { column: columns.id }, { default: () => 'x' }))).toThrow(
			'<GridCellTemplate> must be inside <GridRoot>, or a root of your own that calls createGridTemplatesContext()',
		);
	});

	it('a root of your own takes templates with `createGridTemplatesContext`, and without it does not reach those of a grid around', () => {
		const rows = shallowRef(initial);

		function ownRoot(withTemplates: boolean) {
			return defineComponent({
				setup(_props, { slots }) {
					createDataGridContext(useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30 }) as DataGrid);

					if (withTemplates) {
						createGridTemplatesContext();
					}

					return () => h('div', { class: withTemplates ? 'with' : 'without' }, slots.default?.());
				},
			});
		}

		const With = ownRoot(true);
		const Without = ownRoot(false);

		render(() => [
			h(GridCellTemplate, { column: columns.id }, { default: () => 'outer' }),
			h(With, null, { default: () => [h(GridCellTemplate, { column: columns.id }, { default: () => 'own' }), renderBody()] }),
			h(Without, null, { default: () => renderBody() }),
		]);

		expect(texts('.with [data-dg-column="id"]')).toEqual(['own', 'own', 'own']);
		expect(texts('.without [data-dg-column="id"]')).toEqual(['a', 'b', 'c']);
	});

	it('the slot of a template is typed by its column', () => {
		expectTypeOf(GridCellTemplate).toBeFunction();
		// Not called: the check is of the types vue-tsc gives a template.
		const check = () => [
			GridCellTemplate({ column: columns.price }, {
				attrs: {},
				emit: () => undefined,
				slots: { default: context => expectTypeOf(context).toEqualTypeOf<CellContext<Row, number>>() },
			}),
			GridFooterTemplate({ column: columns.price }, {
				attrs: {},
				emit: () => undefined,
				slots: { default: ({ aggregate }) => expectTypeOf(aggregate).toEqualTypeOf<number | null>() },
			}),
			GridEditorTemplate({ column: columns.id }, {
				attrs: {},
				emit: () => undefined,
				slots: { default: ({ draft }) => expectTypeOf(draft).toEqualTypeOf<string>() },
			}),
			// @ts-expect-error: the values of `price` are numbers, not the strings the slot takes.
			GridCellTemplate({ column: columns.price }, {
				attrs: {},
				emit: () => undefined,
				slots: { default: (context: CellContext<Row, string>) => context.value },
			}),
			GridEditorTemplate({ column: columns.price }, {
				attrs: {},
				emit: () => undefined,
				// @ts-expect-error: the draft of `price` is a number.
				slots: { default: ({ setDraft }) => setDraft('x') },
			}),
		];

		expect(check).toBeTypeOf('function');
	});
});

describe('cell content', () => {
	it('a part of your own renders the content of cells as `GridCells` does, with `renderCellContent`', () => {
		const OwnCells = defineComponent({
			setup() {
				const grid = useDataGridContext();
				const templates = useGridTemplatesContext(null);
				const row = useBodyRowContext();

				return () => grid.scope.renderedColumns.value.map(({ key, column: own }) => {
					const current = row();

					if (!own) {
						return null;
					}

					const context = { row: current.original, value: own.value(current.original), key: current.key, index: current.index, column: own };

					const slotContent = current.key === 'a' && own.name === 'id' ? 'own' : null;

					return h('span', { key, class: 'own' }, [renderCellContent(context, templates, slotContent)]);
				});
			},
		});

		render(() => [
			h(GridCellTemplate, { column: columns.id }, { default: ({ key }: CellContext<Row, string>) => (key === 'c' ? 'template' : null) }),
			h(GridBody, null, {
				default: ({ rows }: { rows: readonly GridBodyRow[] }) => rows.map(row => h(GridRow, { key: row.key, row }, { default: () => h(OwnCells) })),
			}),
		]);

		expect(texts('.own')).toEqual(['own', '$3', 'b', '$1', 'template', '$2']);
	});

	it('the `cellFrame` of the column goes around the content of a cell, whichever gives it', () => {
		const framed = defineColumns({
			id: { value: (row: Row) => row.id, cellFrame: (_context, content) => ['[', content, ']'] },
		});

		render(() => [
			h(GridCellTemplate, { column: framed.id }, { default: ({ key }: CellContext<Row, string>) => (key === 'b' ? 'template' : null) }),
			h(GridBody, null, {
				default: ({ rows }: { rows: readonly GridBodyRow[] }) => rows.map(row => h(GridRow, { key: row.key, row }, {
					default: () => h(GridCells, null, { default: ({ key }: CellSlotContext) => (key === 'a' ? 'slot' : null) }),
				})),
			}),
		], rows => useDataGrid({ columns: framed, rows, rowKey: 'id', rowHeight: 30 }) as DataGrid<Row>);

		expect(texts('[data-dg-part="body"] [data-dg-column="id"]')).toEqual(['[slot]', '[template]', '[c]']);
	});
});

describe('grid parts — groups and navigation', () => {
	it('a group row shows its groups, and the toggle collapses one', async () => {
		const groups = defineColumnGroups({ quote: { children: ['id', 'price'], showWhen: { price: 'expanded' } } });

		render(whole, rows => useDataGrid({ columns, groups, rows, rowKey: 'id', rowHeight: 30 }));

		const toggle = wrapper?.getComponent(GridGroupToggle);

		expect(toggle?.attributes()).toMatchObject({ type: 'button', 'aria-expanded': 'true', 'aria-label': 'Collapse quote' });

		await toggle?.trigger('click');

		expect(texts('[role="columnheader"][data-dg-column]')).toEqual(['Id']);
		expect(wrapper?.getComponent(GridGroupToggle).attributes()).toMatchObject({
			'aria-expanded': 'false',
			'data-dg-part': 'group-toggle',
			'data-dg-state': 'collapsed',
		});
	});

	it('a group that cannot collapse gets no toggle', () => {
		const groups = defineColumnGroups({ quote: { children: ['id', 'price'] } });

		render(whole, rows => useDataGrid({ columns, groups, rows, rowKey: 'id', rowHeight: 30 }));

		expect(wrapper?.find('[data-dg-part="group-toggle"]').exists()).toBe(false);
		expect(texts('[data-dg-part="head"] [role="row"]')[0]).toBe('quote');
	});

	it('with the navigation the keys reach a group cell, and Enter collapses the group', async () => {
		const groups = defineColumnGroups({ quote: { children: ['id', 'price'], showWhen: { price: 'expanded' } } });

		render(whole, rows => useDataGrid({
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

	it('with the navigation the grid takes focus first and renders the exit after itself', () => {
		render(whole, rows => useDataGrid({
			columns,
			rows,
			rowKey: 'id',
			rowHeight: 30,
			features: { navigation: navigation() },
		}));

		const grid = wrapper?.get('[data-dg-part="grid"]');

		expect(grid?.attributes('tabindex')).toBe('0');
		expect(grid?.element.nextElementSibling?.getAttribute('tabindex')).toBe('0');
		expect(wrapper?.findComponent(GridHeaderCell).attributes('tabindex')).toBe('-1');
	});
});

describe('grid parts — the resize handle', () => {
	const resizable = defineColumns({
		id: column(row => row.id, { label: 'Id', resizable: true }),
		price: column(row => row.price, { label: 'Price' }),
	});

	it('a handle renders for a resizable column only, and a click on it does not sort', async () => {
		render(whole, rows => useDataGrid({ columns: resizable, rows, rowKey: 'id', rowHeight: 30 }));

		const handles = wrapper?.findAll('[role="columnheader"] [data-dg-part="resize-handle"]') ?? [];

		expect(handles).toHaveLength(1);
		expect(handles[0].attributes()).toMatchObject({ role: 'separator', 'aria-label': 'Resize Id' });

		await handles[0].trigger('click');

		expect(wrapper?.findAll('[role="columnheader"]')[0].attributes('aria-sort')).toBeUndefined();
	});
});
