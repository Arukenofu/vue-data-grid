<script setup lang="ts">
import { defineColumn, defineColumns, GridCellTemplate, type GridSort, sorting, useDataGrid } from '@vue-data-grid/core';
import IconArrowDown from '~icons/lucide/arrow-down';
import IconArrowUp from '~icons/lucide/arrow-up';
import IconX from '~icons/lucide/x';
import { computed, shallowRef } from 'vue';

import { getChange, type Stock, stocks } from '@/data/stocks';
import { type BadgeTone, UiBadge, UiButton, UiDataGrid, UiSwitch, UiToolbar } from '@/ui';

type Rating = 'Strong sell' | 'Sell' | 'Hold' | 'Buy' | 'Strong buy';

const RATINGS: readonly Rating[] = ['Strong sell', 'Sell', 'Hold', 'Buy', 'Strong buy'];

const RATING_TONES: Readonly<Record<Rating, BadgeTone>> = {
	'Strong sell': 'red',
	'Sell': 'amber',
	'Hold': 'gray',
	'Buy': 'blue',
	'Strong buy': 'green',
};

function getRating(stock: Stock): Rating {
	const change = getChange(stock);

	return RATINGS[Math.min(Math.max(Math.round(change / 4) + 2, 0), RATINGS.length - 1)];
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const text = defineColumn<Stock>({ sortable: true, sortOrder: ['asc', 'desc'] });
const number = defineColumn<Stock>({ sortable: true, align: 'right' });

const columns = defineColumns({
	symbol: text('symbol', { label: 'Symbol', width: 96, cellClass: () => 'ui-cell-mono ui-cell-strong' }),
	name: text('name', { label: 'Company', width: 164, flex: 1 }),
	rating: text(getRating, {
		label: 'Rating',
		width: 112,
		sortOrder: ['desc', 'asc'],
		compare: (a, b) => RATINGS.indexOf(a) - RATINGS.indexOf(b),
	}),
	price: number('price', { label: 'Price', width: 96, format: price => money.format(price) }),
	change: number(getChange, {
		label: 'Change',
		width: 104,
		format: change => `${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
		cellClass: ({ value }) => (value >= 0 ? 'ui-cell-up' : 'ui-cell-down'),
	}),
	marketCap: number('marketCap', { label: 'Market cap', width: 124, format: cap => `$${cap.toFixed(1)}B` }),
});

const sort = shallowRef<readonly GridSort[]>([
	{ name: 'rating', direction: 'desc' },
	{ name: 'marketCap', direction: 'desc' },
]);

const multiSort = shallowRef(true);

const SHOWN_BADGES = 3;

const shownSort = computed(() => sort.value.slice(0, SHOWN_BADGES));

const hiddenSort = computed(() => sort.value.slice(SHOWN_BADGES));

const grid = useDataGrid({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 44,
	sort,
	multiSort,
	features: { sorting: sorting() },
});

function getLabel(name: string) {
	return grid.scope.getColumn(name)?.column?.label ?? name;
}

function clearSort() {
	sort.value = [];
}
</script>

<template>
	<div>
		<UiToolbar>
			<div class="sort-summary">
				<span class="ui-toolbar-text">Sorted by</span>
				<template v-if="sort.length > 0">
					<UiBadge v-for="(item, index) in shownSort" :key="item.name" tone="green">
						{{ index + 1 }}. {{ getLabel(item.name) }}
						<IconArrowUp v-if="item.direction === 'asc'" aria-hidden="true" />
						<IconArrowDown v-else aria-hidden="true" />
					</UiBadge>
					<UiBadge v-if="hiddenSort.length > 0" :title="hiddenSort.map(item => getLabel(item.name)).join(', ')">
						+{{ hiddenSort.length }}
					</UiBadge>
				</template>
				<span v-else class="ui-toolbar-text">nothing, rows keep their order</span>
			</div>
			<UiButton variant="ghost" size="sm" :disabled="sort.length === 0" @click="clearSort">
				<IconX aria-hidden="true" />
				Clear
			</UiButton>
			<UiSwitch v-model="multiSort" label="Multi-sort with Shift" />
		</UiToolbar>
		<UiDataGrid :grid="grid" label="Stocks">
			<GridCellTemplate v-slot="{ value }" :column="columns.rating">
				<UiBadge :tone="RATING_TONES[value]">{{ value }}</UiBadge>
			</GridCellTemplate>
		</UiDataGrid>
	</div>
</template>

<style scoped>
.sort-summary {
	display: flex;
	flex: 1 1 280px;
	align-items: center;
	gap: 6px;
	min-width: 0;
	height: 32px;
	overflow: hidden;
	white-space: nowrap;
	mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
}

.sort-summary > * {
	flex: none;
}
</style>
