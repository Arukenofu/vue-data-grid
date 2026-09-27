import type { DragAutoScroll } from '@vue-data-grid/drag-and-drop';
import { defineColumn, defineColumns, moveRow } from '@vue-data-grid/core';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type ShallowRef, shallowRef, toValue, type VNodeChild } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDataTableContext } from '../../src/components/context';
import { TableRoot } from '../../src/components/table-root';
import { useTableMotion } from '../../src/motion/use-table-motion';
import { sorting, tree } from '../../src/data-table/factories';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';
import { dragHandleColumn } from '../../src/drag/drag-handle-column';
import { createPreviewHolder } from '../../src/drag/shared';
import { TableColumnDrag, TableRowDrag } from '../../src/drag/table-drag';
import {
	TableDragOverlay,
	type TableDragOverlayContext,
	TableDragPreview,
	TableDropZone,
	type TableDropZoneEvent,
	type TableDropZoneSlotContext,
} from '../../src/drag/table-drag-parts';
import type { TableRowDropEvent } from '../../src/drag/use-table-row-drag';
import { at, key, place, placeTable, pointer, stubFrames, stubLayout } from '../support/drag';
import { renderBody, renderHeader } from '../support/parts';

interface Task {
	id: string;
	name: string;
	parent?: string | null;
}

const column = defineColumn<Task>({ movable: true });

const plain = defineColumns({
	name: column(row => row.name, { label: 'Name' }),
	id: column(row => row.id, { label: 'Id' }),
	fixed: column(row => row.id, { label: 'Fixed', movable: false }),
});

const withHandles = defineColumns({ drag: dragHandleColumn<Task>(), ...plain });

const tasks: Task[] = [
	{ id: 'a', name: 'Alpha' },
	{ id: 'b', name: 'Beta' },
	{ id: 'c', name: 'Gamma' },
	{ id: 'd', name: 'Delta' },
];

interface Setup {
	rows?: Task[];
	handle?: boolean;
	group?: string;
	sorted?: boolean;
	tree?: boolean;
	canDrag?: (row: Task) => boolean;
	columns?: boolean;
	preview?: (context: { key: string; row: unknown }) => VNodeChild;
	extra?: () => VNodeChild;
	/** Rendered inside the row drag, next to the body. */
	inRows?: () => VNodeChild;
	/** Rendered inside the column drag, next to the header. */
	inColumns?: () => VNodeChild;
	bounds?: 'table' | 'window';
	left?: number;
	/** The table animates its order with `useTableMotion`. */
	motion?: boolean;
	/** What inside a row never starts a drag. */
	ignore?: string;
	autoScroll?: DragAutoScroll | false;
}

const wrappers: ReturnType<typeof mount>[] = [];

let frames: ReturnType<typeof stubFrames>;

