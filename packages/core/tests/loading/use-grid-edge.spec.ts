import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, shallowRef } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';
import { type GridEdgeOptions, useGridEdge } from '../../src/loading/use-grid-edge';

interface Row {
	id: string;
}

const ROW_HEIGHT = 30;

const column = defineColumn<Row>({ width: 100 });

const columns = defineColumns({
	pinned: column('id', { label: 'Id', pinned: 'start' }),
	...Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`c${index}`, column('id', { label: `C${index}` })])),
});

function createRows(count: number, from = 0) {
	return Array.from({ length: count }, (_, index) => ({ id: `r${from + index}` }));
}

/** A scroll container 300px tall and 350px wide: happy-dom has no layout. */
function createScroller() {
	const element = document.createElement('div');
	let top = 0;
	let left = 0;

	Object.defineProperties(element, {
		clientHeight: { get: () => 300 },
		clientWidth: { get: () => 350 },
		scrollTop: { get: () => top, set: (value: number) => { top = value; } },
		scrollLeft: { get: () => left, set: (value: number) => { left = value; } },
	});

	return {
		element,
		scroll(position: { top?: number; left?: number }) {
			top = position.top ?? top;
			left = position.left ?? left;
			element.dispatchEvent(new Event('scroll'));
		},
	};
}

const mounted: ReturnType<typeof mount>[] = [];

afterEach(() => {
	for (const wrapper of mounted.splice(0)) {
		wrapper.unmount();
	}
});

function setup(edge: Omit<GridEdgeOptions, 'onReach'> & { onReach?: GridEdgeOptions['onReach'] }, count = 50) {
	const rows = shallowRef<readonly Row[]>(createRows(count));
	const onReach = vi.fn(edge.onReach ?? (() => undefined));
	const scroller = createScroller();
	let grid: DataGrid<Row> | null = null;
	let state: ReturnType<typeof useGridEdge> | null = null;

	mounted.push(mount(defineComponent({
		setup() {
			grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: ROW_HEIGHT });
			state = useGridEdge(grid, { ...edge, onReach });

			return () => null;
		},
	})));

	return {
		rows,
		onReach,
		scroller,
		state: state as unknown as ReturnType<typeof useGridEdge>,
		mount() {
			(grid as unknown as DataGrid<Row>).root.value = scroller.element;
		},
	};
}

