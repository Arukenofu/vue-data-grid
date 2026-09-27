<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	sorting,
	TableBody,
	TableCells,
	TableHeader,
	TableHeaderCell,
	TableHeaderContent,
	TableHeaderRow,
	TableResizeHandle,
	TableRoot,
	TableRow,
	TableSortIndicator,
	useDataTable,
} from 'vue-data-grid';
import IconActivity from '~icons/lucide/activity';
import IconBuilding from '~icons/lucide/building-2';
import IconChartLine from '~icons/lucide/chart-line';
import IconCoins from '~icons/lucide/coins';
import IconLayers from '~icons/lucide/layers';
import IconTag from '~icons/lucide/tag';
import { type Component, computed } from 'vue';

import { getChange, type Stock, stocks } from '@/data/stocks';
import { UiButton, UiSortIcon, UiToolbar } from '@/ui';

const ICONS: Readonly<Record<string, Component>> = {
	symbol: IconTag,
	name: IconBuilding,
	sector: IconLayers,
	price: IconCoins,
	change: IconChartLine,
	volume: IconActivity,
};

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const column = defineColumn<Stock>({ sortable: true, resizable: true, movable: true });

const columns = defineColumns({
	symbol: column(stock => stock.symbol, { label: 'Symbol', width: 116, pinned: 'start', movable: false }),
	name: column(stock => stock.name, { label: 'Company', width: 190, flex: 1 }),
	sector: column(stock => stock.sector, { label: 'Sector', width: 140 }),
	price: column(stock => stock.price, {
		label: 'Price',
		width: 112,
		align: 'right',
		format: price => `$${price.toFixed(2)}`,
	}),
	change: column(getChange, {
		label: 'Change',
		width: 116,
		align: 'right',
		format: change => `${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
	}),
	volume: column(stock => stock.volume, {
		label: 'Volume',
		width: 112,
		align: 'right',
		format: volume => compact.format(volume),
	}),
});

const table = useDataTable({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 40,
	multiSort: true,
	features: { sorting: sorting() },
});

const summary = computed(() => table.scope.sort.value
	.map(item => `${table.scope.getColumn(item.name)?.column?.label ?? item.name} ${item.direction === 'asc' ? '↑' : '↓'}`)
	.join(', then '));
</script>

<template>
	<div>
		<UiToolbar>
			<span class="ui-toolbar-text">{{ summary ? `Sorted by ${summary}` : 'Unsorted' }}</span>
			<span class="ui-spacer" />
			<UiButton size="sm" @click="table.state.reset()">Reset layout</UiButton>
		</UiToolbar>

		<TableRoot :table="table" label="Stocks" class="ui-table" data-size="sm">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns: headers }">
					<TableHeaderCell
						v-for="header in headers"
						:key="header.key"
						v-slot="{ column: declared }"
						:column="header"
						class="is-sortable"
					>
						<component :is="ICONS[declared.name]" v-if="ICONS[declared.name]" class="header-icon" aria-hidden="true" />
						<TableHeaderContent />
						<TableSortIndicator v-slot="{ direction, sortIndex }">
							<UiSortIcon :direction="direction" :sort-index="sortIndex" />
						</TableSortIndicator>
						<TableResizeHandle />
					</TableHeaderCell>
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows }">
				<TableRow v-for="row in rows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
			</TableBody>
		</TableRoot>
	</div>
</template>

<style scoped>
.header-icon {
	flex: none;
	margin-inline-end: 6px;
	width: 14px;
	height: 14px;
	color: var(--ui-fg-subtle);
}
</style>