function setup(options: Setup = {}) {
	const rows: ShallowRef<Task[]> = shallowRef(options.rows ?? tasks);
	const drops: TableRowDropEvent<unknown>[] = [];
	const columnDrops: unknown[] = [];
	let table: DataTable | null = null;
	const host = document.createElement('div');

	document.body.append(host);

	const wrapper = mount(defineComponent({
		setup() {
			table = useDataTable({
				columns: options.handle ? withHandles : plain,
				rows,
				rowKey: 'id',
				rowHeight: 30,
				sort: options.sorted ? [{ name: 'name', direction: 'desc' }] : undefined,
				features: {
					sorting: sorting(),
					tree: options.tree ? tree({ parentKey: 'parent', defaultExpanded: -1 }) : undefined,
				},
			}) as DataTable;

			if (options.motion) {
				useTableMotion(table);
			}

			return () => h(TableRoot, { table: table as DataTable }, {
				default: () => [
					options.columns
						? h(TableColumnDrag, { animation: false, onDrop: (event: unknown) => columnDrops.push(event) }, {
							default: () => [renderHeader(), options.inColumns?.()],
						})
						: renderHeader(),
					h(TableRowDrag, {
						handle: options.handle ?? false,
						...(options.group ? { group: options.group } : {}),
						...(options.canDrag ? { canDrag: options.canDrag as (row: unknown) => boolean } : {}),
						...(options.bounds ? { bounds: options.bounds } : {}),
						...(options.ignore ? { ignore: options.ignore } : {}),
						...(options.autoScroll === undefined ? {} : { autoScroll: options.autoScroll }),
						animation: false,
						onDrop: (event: TableRowDropEvent<unknown>) => {
							drops.push(event);
							rows.value = moveRow(rows.value, event as TableRowDropEvent<Task>, { rowKey: 'id', parentKey: 'parent' });
						},
					}, {
						default: () => [
							renderBody(),
							options.preview ? h(TableDragPreview, null, { default: options.preview }) : null,
							options.inRows?.(),
						],
					}),
					options.extra?.(),
				],
			});
		},
	}), { attachTo: host });

	wrappers.push(wrapper);

	const root = wrapper.get('[data-tc-part="table"]').element;

	placeTable(root, options.left);

	const row = (id: string) => root.querySelector(`[data-tc-part="row"][data-tc-index="${rows.value.findIndex(item => item.id === id)}"]`) as HTMLElement;
	const header = (name: string) => root.querySelector(`[role="columnheader"][data-tc-column="${name}"]`) as HTMLElement;
	const names = () => rows.value.map(item => item.id);

	return { table: table as unknown as DataTable, rows, drops, columnDrops, root, row, header, names };
}

/** Drags from one element to a point, frame by frame, and releases there. */
function drag(from: Element, to: { x: number; y: number }, start = at(from)) {
	pointer('pointerdown', from, start);
	pointer('pointermove', window, { x: start.x, y: start.y + 8 });
	frames.run();
	pointer('pointermove', window, to);
	frames.run();
	pointer('pointerup', window, to);
}

beforeEach(() => {
	stubLayout();
	frames = stubFrames();
});

