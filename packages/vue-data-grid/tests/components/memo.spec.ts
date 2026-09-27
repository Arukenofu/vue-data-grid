import { defineColumns } from '@vue-data-grid/core';
import { mount } from '@vue/test-utils';
import {
	type ComponentPublicInstance,
	createBlock,
	createElementBlock,
	createVNode,
	defineComponent,
	Fragment,
	h,
	nextTick,
	openBlock,
	renderList,
	shallowRef,
	withCtx,
} from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import type { TableBodyRow } from '../../src/components/context';
import { TableBody, TableCells, TableRow } from '../../src/components/table-body';
import { TableRoot } from '../../src/components/table-root';
import { useDataTable } from '../../src/data-table/use-data-table';

interface Row {
	id: string;
	price: number;
}

const columns = defineColumns({
	id: { value: (row: Row) => row.id },
	price: { value: (row: Row) => row.price },
});

// `SlotFlags.STABLE` and `PatchFlags` of Vue's compiler: what a template compiles its slots and props to.
const STABLE_SLOTS = 1;
const PROPS = 8;
const KEYED_FRAGMENT = 128;

/**
 * The body as the template compiler writes it, and not as a render function by hand would:
 *
 * <TableBody v-slot="{ rows }">
 * 	<TableRow v-for="row in rows" :key="row.key" :row="row"><TableCells /></TableRow>
 * </TableBody>
 */
function renderCompiledBody() {
	return createVNode(TableBody, null, {
		default: withCtx(({ rows }: { rows: readonly TableBodyRow[] }) => [
			(openBlock(true), createElementBlock(Fragment, null, renderList(rows, row => (openBlock(), createBlock(TableRow, { key: row.key, row }, {
				default: withCtx(() => [createVNode(TableCells)]),
				_: STABLE_SLOTS,
			}, PROPS, ['row']))), KEYED_FRAGMENT)),
		]),
		_: STABLE_SLOTS,
	});
}

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

describe('the row memo in a compiled template', () => {
	it('renders again only the row whose data changed', async () => {
		const rows = shallowRef<Row[]>([{ id: 'a', price: 1 }, { id: 'b', price: 2 }, { id: 'c', price: 3 }]);
		const updated: string[] = [];

		wrapper = mount(defineComponent({
			setup() {
				const table = useDataTable({ columns, rows, rowKey: 'id', rowHeight: 30 });

				return () => h(TableRoot, { table, label: 'Prices' }, { default: renderCompiledBody });
			},
		}), {
			global: {
				mixins: [{
					updated(this: ComponentPublicInstance) {
						if (this.$options.name === 'TableRow') {
							updated.push(String(this.$.vnode.key));
						}
					},
				}],
			},
		});

		rows.value = rows.value.map(row => (row.id === 'b' ? { ...row, price: 5 } : row));
		await nextTick();

		expect(updated).toEqual(['b']);
	});
});
