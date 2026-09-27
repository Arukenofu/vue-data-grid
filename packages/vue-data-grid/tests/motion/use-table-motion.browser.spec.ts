/// <reference types="vite/client" />
import '../../src/style.css';

import { defineColumn, defineColumns } from '@vue-data-grid/core';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, shallowRef } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import { TableRoot } from '../../src/components/table-root';
import { type DataTable, useDataTable } from '../../src/data-table/use-data-table';
import { useTableMotion } from '../../src/motion/use-table-motion';
import { renderBody } from '../support/parts';

interface Task {
	id: string;
}

const columns = defineColumns({
	id: defineColumn<Task>()(row => row.id, { label: 'Id', width: 100 }),
});

const wrappers: ReturnType<typeof mount>[] = [];

afterEach(() => {
	wrappers.splice(0).forEach(wrapper => wrapper.unmount());
});

describe('useTableMotion in a browser', () => {
	it('draws a moved row from its old place, layered over its own `translate`', async () => {
		const rows = shallowRef<Task[]>([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
		let table: DataTable | null = null;

		const wrapper = mount(defineComponent({
			setup() {
				table = useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30 }) as DataTable;
				useTableMotion(table);

				return () => h(TableRoot, { table: table as DataTable, label: 'Tasks', style: 'width: 200px; height: 200px' }, {
					default: () => renderBody(),
				});
			},
		}), { attachTo: document.body });

		wrappers.push(wrapper);

		const root = wrapper.get('[data-tc-part="table"]').element;
		const rowOf = (index: number) => root.querySelectorAll<HTMLElement>('[data-tc-part="body"] > [data-tc-part="row"]')[index];
		const before = rowOf(0).getBoundingClientRect().top;
		const moving = rowOf(0);

		// The row has a `translate` of its own, as the markup may give it: the movement adds to it.
		moving.style.translate = '0px 5px';
		rows.value = [{ id: 'b' }, { id: 'c' }, { id: 'a' }];
		await nextTick();
		await nextTick();

		const animations = moving.getAnimations();

		expect(animations).toHaveLength(1);

		for (const animation of animations) {
			animation.pause();
			animation.currentTime = 0;
		}

		expect(moving.getBoundingClientRect().top).toBeCloseTo(before + 5, 0);

		for (const animation of animations) {
			animation.finish();
		}

		expect(moving.getBoundingClientRect().top).toBeCloseTo(before + 60 + 5, 0);
	});
});
