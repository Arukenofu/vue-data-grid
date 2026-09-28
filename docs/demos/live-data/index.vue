<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridCellTemplate,
	sorting,
	useCellChanges,
	useDataGrid,
	useGridMotion,
	useRowStream,
} from '@vue-data-grid/core';
import IconPause from '~icons/lucide/pause';
import IconPlay from '~icons/lucide/play';
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';

import { createRandom } from '@/data/random';
import { getChange, type Stock, stocks, tickStock } from '@/data/stocks';
import { UiButton, UiDataGrid, UiSlider, UiSparkline, UiStat, UiSwitch, UiToolbar } from '@/ui';

const STOCKS_PER_UPDATE = 3;

const random = createRandom(42);
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

let renders = 0;

function quoteProps(key: string, column: string) {
	renders += 1;

	const change = changes.getChange(key, column);

	return { key: change?.at, class: ['quote', change?.direction && `quote-${change.direction}`] };
}

function formatChange(value: number) {
	return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

const column = defineColumn<Stock>({ sortable: true });

const columns = defineColumns({
	symbol: column('symbol', { label: 'Symbol', width: 90, cellClass: () => 'ui-cell-mono ui-cell-strong' }),
	name: column('name', { label: 'Company', width: 136 }),
	price: column('price', {
		label: 'Price',
		width: 88,
		align: 'right',
	}),
	change: column(stock => getChange(stock), {
		label: 'Change',
		width: 98,
		align: 'right',
		cellClass: ({ value }) => (value >= 0 ? 'ui-cell-up' : 'ui-cell-down'),
	}),
	trend: column('history', {
		label: 'Trend',
		width: 96,
		sortable: false,
	}),
	volume: column('volume', { label: 'Volume', width: 94, align: 'right', format: volume => compact.format(volume) }),
});

const stream = useRowStream({ rows: stocks, rowKey: 'id' });

const grid = useDataGrid({
	columns,
	rows: stream.rows,
	rowKey: 'id',
	rowHeight: 40,
	sort: [{ name: 'change', direction: 'desc' }],
	features: { sorting: sorting({ delta: true }) },
});

const changes = useCellChanges(grid.scope, { duration: 900, columns: ['price', 'change'] });

const running = shallowRef(true);
const animated = shallowRef(true);
const perSecond = shallowRef(8);
const updates = shallowRef(0);
const rendered = shallowRef(0);

useGridMotion(grid, { when: () => animated.value });

function update() {
	const picked = Array.from({ length: STOCKS_PER_UPDATE }, () => random.pick(stocks).id);

	stream.apply({
		update: picked.flatMap((key) => {
			const stock = stream.getRow(key);

			return stock ? [tickStock(stock, random)] : [];
		}),
	});
}

let ticker: ReturnType<typeof setInterval> | undefined;
let sampler: ReturnType<typeof setInterval> | undefined;

function schedule() {
	clearInterval(ticker);
	ticker = running.value ? setInterval(update, 1000 / perSecond.value) : undefined;
}

function sample() {
	updates.value = running.value ? perSecond.value * STOCKS_PER_UPDATE : 0;
	rendered.value = renders;
	renders = 0;
}

watch([running, perSecond], schedule);

onMounted(() => {
	schedule();
	sampler = setInterval(sample, 1000);
});

onBeforeUnmount(() => {
	clearInterval(ticker);
	clearInterval(sampler);
});
</script>

<template>
	<div class="ui-stack quotes">
		<UiToolbar>
			<UiButton :variant="running ? 'outline' : 'solid'" @click="running = !running">
				<IconPause v-if="running" aria-hidden="true" />
				<IconPlay v-else aria-hidden="true" />
				{{ running ? 'Pause' : 'Resume' }}
			</UiButton>
			<UiSlider v-model="perSecond" label="Speed" :min="1" :max="30" />
			<UiSwitch v-model="animated" label="Animate" />
			<span class="ui-spacer" />
			<UiStat label="Quotes/s" :value="updates" />
			<UiStat label="Renders/s" :value="rendered" />
		</UiToolbar>

		<UiDataGrid :grid="grid" label="Live quotes">
			<GridCellTemplate v-slot="{ key, value }" :column="columns.price">
				<span v-bind="quoteProps(key, 'price')">{{ value.toFixed(2) }}</span>
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ key, value }" :column="columns.change">
				<span v-bind="quoteProps(key, 'change')">{{ formatChange(value) }}</span>
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ value }" :column="columns.trend">
				<UiSparkline :values="value" />
			</GridCellTemplate>
		</UiDataGrid>
	</div>
</template>

<style scoped>
.quotes :deep(.quote) {
	padding: 2px 5px;
	margin-inline-end: -5px;
	border-radius: 4px;
}

.quotes :deep(.quote-up) {
	animation: flash-up 0.9s ease-out;
}

.quotes :deep(.quote-down) {
	animation: flash-down 0.9s ease-out;
}

@keyframes flash-up {
	from {
		background: var(--ui-up-soft);
	}
}

@keyframes flash-down {
	from {
		background: var(--ui-down-soft);
	}
}

@media (prefers-reduced-motion: reduce) {
	.quotes :deep(.quote-up),
	.quotes :deep(.quote-down) {
		animation: none;
	}
}
</style>
