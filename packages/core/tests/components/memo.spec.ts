import { defineColumns } from '@vue-data-grid/engine';
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

import type { GridBodyRow } from '../../src/components/context';
import { GridBody, GridCells, GridRow } from '../../src/components/grid-body';
import { GridRoot } from '../../src/components/grid-root';
import { useDataGrid } from '../../src/data-grid/use-data-grid';

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
 * <GridBody v-slot="{ rows }">
 * 	<GridRow v-for="row in rows" :key="row.key" :row="row"><GridCells /></GridRow>
 * </GridBody>
 */
function renderCompiledBody() {
	return createVNode(GridBody, null, {
		default: withCtx(({ rows }: { rows: readonly GridBodyRow[] }) => [
			(openBlock(true), createElementBlock(Fragment, null, renderList(rows, row => (openBlock(), createBlock(GridRow, { key: row.key, row }, {
				default: withCtx(() => [createVNode(GridCells)]),
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
				const grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 30 });

				return () => h(GridRoot, { grid, label: 'Prices' }, { default: renderCompiledBody });
			},
		}), {
			global: {
				mixins: [{
					updated(this: ComponentPublicInstance) {
						if (this.$options.name === 'GridRow') {
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
