import { type DataGrid, getCellText, isSameTokens, keepMounted, type VirtualItem } from '@vue-data-grid/core';
import { defineComponent, h, onMounted, onUpdated, type PropType, type VNode, watch } from 'vue';

import type { Stock } from '@/data/stocks';

interface CachedRow {
	tokens: readonly unknown[];
	vnode: VNode;
}

export const MemoRows = defineComponent({
	props: {
		grid: { type: Object as PropType<DataGrid<Stock>>, required: true },
		memo: { type: Boolean, required: true },
		onRendered: { type: Function as PropType<(built: number) => void>, required: true },
	},
	setup(props) {
		const cache = new Map<string, CachedRow>();
		let built = 0;

		function renderCells(row: Stock) {
			return props.grid.scope.renderedColumns.value.map(rendered => h(
				'div',
				{ key: rendered.key, ...props.grid.getCellProps(rendered) },
				rendered.column ? h('span', { 'data-dg-part': 'cell-text' }, getCellText(rendered.column, row)) : undefined,
			));
		}

		function renderRow(item: VirtualItem) {
			const row = props.grid.rows.value[item.index];
			const tokens = [row, item.start, props.grid.scope.renderedColumns.value];
			const cached = cache.get(item.key);

			if (props.memo && cached && isSameTokens(cached.tokens, tokens)) {
				return keepMounted(cached.vnode);
			}

			built += 1;

			const vnode = h('div', { key: item.key, ...props.grid.getRowProps(item) }, renderCells(row));

			cache.set(item.key, { tokens, vnode });

			return vnode;
		}

		function report() {
			props.onRendered(built);
			built = 0;
		}

		watch(props.grid.items, (items) => {
			const shown = new Set(items.map(item => item.key));

			for (const key of cache.keys()) {
				if (!shown.has(key)) {
					cache.delete(key);
				}
			}
		});

		onMounted(report);
		onUpdated(report);

		return () => h('div', { ref: props.grid.body, ...props.grid.getBodyProps() }, props.grid.items.value.map(renderRow));
	},
});
