<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridCellTemplate,
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
	GridResizeHandle,
	GridRoot,
	GridRow,
	GridSortIndicator,
	selection,
	selectionColumn,
	sorting,
	useDataGrid,
} from '@vue-data-grid/core';
import { computed, shallowRef } from 'vue';

import { getChange, type Stock, stocks } from '@/data/stocks';
import { type Option, UiSortIcon, UiSparkline, UiToggleGroup, UiToolbar } from '@/ui';

import './themes.css';

type Theme = 'kit' | 'mono' | 'cards' | 'sheet' | 'terminal';

const THEMES: readonly Option<Theme>[] = [
	{ value: 'kit', label: 'reka-ui' },
	{ value: 'mono', label: 'Mono' },
	{ value: 'cards', label: 'Cards' },
	{ value: 'sheet', label: 'Sheet' },
	{ value: 'terminal', label: 'Terminal' },
];

const ROW_HEIGHTS: Readonly<Record<Theme, number>> = {
	kit: 42,
	mono: 44,
	cards: 56,
	sheet: 34,
	terminal: 30,
};

const STRONG_MOVE = 4;

const column = defineColumn<Stock>({ sortable: true, resizable: true });

const sectorClass = ({ row }: { row: Stock }) => `sector-${row.sector.toLowerCase()}`;

const columns = defineColumns({
	select: selectionColumn(),
	symbol: column(stock => stock.symbol, { label: 'Symbol', width: 104, pinned: 'start', cellClass: sectorClass }),
	name: column(stock => stock.name, { label: 'Company', flex: 1, minWidth: 120 }),
	sector: column(stock => stock.sector, { label: 'Sector', width: 124, cellClass: sectorClass }),
	trend: column(stock => stock.history, {
		label: 'Trend',
		width: 92,
		sortable: false,
	}),
	price: column(stock => stock.price, {
		label: 'Price',
		width: 84,
		align: 'right',
		format: price => price.toFixed(2),
	}),
	change: column(stock => getChange(stock), {
		label: 'Change',
		width: 100,
		align: 'right',
		format: change => `${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
		cellClass: ({ value }) => [value >= 0 ? 'tone-up' : 'tone-down', { 'tone-strong': Math.abs(value) >= STRONG_MOVE }],
	}),
});

const theme = shallowRef<Theme>('kit');

const grid = useDataGrid({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: computed(() => ROW_HEIGHTS[theme.value]),
	features: { sorting: sorting(), selection: selection() },
});

const selectedCount = grid.selection.selectedCount;
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<UiToggleGroup v-model="theme" :options="THEMES" label="Theme" />
		</UiToolbar>

		<div class="theme" :class="`theme-${theme}`">
			<div class="theme-bar">
				<span class="theme-title">Watchlist</span>
				<span class="theme-meta">
					<span v-if="selectedCount > 0" class="theme-selected">{{ selectedCount }} selected</span>
					<span class="theme-count">{{ stocks.length }} symbols</span>
				</span>
			</div>

			<GridRoot :grid="grid" label="Watchlist" :class="{ 'ui-grid': theme === 'kit' }">
				<GridCellTemplate v-slot="{ value }" :column="columns.trend">
					<UiSparkline :values="value" :width="72" :height="22" />
				</GridCellTemplate>
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
	</div>
</template>
