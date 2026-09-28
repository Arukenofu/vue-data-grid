<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridRoot,
	GridRow,
	navigation,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import { type DragIndicator, GridColumnDrag, GridDragPreview } from '@vue-data-grid/core/drag-and-drop';
import IconColumns from '~icons/lucide/columns-3';
import IconRotateCcw from '~icons/lucide/rotate-ccw';
import { computed, shallowRef } from 'vue';

import { getChange, type Stock, stocks } from '@/data/stocks';
import { type ToggleOption, UiButton, UiDataGridHeader, UiToggleGroup, UiToolbar } from '@/ui';

const INDICATORS: readonly ToggleOption<DragIndicator>[] = [
	{ value: 'gap', label: 'Gap' },
	{ value: 'line', label: 'Line' },
	{ value: 'mark', label: 'Mark' },
];

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const column = defineColumn<Stock>({ movable: true });

const columns = defineColumns({
	symbol: column('symbol', { label: 'Symbol', width: 84, cellClass: () => 'ui-cell-mono ui-cell-strong' }),
	name: column('name', { label: 'Company', width: 160 }),
	sector: column('sector', { label: 'Sector', width: 110 }),
	price: column('price', { label: 'Price', width: 88, align: 'right', format: price => price.toFixed(2) }),
	change: column(stock => getChange(stock), {
		label: 'Change',
		width: 86,
		align: 'right',
		format: change => `${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
		cellClass: ({ value }) => (value >= 0 ? 'ui-cell-up' : 'ui-cell-down'),
	}),
	volume: column('volume', { label: 'Volume', width: 90, align: 'right', format: volume => compact.format(volume) }),
});

const indicator = shallowRef<DragIndicator>('gap');

const grid = useDataGrid({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 40,
	features: { navigation: navigation() },
});

useGridMotion(grid);

const order = computed(() => grid.scope.columns.value.map(item => item.column?.label).join(' · '));
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<span class="ui-toolbar-text">Show the place as</span>
			<UiToggleGroup v-model="indicator" :options="INDICATORS" label="Show the place as" />
			<span class="ui-spacer" />
			<UiButton variant="ghost" @click="grid.state.reset()">
				<IconRotateCcw aria-hidden="true" />
				Reset order
			</UiButton>
		</UiToolbar>

		<GridRoot :grid="grid" label="Stocks" class="ui-grid" data-size="sm">
			<GridColumnDrag :indicator="indicator">
				<UiDataGridHeader />
				<GridDragPreview v-slot="{ label }">
					<IconColumns aria-hidden="true" />
					{{ label }}
				</GridDragPreview>
			</GridColumnDrag>
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
		</GridRoot>

		<p class="order ui-muted">{{ order }}</p>
	</div>
</template>

<style scoped>
.ui-stack :deep([role='columnheader'][data-dg-draggable]) {
	cursor: grab;
}

.order {
	margin: 0;
	font-size: 12.5px;
}
</style>