describe('useGridEdge — rows', () => {
	it('loads at the bottom once the rows in view come within the threshold of the end', async () => {
		const current = setup({ edge: 'bottom' });

		current.mount();
		await nextTick();
		expect(current.onReach).not.toHaveBeenCalled();
		expect(current.state.reached.value).toBe(false);

		// Rows 30 to 39 in view leave ten below them.
		current.scroller.scroll({ top: 30 * ROW_HEIGHT });
		await nextTick();

		expect(current.state.reached.value).toBe(true);
		expect(current.onReach).toHaveBeenCalledTimes(1);
		expect(current.onReach).toHaveBeenCalledWith({ edge: 'bottom' });
	});

	it('takes the threshold of its own', async () => {
		const current = setup({ edge: 'bottom', threshold: 0 });

		current.mount();
		current.scroller.scroll({ top: 30 * ROW_HEIGHT });
		await nextTick();
		expect(current.onReach).not.toHaveBeenCalled();

		current.scroller.scroll({ top: 40 * ROW_HEIGHT });
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(1);
	});

	it('loads at the top while the first rows are in view', async () => {
		const current = setup({ edge: 'top' });

		current.mount();
		await nextTick();

		expect(current.onReach).toHaveBeenCalledWith({ edge: 'top' });
	});

	it('reaches the top once for a page that came in there: the rows in view stay in place, away from it', async () => {
		let prepend = () => {};
		const current = setup({ edge: 'top', onReach: () => prepend() });

		prepend = () => {
			current.rows.value = [...createRows(30, 100), ...current.rows.value];
		};
		current.mount();
		await nextTick();
		await nextTick();

		expect(current.onReach).toHaveBeenCalledTimes(1);
		expect(current.scroller.element.scrollTop).toBe(30 * ROW_HEIGHT);
		expect(current.state.reached.value).toBe(false);
	});

	it('waits for the promise of a call, and calls again when the rows that came leave the edge close', async () => {
		let resolve = () => {};
		const current = setup({
			edge: 'bottom',
			onReach: () => new Promise<void>((done) => {
				resolve = done;
			}),
		});

		current.mount();
		current.scroller.scroll({ top: 40 * ROW_HEIGHT });
		await nextTick();
		expect(current.state.pending.value).toBe(true);

		current.rows.value = [...current.rows.value, ...createRows(5, 50)];
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(1);

		// The next call comes as soon as the first one settles: the rows that came leave five below the view.
		resolve();
		await Promise.resolve();
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(2);
		expect(current.state.pending.value).toBe(true);
	});

	it('stops waiting for a load that failed, and lets the failure through', async () => {
		// Never settles on its own: the handlers the edge passes to it are called by hand, so the
		// failure it lets through lands in the test rather than as an unhandled rejection.
		const load = new Promise<void>(() => {});
		const then = vi.spyOn(load, 'then').mockReturnValue(Promise.resolve());
		const current = setup({ edge: 'bottom', onReach: () => load });
		const error = new Error('offline');

		current.mount();
		current.scroller.scroll({ top: 40 * ROW_HEIGHT });
		await nextTick();
		expect(current.state.pending.value).toBe(true);

		// The last call is the edge's: the spy of `onReach` reads the promise first, to record how it settles.
		const rejected = then.mock.calls.at(-1)?.[1] as (reason: unknown) => unknown;

		expect(() => rejected(error)).toThrow(error);
		expect(current.state.pending.value).toBe(false);
	});

	it('calls again for a new list of the same length, as the first page of another query', async () => {
		const current = setup({ edge: 'bottom' }, 15);

		current.mount();
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(1);

		current.rows.value = createRows(15, 500);
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(2);
	});

	it('calls for a new list once the load of the old one settles', async () => {
		let resolve = () => {};
		const current = setup({
			edge: 'bottom',
			onReach: () => new Promise<void>((done) => {
				resolve = done;
			}),
		}, 15);

		current.mount();
		await nextTick();
		current.rows.value = createRows(15, 500);
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(1);

		resolve();
		await Promise.resolve();
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(2);
	});

	it('waits while `busy` without using up a call, and calls once it is over', async () => {
		const busy = shallowRef(true);
		const current = setup({ edge: 'bottom', busy }, 15);

		current.mount();
		await nextTick();
		expect(current.onReach).not.toHaveBeenCalled();

		busy.value = false;
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(1);
	});

	it('does not repeat a load that brought nothing until the edge is left and reached again', async () => {
		const current = setup({ edge: 'bottom' });

		current.mount();
		current.scroller.scroll({ top: 40 * ROW_HEIGHT });
		await nextTick();
		current.scroller.scroll({ top: 39 * ROW_HEIGHT });
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(1);

		current.scroller.scroll({ top: 0 });
		await nextTick();
		current.scroller.scroll({ top: 40 * ROW_HEIGHT });
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(2);
	});

	it('stops once there is no more, and goes on when there is', async () => {
		const hasMore = shallowRef(false);
		const current = setup({ edge: 'bottom', hasMore });

		current.mount();
		current.scroller.scroll({ top: 40 * ROW_HEIGHT });
		await nextTick();
		expect(current.onReach).not.toHaveBeenCalled();

		hasMore.value = true;
		await nextTick();
		expect(current.onReach).toHaveBeenCalledTimes(1);
	});

	it('reaches no edge of an empty grid or of one not mounted', async () => {
		const empty = setup({ edge: 'bottom' }, 0);
		const unmounted = setup({ edge: 'top' });

		empty.mount();
		await nextTick();

		expect(empty.onReach).not.toHaveBeenCalled();
		expect(unmounted.onReach).not.toHaveBeenCalled();
	});
});

describe('useGridEdge — columns', () => {
	// 350px less the 100px pinned column show two and a half of the ten scrolling columns.
	it('loads at the end once the columns in view come within the threshold of the last one', async () => {
		const current = setup({ edge: 'end' });

		current.mount();
		await nextTick();
		expect(current.onReach).not.toHaveBeenCalled();

		current.scroller.scroll({ left: 500 });
		await nextTick();
		expect(current.onReach).toHaveBeenCalledWith({ edge: 'end' });
	});

	it('loads at the start while the first scrolling columns are in view, whatever is pinned', async () => {
		const current = setup({ edge: 'start', threshold: 0 });

		current.mount();
		await nextTick();
		expect(current.onReach).toHaveBeenCalledWith({ edge: 'start' });

		const later = setup({ edge: 'start', threshold: 0 });

		later.scroller.scroll({ left: 150 });
		later.mount();
		await nextTick();
		expect(later.onReach).not.toHaveBeenCalled();
	});
});
