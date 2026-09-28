<script setup lang="ts">
import { defineColumn, defineColumns, useDataGrid } from '@vue-data-grid/core';
import { shallowRef } from 'vue';

import { type Stock, stocks } from '@/data/stocks';
import { UiButton, UiStat, UiSwitch, UiToolbar } from '@/ui';

import { MemoRows } from './MemoRows';

const column = defineColumn<Stock>();

const columns = defineColumns({
	symbol: column('symbol', { label: 'Symbol', width: 90, cellClass: () => 'ui-cell-mono' }),
	name: column('name', { label: 'Company', width: 170, flex: 1 }),
	sector: column('sector', { label: 'Sector', width: 120 }),
	price: column('price', { label: 'Price', width: 100, align: 'right', format: price => price.toFixed(2) }),
});

const rows = shallowRef<readonly Stock[]>(stocks);

const grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 38 });

const memo = shallowRef(true);
const built = shallowRef(0);
let next = 0;

function changePrice() {
	const index = next % 5;

	next += 1;
	rows.value = rows.value.map((stock, position) => (position === index ? { ...stock, price: stock.price + 1 } : stock));
}

function setBuilt(count: number) {
	built.value = count;
}
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<UiSwitch v-model="memo" label="Memo" />
			<UiButton @click="changePrice">Change a price</UiButton>
			<UiStat label="Rows built by the last render" :value="built" />
		</UiToolbar>

		<div :ref="grid.root" v-bind="grid.getGridProps()" aria-label="Stocks" class="ui-grid" data-size="sm">
			<div :ref="grid.head" v-bind="grid.getHeadProps()">
				<div v-bind="grid.getHeaderRowProps()">
					<div v-for="rendered in grid.scope.renderedColumns.value" :key="rendered.key" v-bind="grid.getHeaderCellProps(rendered)">
						<span v-if="rendered.column" data-dg-part="cell-text">{{ rendered.column.label }}</span>
					</div>
				</div>
			</div>
			<MemoRows :grid="grid" :memo="memo" :on-rendered="setBuilt" />
		</div>
	</div>
</template>
