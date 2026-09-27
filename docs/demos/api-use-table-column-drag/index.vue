<script setup lang="ts">
import { defineColumn, defineColumns, useDataTable, useTableMotion } from '@vue-data-grid/core';
import { TableDragPreview, useTableColumnDrag } from '@vue-data-grid/core/drag-and-drop';
import { computed, shallowRef } from 'vue';

import { getChange, type Stock, stocks } from '@/data/stocks';
import { UiButton, UiDataTable, UiToolbar } from '@/ui';

const column = defineColumn<Stock>({ movable: true });

const columns = defineColumns({
	symbol: column(stock => stock.symbol, { label: 'Symbol', width: 100, movable: false, pinned: 'start' }),
	name: column(stock => stock.name, { label: 'Company', width: 190 }),
	sector: column(stock => stock.sector, { label: 'Sector', width: 130 }),
	price: column(stock => stock.price, { label: 'Price', width: 100, align: 'right', format: price => price.toFixed(2) }),
	change: column(stock => getChange(stock), {
		label: 'Change',
		width: 100,
		align: 'right',
		format: change => `${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
		cellClass: ({ value }) => (value >= 0 ? 'ui-cell-up' : 'ui-cell-down'),
	}),
	volume: column(stock => stock.volume, {
		label: 'Volume',
		width: 120,
		align: 'right',
		format: volume => volume.toLocaleString('en-US'),
	}),
});

const table = useDataTable({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 40,
});

useTableMotion(table);

const hint = shallowRef('Drag a header by its label. Symbol stays pinned in place.');

useTableColumnDrag(table, {
	onDrop: ({ name, index }) => {
		hint.value = `${table.scope.getColumn(name)?.column?.label ?? name} moved to place ${index + 1}`;
	},
});

const order = computed(() => table.scope.columns.value.flatMap(item => (item.column ? [item.column.label ?? item.column.name] : [])));
</script>

<template>
	<div>
		<UiToolbar>
			<ol class="order" aria-label="Column order">
				<li v-for="label in order" :key="label">{{ label }}</li>
			</ol>
			<span class="ui-spacer" />
			<UiButton variant="ghost" @click="table.state.reset()">Reset order</UiButton>
		</UiToolbar>

		<UiDataTable :table="table" label="Stocks" data-size="sm" />

		<p class="hint">{{ hint }}</p>

		<TableDragPreview for="columns" />
	</div>
</template>

<style scoped>
.order {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.order li {
	padding: 3px 9px;
	border: 1px solid var(--ui-border);
	border-radius: 999px;
	background: var(--ui-bg-subtle);
	color: var(--ui-fg-muted);
	font-size: 12px;
	font-weight: 550;
}

.hint {
	margin: 10px 0 0;
	color: var(--ui-fg-muted);
	font-size: 13px;
}
</style>