afterEach(() => {
	pointer('pointercancel', window, { x: 0, y: 0 });
	wrappers.splice(0).forEach(wrapper => wrapper.unmount());
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('row drag — the pointer', () => {
	it('drops a row where it goes, with the row and the table it comes from', async () => {
		const { table, drops, row, names } = setup();

		drag(row('a'), at(row('d'), 0.25));
		await nextTick();

		expect(drops).toEqual([expect.objectContaining({ key: 'a', parent: null, index: 2, external: false })]);
		expect(drops[0].row).toEqual(tasks[0]);
		expect(drops[0].source).toBe(table);
		expect(names()).toEqual(['b', 'c', 'a', 'd']);
	});

	it('does not drag while the rows are sorted: the order is the sort’s', () => {
		const { drops, row, root } = setup({ sorted: true });

		expect(root.querySelectorAll('[data-tc-part="row"][data-tc-draggable]')).toHaveLength(0);

		drag(row('a'), at(row('d'), 0.25));

		expect(drops).toEqual([]);
	});

	it('leaves a row alone that `canDrag` refuses, and its handle says so', async () => {
		const { drops, row } = setup({ handle: true, canDrag: task => task.id !== 'b' });

		await nextTick();

		expect(row('b').hasAttribute('data-tc-draggable')).toBe(false);
		expect(row('b').querySelector('[data-tc-part="drag-handle"]')?.hasAttribute('data-tc-disabled')).toBe(true);
		expect(row('a').getAttribute('data-tc-draggable')).toBe('steps');

		const handle = row('b').querySelector('[data-tc-part="drag-handle"]') as HTMLElement;

		drag(handle, at(row('d'), 0.75), at(row('b')));

		expect(drops).toEqual([]);
	});

	it('asks `canDrag` of the changed row alone when the data changes, not of every row', async () => {
		const canDrag = vi.fn((task: Task) => task.id !== 'c');
		const { rows } = setup({ handle: true, canDrag });

		await nextTick();
		canDrag.mockClear();
		rows.value = rows.value.map(task => (task.id === 'b' ? { ...task, name: 'Bravo' } : task));
		await nextTick();

		expect(canDrag).toHaveBeenCalled();
		expect(new Set(canDrag.mock.calls.map(([task]) => task.id))).toEqual(new Set(['b']));
	});

	it('takes `ignore` on top of the controls: a press there never starts a drag', () => {
		const { drops, row } = setup({ ignore: '.note' });
		const note = document.createElement('span');

		note.className = 'note';
		row('a').querySelector('[data-tc-column="name"]')?.append(note);
		place(note, { left: 0, top: 30, right: 50, bottom: 60 });
		drag(note, at(row('d'), 0.25));

		expect(drops).toEqual([]);
	});

	it('drops inside a group of a tree, and gives the row its new parent', async () => {
		const { drops, row, rows } = setup({
			tree: true,
			rows: [
				{ id: 'folder', name: 'Folder', parent: null },
				{ id: 'inner', name: 'Inner', parent: 'folder' },
				{ id: 'loose', name: 'Loose', parent: null },
			],
		});

		drag(row('loose'), at(row('folder'), 0.5));
		await nextTick();

		expect(drops).toEqual([expect.objectContaining({ key: 'loose', parent: 'folder', index: 0 })]);
		expect(rows.value.find(item => item.id === 'loose')?.parent).toBe('folder');
	});
});

describe('row drag — scrolling', () => {
	/** The table's root scrolls: `scrollBy` moves its `scrollTop`. */
	function scrollable(root: Element) {
		let top = 0;

		Object.defineProperty(root, 'scrollTop', { configurable: true, get: () => top });
		(root as HTMLElement).scrollBy = ((_x: number, y: number) => {
			top = Math.max(top + y, 0);
		}) as HTMLElement['scrollBy'];

		return () => top;
	}

	function dragNearBottom(from: Element) {
		const start = at(from);

		pointer('pointerdown', from, start);
		pointer('pointermove', window, { x: start.x, y: 590 });

		for (let frame = 0; frame < 5; frame += 1) {
			frames.run();
		}
	}

	it('scrolls the table near its bottom edge as `autoScroll` says', () => {
		const { root, row } = setup({ autoScroll: { threshold: 40, speed: 1000, curve: depth => depth } });
		const top = scrollable(root);

		dragNearBottom(row('a'));

		// 30 px into a 40 px zone: 750 px/s, for four frames of 16 ms after the first.
		expect(top()).toBe(48);
	});

	it('scrolls nothing with `autoScroll` off', () => {
		const { root, row } = setup({ autoScroll: false });
		const top = scrollable(root);

		dragNearBottom(row('a'));

		expect(top()).toBe(0);
	});
});

describe('row drag — a group of a tree', () => {
	const tree = [
		{ id: 'folder', name: 'Folder', parent: null },
		{ id: 'inner', name: 'Inner', parent: 'folder' },
		{ id: 'other', name: 'Other', parent: 'folder' },
		{ id: 'loose', name: 'Loose', parent: null },
	];

	/** A row by where it is shown: in a tree that is not where it is in the data. */
	function shownRow(table: DataTable, root: Element, id: string) {
		return root.querySelector(`[data-tc-part="row"][data-tc-index="${table.scope.getRowIndex(id)}"]`) as HTMLElement;
	}

	it('closes while it is dragged, and opens again at its new place', async () => {
		const { table, root, drops } = setup({ tree: true, rows: tree });
		const shown = () => table.scope.rowKeys.value;
		const row = (id: string) => shownRow(table, root, id);
		const start = at(row('folder'));

		pointer('pointerdown', row('folder'), start);
		pointer('pointermove', window, { x: start.x, y: start.y + 8 });
		frames.run();
		await nextTick();
		placeTable(root);

		expect(shown()).toEqual(['folder', 'loose']);

		pointer('pointermove', window, at(row('loose'), 0.75));
		frames.run();
		pointer('pointerup', window, at(row('loose'), 0.75));
		await nextTick();

		expect(drops).toEqual([expect.objectContaining({ key: 'folder', parent: null, index: 1 })]);
		expect(shown()).toEqual(['loose', 'folder', 'inner', 'other']);
	});

	it('leaves a group closed by the user closed', async () => {
		const { table, root } = setup({ tree: true, rows: tree });
		const row = (id: string) => shownRow(table, root, id);

		table.tree?.setExpanded('folder', false);
		await nextTick();
		drag(row('folder'), at(row('loose'), 0.75));
		await nextTick();

		expect(table.tree?.isExpanded('folder')).toBe(false);
	});
});

describe('row drag — the keyboard', () => {
	it('picks a row up on its handle, moves it with the arrows and drops it', async () => {
		const { drops, row, names } = setup({ handle: true });
		const handle = row('a').querySelector('[data-tc-part="drag-handle"]') as HTMLElement;

		expect(handle.getAttribute('aria-label')).toBe('Drag Alpha');
		expect(handle.getAttribute('aria-describedby')).toBeTruthy();

		handle.focus();
		key(handle, ' ');
		key(handle, 'ArrowDown');
		key(handle, 'ArrowDown');
		key(handle, ' ');
		await nextTick();

		expect(drops).toEqual([expect.objectContaining({ key: 'a', index: 2 })]);
		expect(names()).toEqual(['b', 'c', 'a', 'd']);
	});

	it('moves a row one place with Alt+↓ and Alt+↑ on a cell, without a handle', async () => {
		const { drops, row, names } = setup();
		const cell = () => row('b').querySelector('[data-tc-column="id"]') as HTMLElement;

		key(cell(), 'ArrowDown', { altKey: true });
		await nextTick();

		expect(drops).toEqual([expect.objectContaining({ key: 'b', parent: null, index: 2, external: false })]);
		expect(names()).toEqual(['a', 'c', 'b', 'd']);

		key(cell(), 'ArrowUp', { altKey: true });
		key(row('a').querySelector('[data-tc-column="id"]') as HTMLElement, 'ArrowUp', { altKey: true });
		await nextTick();

		expect(names()).toEqual(['a', 'b', 'c', 'd']);
		expect(drops).toHaveLength(2);
	});

	it('moves no row with Alt+arrows while the rows are sorted', async () => {
		const { drops, row } = setup({ sorted: true });

		key(row('b').querySelector('[data-tc-column="id"]') as HTMLElement, 'ArrowDown', { altKey: true });
		await nextTick();

		expect(drops).toEqual([]);
	});
});

describe('row drag — between tables', () => {
	it('drops a row of one table of a group on another, with the row it carries', async () => {
		const first = setup({ group: 'tasks' });
		const second = setup({ group: 'tasks', rows: [{ id: 'x', name: 'Other' }], left: 800 });

		drag(first.row('b'), at(second.row('x'), 0.75));
		await nextTick();

		expect(first.drops).toEqual([]);
		expect(second.drops).toEqual([expect.objectContaining({ key: 'b', index: 1, external: true })]);
		expect(second.drops[0].row).toEqual(tasks[1]);
		expect(second.drops[0].source).toBe(first.table);
		expect(second.names()).toEqual(['x', 'b']);
	});

	it('keeps a row of a table without a group inside it', async () => {
		const first = setup();
		const second = setup({ rows: [{ id: 'x', name: 'Other' }], left: 800 });

		drag(first.row('b'), at(second.row('x'), 0.75));
		await nextTick();

		expect(second.drops).toEqual([]);
	});
});

describe('row drag — the ghost', () => {
	it('renders the template of `TableDragPreview` in the ghost, inside the table’s context', async () => {
		const Inner = defineComponent({
			setup() {
				const table = useDataTableContext();

				return () => h('i', `${table.rows.value.length} rows`);
			},
		});
		const { row, rows } = setup({
			preview: ({ row: dragged }) => [h('b', { class: 'ghost' }, (dragged as Task).name), h(Inner)],
		});

		pointer('pointerdown', row('c'), at(row('c')));
		pointer('pointermove', window, { x: at(row('c')).x, y: at(row('c')).y + 8 });
		frames.run();
		await nextTick();

		const ghost = document.querySelector('[data-drag-ghost]');

		expect(ghost?.querySelector('[data-tc-part="drag-preview"] .ghost')?.textContent).toBe('Gamma');
		expect(ghost?.querySelector('i')?.textContent).toBe('4 rows');

		// The row may be gone while the ghost is still up, such as while it flies after a drop.
		rows.value = rows.value.filter(item => item.id !== 'c');
		await nextTick();

		expect(ghost?.querySelector('.ghost')?.textContent).toBe('Gamma');

		pointer('pointerup', window, { x: 0, y: 0 });

		// It fades out first.
		await vi.waitFor(() => expect(document.querySelector('[data-drag-ghost]')).toBeNull());
	});
});

describe('row drag — bounds', () => {
	function ghostLeft() {
		const translate = (document.querySelector('[data-drag-ghost]') as HTMLElement | null)?.style.translate ?? '';

		return Number.parseFloat(translate || 'NaN');
	}

	async function dragFar(row: HTMLElement) {
		pointer('pointerdown', row, at(row));
		pointer('pointermove', window, { x: at(row).x, y: at(row).y + 8 });
		frames.run();
		pointer('pointermove', window, { x: 1200, y: 50 });
		frames.run();
		await nextTick();
	}

	it('keeps the ghost inside the table by default', async () => {
		const { row } = setup({ preview: () => 'Ghost' });

		await dragFar(row('a'));

		expect(ghostLeft()).toBeLessThanOrEqual(600);
	});

	it('lets the ghost out in a group, for the row to reach another table', async () => {
		const { row } = setup({ group: 'tasks', preview: () => 'Ghost' });

		await dragFar(row('a'));

		expect(ghostLeft()).toBeGreaterThan(1200);
	});
});

describe('column drag', () => {
	it('moves a movable column by its header, and leaves the others', async () => {
		const { table, header, columnDrops } = setup({ columns: true });

		await nextTick();

		expect(header('fixed').hasAttribute('data-tc-draggable')).toBe(false);
		expect(header('name').getAttribute('data-tc-draggable')).toBe('');

		drag(header('name'), { x: 170, y: 15 });
		await nextTick();

		expect(columnDrops).toEqual([{ name: 'name', index: 1 }]);
		expect(table.scope.columns.value.map(item => item.column?.name)).toEqual(['id', 'name', 'fixed']);
	});

	it('moves the columns apart as whole columns while dragging, and drops without a jump', async () => {
		const { table, root, header, columnDrops } = setup({ columns: true });
		const shifts = (name: string) => [...root.querySelectorAll<HTMLElement>(`[data-tc-column="${name}"]`)]
			.map(cell => cell.style.getPropertyValue('translate'));

		pointer('pointerdown', header('name'), at(header('name')));
		pointer('pointermove', window, { x: 58, y: 15 });
		frames.run();
		pointer('pointermove', window, { x: 170, y: 15 });
		frames.run();
		await nextTick();

		// The header and every body cell of a column move together.
		expect(shifts('id')).toEqual(Array(5).fill('-100px 0px'));
		expect(shifts('name')).toEqual(Array(5).fill('100px 0px'));
		expect(shifts('fixed')).toEqual(Array(5).fill(''));

		pointer('pointerup', window, { x: 170, y: 15 });
		await nextTick();

		expect(columnDrops).toEqual([{ name: 'name', index: 1 }]);
		expect(table.scope.columns.value.map(item => item.column?.name)).toEqual(['id', 'name', 'fixed']);
		expect([...shifts('id'), ...shifts('name')]).toEqual(Array(10).fill(''));
	});

	it('with `useTableMotion`, a column dropped from the gap stays where it stands', async () => {
		const { root, header } = setup({ columns: true, motion: true });
		const animate = vi.spyOn(Element.prototype, 'animate');

		pointer('pointerdown', header('name'), at(header('name')));
		pointer('pointermove', window, { x: 58, y: 15 });
		frames.run();
		pointer('pointermove', window, { x: 170, y: 15 });
		frames.run();
		await nextTick();
		animate.mockClear();

		pointer('pointerup', window, { x: 170, y: 15 });
		// The re-render lays the header out in the new order.
		void nextTick(() => placeTable(root));
		await nextTick();
		await nextTick();

		const slides = animate.mock.calls.filter(([, options]) => options !== undefined);

		expect(slides).toEqual([]);
	});

	it('does not sort a column dropped after a drag', async () => {
		const { table, header } = setup({ columns: true });

		drag(header('name'), { x: 170, y: 15 });
		header('name').click();
		await nextTick();

		expect(table.scope.sort.value).toEqual([]);
	});
});

describe('TableDragPreview', () => {
	it('fades where it is by default, and stands outside the pointer', () => {
		const holder = createPreviewHolder();
		const render = () => undefined;

		holder.set(render);

		expect(toValue(holder.get()?.exit)).toBe('fade');
		expect(toValue(holder.get()?.placement)).toBe('outside');

		const release = holder.set(render, { exit: 'land', placement: () => 'source' });

		expect(toValue(holder.get()?.exit)).toBe('land');
		expect(toValue(holder.get()?.placement)).toBe('source');

		release();

		expect(holder.get()).toBeUndefined();
	});
});

describe('TableDropZone', () => {
	it('takes a row dragged onto it, and says when it is ready and when the row is over it', async () => {
		const dropped: TableDropZoneEvent[] = [];
		const { table, row } = setup({
			group: 'tasks',
			extra: () => h(TableDropZone, { class: 'bin', onDrop: (event: TableDropZoneEvent) => dropped.push(event) }, { default: () => 'Bin' }),
		});
		const bin = document.querySelector('.bin') as HTMLElement;

		placeTable(document.querySelector('[data-tc-part="table"]') as Element);
		place(bin, { left: 900, top: 0, right: 1000, bottom: 100 });

		expect(bin.getAttribute('data-tc-state')).toBe('idle');

		pointer('pointerdown', row('a'), at(row('a')));
		pointer('pointermove', window, { x: at(row('a')).x, y: at(row('a')).y + 8 });
		frames.run();
		await nextTick();

		expect(bin.getAttribute('data-tc-state')).toBe('ready');

		pointer('pointermove', window, { x: 950, y: 50 });
		frames.run();
		await nextTick();

		expect(bin.getAttribute('data-tc-state')).toBe('over');

		pointer('pointerup', window, { x: 950, y: 50 });

		expect(dropped).toEqual([expect.objectContaining({ key: 'a', row: tasks[0], source: table })]);
	});
});

describe('dragHandleColumn', () => {
	it('is a service column with a handle in every row and an empty header', () => {
		const { root } = setup({ handle: true });

		expect(withHandles.drag).toMatchObject({ kind: 'service', pinned: 'start', width: 32 });
		expect(root.querySelectorAll('[data-tc-part="body"] [data-tc-part="drag-handle"]')).toHaveLength(4);
		expect(root.querySelector('[role="columnheader"][data-tc-column="drag"]')?.textContent).toBe('');
	});
});

describe('TableDragOverlay', () => {
	/** Starts a drag of `from`, and moves the pointer to `to` once it has started. */
	async function start(from: Element, to = at(from)) {
		pointer('pointerdown', from, at(from));
		pointer('pointermove', window, { x: at(from).x, y: at(from).y + 8 });
		frames.run();
		pointer('pointermove', window, to);
		frames.run();
		await nextTick();
	}

	function overlays(root: Element) {
		return root.querySelector('[data-tc-part="drag-overlay"]');
	}

	function messages(label: string) {
		return () => h(TableDragOverlay, null, {
			default: ({ source, own, over, allowed, label: item }: TableDragOverlayContext) => `${label}:${(source.rows.value as Task[])[0]?.id}:${own}:${over}:${allowed}:${item}`,
		});
	}

	it('shows on another table of the group, with where the row comes from, and follows the pointer', async () => {
		const first = setup({ group: 'tasks', inRows: messages('first') });
		const second = setup({ group: 'tasks', rows: [{ id: 'x', name: 'Other' }], left: 800, inRows: messages('second') });

		await start(first.row('b'));

		// The table the row comes from shows nothing of its own drag.
		expect(overlays(first.root)).toBeNull();
		expect(overlays(second.root)?.getAttribute('data-tc-state')).toBe('ready');
		expect(overlays(second.root)?.textContent).toBe('second:a:false:false:false:Beta');

		pointer('pointermove', window, at(second.row('x'), 0.75));
		frames.run();
		await nextTick();

		expect(overlays(second.root)?.getAttribute('data-tc-state')).toBe('over');
		expect(overlays(second.root)?.textContent).toBe('second:a:false:true:true:Beta');

		pointer('pointerup', window, at(second.row('x'), 0.75));
		await nextTick();

		expect(overlays(second.root)).toBeNull();
	});

	it('shows nothing on a table the drag cannot reach, kept to its own table', async () => {
		const zones: TableDropZoneSlotContext[] = [];
		const first = setup({ group: 'tasks', bounds: 'table' });

		// A zone outside the table, which the drag kept to the table cannot reach.
		wrappers.push(mount(defineComponent({
			setup: () => () => h(TableDropZone, { class: 'zone', group: 'tasks' }, {
				default: (context: TableDropZoneSlotContext) => {
					zones.push({ ready: context.ready, over: context.over, item: context.item });

					return 'Zone';
				},
			}),
		}), { attachTo: document.body }));

		const second = setup({ group: 'tasks', rows: [{ id: 'x', name: 'Other' }], left: 800, inRows: messages('second') });

		place(document.querySelector('.zone') as Element, { left: 1400, top: 0, right: 1500, bottom: 100 });
		await start(first.row('b'));

		expect(overlays(second.root)).toBeNull();
		expect(document.querySelector('.zone')?.getAttribute('data-tc-state')).toBe('idle');
		expect(zones.every(zone => zone.item === null && !zone.ready)).toBe(true);
	});

	it('shows for the table’s own rows with `own`, and as `when` decides', async () => {
		const own = setup({ inRows: () => h(TableDragOverlay, { own: true }, { default: () => 'own' }) });

		await start(own.row('a'));

		expect(overlays(own.root)?.textContent).toBe('own');

		pointer('pointerup', window, { x: 0, y: 0 });
		await nextTick();

		const picky = setup({
			left: 800,
			inRows: () => h(TableDragOverlay, { when: (context: TableDragOverlayContext) => context.key === 'c' }, { default: () => 'only c' }),
		});

		await start(picky.row('a'));

		expect(overlays(picky.root)).toBeNull();

		pointer('pointerup', window, { x: 0, y: 0 });
		await nextTick();
		await start(picky.row('c'));

		expect(overlays(picky.root)?.textContent).toBe('only c');
	});

	it('stays rendered as `idle` with `forceMount`, for animations of your own', () => {
		const { root } = setup({ inRows: () => h(TableDragOverlay, { forceMount: true }, { default: () => 'message' }) });

		expect(overlays(root)?.getAttribute('data-tc-state')).toBe('idle');
		expect(overlays(root)?.textContent).toBe('');
	});

	it('shows for a column dragged in its own table by default', async () => {
		const { header, root } = setup({
			columns: true,
			inColumns: () => h(TableDragOverlay, { for: 'columns' }, {
				default: ({ column, over }: TableDragOverlayContext) => `${column?.name}:${over}`,
			}),
		});

		await start(header('name'), { x: 170, y: 15 });

		expect(overlays(root)?.textContent).toBe('name:true');
	});
});
