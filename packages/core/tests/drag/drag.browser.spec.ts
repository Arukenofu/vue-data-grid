/// <reference types="vite/client" />
import '../../src/style.css';

import { defineColumn, defineColumns } from '@vue-data-grid/engine';
import { mount } from '@vue/test-utils';
import { defineComponent, h, shallowRef } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import { GridRoot } from '../../src/components/grid-root';
import { type DataGrid, useDataGrid } from '../../src/data-grid/use-data-grid';
import { GridColumnDrag } from '../../src/drag/grid-drag';
import { useGridMotion } from '../../src/motion/use-grid-motion';
import { renderBody, renderHeader } from '../support/parts';

interface Task {
	id: string;
	name: string;
}

const column = defineColumn<Task>({ movable: true, width: 100 });

const columns = defineColumns({
	name: column(row => row.name, { label: 'Name' }),
	id: column(row => row.id, { label: 'Id' }),
	note: column(row => row.id, { label: 'Note' }),
});

const wrappers: ReturnType<typeof mount>[] = [];

afterEach(() => {
	wrappers.splice(0).forEach(wrapper => wrapper.unmount());
});

function nextFrame() {
	return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function pointer(type: string, target: EventTarget, x: number, y: number) {
	target.dispatchEvent(new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		clientX: x,
		clientY: y,
		pointerId: 1,
		pointerType: 'mouse',
		isPrimary: true,
		button: 0,
	}));
}

function mountGrid() {
	const rows = shallowRef<Task[]>([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }]);
	let grid: DataGrid | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30 }) as DataGrid;
			useGridMotion(grid);

			return () => h(GridRoot, { grid: grid as DataGrid, label: 'Tasks', style: 'width: 400px; height: 200px' }, {
				default: () => [
					// The gap moves at once: what is measured is where the columns stand, not a slide.
					h(GridColumnDrag, { motion: false }, { default: () => renderHeader() }),
					renderBody(),
				],
			});
		},
	}), { attachTo: document.body });

	wrappers.push(wrapper);

	const root = wrapper.get('[data-dg-part="grid"]').element as HTMLElement;
	const header = (name: string) => root.querySelector(`[role="columnheader"][data-dg-column="${name}"]`) as HTMLElement;

	return { grid: grid as unknown as DataGrid, root, header };
}

describe('column drag in a browser', () => {
	it('with `useGridMotion`, a column dropped from the gap stays where the gap drew it', async () => {
		const { grid, root, header } = mountGrid();
		const start = header('name').getBoundingClientRect();
		const target = header('id').getBoundingClientRect();
		const y = start.top + start.height / 2;

		pointer('pointerdown', header('name'), start.left + 20, y);
		pointer('pointermove', window, start.left + 30, y);
		await nextFrame();
		pointer('pointermove', window, target.left + target.width * 0.75, y);
		await nextFrame();
		await nextFrame();

		const cell = () => root.querySelector('[data-dg-part="body"] [data-dg-column="name"]') as HTMLElement;
		const standing = { header: header('name').getBoundingClientRect().left, cell: cell().getBoundingClientRect().left };

		expect(standing.header).toBeCloseTo(target.left, 0);

		pointer('pointerup', window, target.left + target.width * 0.75, y);

		const seen: number[] = [];

		for (let frame = 0; frame < 12; frame += 1) {
			await nextFrame();
			seen.push(header('name').getBoundingClientRect().left, cell().getBoundingClientRect().left - standing.cell + standing.header);
		}

		expect(grid.scope.columns.value.map(item => item.column?.name)).toEqual(['id', 'name', 'note']);
		// Neither the header nor the body cells of the column jump back to where the drag began.
		expect(seen.every(left => Math.abs(left - standing.header) < 1)).toBe(true);
	});
});
