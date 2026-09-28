<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
	GridRoot,
	GridRow,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import { type DragIndicator, GridColumnDrag, GridDragPreview } from '@vue-data-grid/core/drag-and-drop';
import IconColumns from '~icons/lucide/columns-3';
import { computed, shallowRef } from 'vue';

import { getChange, type Stock, stocks } from '@/data/stocks';
import { UiButton, UiToggleGroup, UiToolbar } from '@/ui';

const INDICATORS = [
	{ value: 'gap', label: 'Gap' },
	{ value: 'line', label: 'Line' },
] as const;

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const column = defineColumn<Stock>({ movable: true });

const columns = defineColumns({
	symbol: column('symbol', { label: 'Symbol', width: 96, pinned: 'start', movable: false }),
	name: column('name', { label: 'Company', width: 170 }),
	sector: column('sector', { label: 'Sector', width: 120 }),
	price: column('price', { label: 'Price', width: 96, align: 'right', format: price => `$${price.toFixed(2)}` }),
	change: column(getChange, {
		label: 'Change',
		width: 96,
		align: 'right',
		format: change => `${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
		cellClass: ({ value }) => (value < 0 ? 'ui-cell-down' : 'ui-cell-up'),
	}),
	volume: column('volume', { label: 'Volume', width: 96, align: 'right', format: volume => compact.format(volume) }),
});

const grid = useDataGrid({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 40,
});

useGridMotion(grid);

const indicator = shallowRef<DragIndicator>('gap');

const order = computed(() => grid.scope.columns.value.map(item => item.column?.label).join(' · '));
</script>

<template>
	<div>
		<UiToolbar>
			<UiToggleGroup v-model="indicator" :options="INDICATORS" label="Show the place as" />
			<span class="ui-spacer" />
			<UiButton size="sm" variant="ghost" @click="grid.state.reset()">Reset order</UiButton>
		</UiToolbar>

		<GridRoot :grid="grid" label="Stocks" class="ui-grid" data-size="sm">
			<GridColumnDrag :indicator="indicator">
				<GridHeader>
					<GridHeaderRow v-slot="{ columns: headers }">
						<GridHeaderCell v-for="header in headers" :key="header.key" :column="header">
							<GridHeaderContent />
						</GridHeaderCell>
					</GridHeaderRow>
				</GridHeader>
				<GridDragPreview v-slot="{ label }" for="columns">
					<IconColumns class="ghost-icon" aria-hidden="true" />
					{{ label }}
				</GridDragPreview>
			</GridColumnDrag>
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
		</GridRoot>

		<p class="order">{{ order }}</p>
	</div>
</template>

<style scoped>
.ghost-icon {
	width: 14px;
	height: 14px;
	color: var(--ui-accent);
}

.order {
	margin: 10px 0 0;
	color: var(--ui-fg-muted);
	font-size: 12.5px;
	text-align: center;
}
</style>
