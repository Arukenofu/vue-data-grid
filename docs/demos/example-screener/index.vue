<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridCellTemplate,
	GridHeaderTemplate,
	navigation,
	selection,
	sorting,
	useCellChanges,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import IconPause from '~icons/lucide/pause';
import IconPlay from '~icons/lucide/play';
import { computed, ref, shallowRef } from 'vue';

import { getChange, type Sector, type Stock } from '@/data/stocks';
import { type BadgeTone, UiBadge, UiButton, UiDataGrid, UiSelect, UiSparkline, UiToggleGroup, UiToolbar } from '@/ui';

import ChangeCell from './ChangeCell.vue';
import { formatCap, formatChange, formatPrice, formatVolume } from './format';
import PriceCell from './PriceCell.vue';
import SymbolCell from './SymbolCell.vue';
import { type Pace, useMarket } from './use-market';
import WatchToggle from './WatchToggle.vue';

type View = 'all' | 'watchlist';

type SectorFilter = Sector | 'all';

const SECTOR_TONES: Readonly<Record<Sector, BadgeTone>> = {
	Technology: 'blue',
	Energy: 'amber',
	Health: 'red',
	Finance: 'violet',
	Consumer: 'green',
	Industrials: 'gray',
};

const SECTORS: readonly { value: SectorFilter; label: string }[] = [
	{ value: 'all', label: 'All sectors' },
	{ value: 'Technology', label: 'Technology' },
	{ value: 'Energy', label: 'Energy' },
	{ value: 'Health', label: 'Health' },
	{ value: 'Finance', label: 'Finance' },
	{ value: 'Consumer', label: 'Consumer' },
	{ value: 'Industrials', label: 'Industrials' },
];

const PACES: readonly { value: Pace; label: string }[] = [
	{ value: 'calm', label: 'Calm' },
	{ value: 'busy', label: 'Busy' },
	{ value: 'frantic', label: 'Frantic' },
];

const view = shallowRef<View>('all');
const sector = shallowRef<SectorFilter>('all');
const pace = shallowRef<Pace>('busy');
const running = shallowRef(true);
const watchlist = ref(['AURA', 'NOVA', 'JUNO', 'TIDE']);

const { quotes, updates } = useMarket(pace, running);

const views = computed(() => [
	{ value: 'all' as const, label: 'All stocks' },
	{ value: 'watchlist' as const, label: `Watchlist · ${watchlist.value.length}` },
]);

const column = defineColumn<Stock>({ sortable: true, resizable: true });

const columns = defineColumns({
	watch: column('symbol', {
		kind: 'service',
		label: 'Watch',
		width: 48,
		minWidth: 48,
		pinned: 'start',
		align: 'center',
		sortable: false,
		resizable: false,
	}),
	symbol: column('symbol', {
		label: 'Symbol',
		width: 200,
		pinned: 'start',
		footer: ({ rows }) => `${rows.length} stocks`,
	}),
	sector: column('sector', {
		label: 'Sector',
		width: 120,
	}),
	price: column('price', {
		label: 'Price',
		width: 110,
		align: 'right',
		format: formatPrice,
	}),
	change: column(getChange, {
		label: 'Change',
		width: 130,
		align: 'right',
		format: formatChange,
		aggregate: 'avg',
		footer: ({ aggregate }) => (aggregate === null ? '' : `avg ${formatChange(aggregate)}`),
	}),
	trend: column('history', {
		label: 'Trend',
		width: 110,
		flex: 1,
		sortable: false,
	}),
	volume: column('volume', {
		label: 'Volume',
		width: 100,
		align: 'right',
		format: formatVolume,
		aggregate: 'sum',
		footer: ({ aggregate }) => (aggregate === null ? '' : formatVolume(aggregate)),
	}),
	marketCap: column('marketCap', {
		label: 'Market cap',
		width: 120,
		align: 'right',
		format: formatCap,
		aggregate: 'sum',
		footer: ({ aggregate }) => (aggregate === null ? '' : formatCap(aggregate)),
	}),
});

const rows = computed(() => quotes.value.filter(stock => (sector.value === 'all' || stock.sector === sector.value)
	&& (view.value === 'all' || watchlist.value.includes(stock.id))));

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 52,
	sort: [{ name: 'change', direction: 'desc' }],
	features: {
		sorting: sorting({ delta: true }),
		selection: selection({ selection: watchlist }),
		navigation: navigation(),
	},
});

const changes = useCellChanges(grid.scope, { columns: ['price'], duration: 900 });

useGridMotion(grid);

const advancing = computed(() => quotes.value.filter(stock => stock.price > stock.open).length);
const declining = computed(() => quotes.value.length - advancing.value);
</script>

<template>
	<div class="screener">
		<UiToolbar>
			<UiToggleGroup v-model="view" :options="views" label="Stocks to show" />
			<UiSelect v-model="sector" :options="SECTORS" label="Sector" />
			<span class="ui-spacer" />
			<UiToggleGroup v-model="pace" :options="PACES" label="Update rate" />
			<UiButton icon :aria-label="running ? 'Pause the feed' : 'Resume the feed'" @click="running = !running">
				<IconPause v-if="running" />
				<IconPlay v-else />
			</UiButton>
		</UiToolbar>

		<UiDataGrid
			:grid="grid"
			label="Stock screener"
			:messages="{ empty: 'Star a few stocks to build your watchlist.' }"
			footer
			style="height: 560px"
		>
			<GridHeaderTemplate :column="columns.watch">
				<span class="ui-visually-hidden">Watchlist</span>
			</GridHeaderTemplate>
			<GridCellTemplate v-slot="{ key, value }" :column="columns.watch">
				<WatchToggle :row-key="key" :symbol="value" />
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ row }" :column="columns.symbol">
				<SymbolCell :stock="row" />
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ value }" :column="columns.sector">
				<UiBadge :tone="SECTOR_TONES[value]">{{ value }}</UiBadge>
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ key, value }" :column="columns.price">
				<PriceCell :text="formatPrice(value)" :change="changes.getChange(key, 'price')" />
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ value }" :column="columns.change">
				<ChangeCell :value="value" />
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ value }" :column="columns.trend">
				<UiSparkline :values="value" />
			</GridCellTemplate>
		</UiDataGrid>

		<p class="market">
			<span class="market-live" :data-running="running ? '' : undefined">{{ running ? 'Live' : 'Paused' }}</span>
			<span>{{ updates.toLocaleString('en-US') }} quotes</span>
			<span class="market-up">{{ advancing }} advancing</span>
			<span class="market-down">{{ declining }} declining</span>
		</p>
	</div>
</template>

<style scoped>
.market {
	display: flex;
	flex-wrap: wrap;
	gap: 6px 18px;
	margin: 12px 2px 0;
	color: var(--ui-fg-muted);
	font-size: 12.5px;
	font-variant-numeric: tabular-nums;
}

.market-live {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	color: var(--ui-fg);
	font-weight: 600;
}

.market-live::before {
	width: 8px;
	height: 8px;
	border-radius: 999px;
	background: var(--ui-fg-subtle);
	content: '';
}

.market-live[data-running]::before {
	background: var(--ui-up);
	box-shadow: 0 0 0 0 color-mix(in srgb, var(--ui-up) 50%, transparent);
	animation: pulse 1.6s ease-out infinite;
}

.market-up {
	color: var(--ui-up);
}

.market-down {
	color: var(--ui-down);
}

@keyframes pulse {
	to {
		box-shadow: 0 0 0 7px transparent;
	}
}

@media (prefers-reduced-motion: reduce) {
	.market-live[data-running]::before {
		animation: none;
	}
}
</style>
