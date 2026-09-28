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
	GridResizeHandle,
	GridRoot,
	GridRow,
	GridSortIndicator,
	sorting,
	useDataGrid,
} from '@vue-data-grid/core';
import { computed } from 'vue';

import { getChange, type Stock, stocks } from '@/data/stocks';
import { UiButton, UiSortIcon, UiSwitch, UiToolbar } from '@/ui';

const column = defineColumn<Stock>({ sortable: true, resizable: true, movable: true, hideable: true, pinnable: true });

const columns = defineColumns({
	symbol: column(stock => stock.symbol, { label: 'Symbol', width: 100 }),
	name: column(stock => stock.name, { label: 'Company', width: 190 }),
	sector: column(stock => stock.sector, { label: 'Sector', width: 130 }),
	price: column(stock => stock.price, {
		label: 'Price',
		width: 100,
		align: 'right',
		format: price => price.toFixed(2),
	}),
	change: column(stock => getChange(stock), {
		label: 'Change',
		width: 100,
		align: 'right',
		format: change => `${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
		cellClass: ({ value }) => (value >= 0 ? 'ui-cell-up' : 'ui-cell-down'),
	}),
});

const grid = useDataGrid({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 38,
	multiSort: true,
	features: { sorting: sorting() },
});

const { scope, state } = grid;

const symbolPinned = computed({
	get: () => scope.getPin('symbol') === 'start',
	set: pinned => scope.pinColumn('symbol', pinned ? 'start' : null),
});

const sectorShown = computed({
	get: () => !scope.isColumnHidden('sector'),
	set: () => scope.toggleColumn('sector'),
});

const snapshot = computed(() => JSON.stringify({ sort: state.sort.value, layout: state.layout.value }, null, 2));
</script>

<template>
	<div class="state-demo">
		<div class="ui-stack">
			<UiToolbar>
				<UiSwitch v-model="symbolPinned" label="Pin symbol" />
				<UiSwitch v-model="sectorShown" label="Show sector" />
				<span class="ui-spacer" />
				<UiButton size="sm" @click="state.reset()">Reset</UiButton>
			</UiToolbar>

			<GridRoot :grid="grid" label="Stocks" class="ui-grid" data-size="sm">
				<GridHeader>
					<GridHeaderRow v-slot="{ columns }">
						<GridHeaderCell v-for="column in columns" :key="column.key" :column="column">
							<GridHeaderContent />
							<GridSortIndicator v-slot="{ direction, sortIndex }">
								<UiSortIcon :direction="direction" :sort-index="sortIndex" />
							</GridSortIndicator>
							<GridResizeHandle />
						</GridHeaderCell>
					</GridHeaderRow>
				</GridHeader>
				<GridBody v-slot="{ rows }">
					<GridRow v-for="row in rows" :key="row.key" :row="row">
						<GridCells />
					</GridRow>
				</GridBody>
			</GridRoot>
		</div>

		<figure class="state-panel">
			<figcaption>grid.state</figcaption>
			<pre>{{ snapshot }}</pre>
		</figure>
	</div>
</template>

<style scoped>
.state-demo {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 260px;
	gap: 16px;
}

.state-panel {
	display: flex;
	flex-direction: column;
	min-height: 0;
	max-height: 344px;
	margin: 0;
	overflow: hidden;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-sm);
}

.state-panel figcaption {
	padding: 10px 14px;
	border-block-end: 1px solid var(--ui-border);
	color: var(--ui-fg-muted);
	font: 600 12px/1 var(--ui-font-mono);
}

.state-panel pre {
	flex: 1;
	margin: 0;
	padding: 12px 14px;
	overflow: auto;
	color: var(--ui-fg);
	font: 12px/1.55 var(--ui-font-mono);
}

@media (max-width: 760px) {
	.state-demo {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
