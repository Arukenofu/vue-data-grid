<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridCellTemplate,
	GridRoot,
	GridRow,
	selection,
	selectionColumn,
	sorting,
	useCellChanges,
	useDataGrid,
} from '@vue-data-grid/core';
import { ref, shallowRef } from 'vue';

import { createRandom } from '@/data/random';
import { getChange, type Stock, stocks, tickStock } from '@/data/stocks';
import { UiButton, UiDataGridHeader, UiToolbar } from '@/ui';

import FlashCell from './FlashCell.vue';
import { useUpdateMeter } from './use-update-meter';

const random = createRandom(42);
const rows = shallowRef(stocks);
const selected = ref<string[]>([]);

const column = defineColumn<Stock>({ sortable: true, resizable: true });

const columns = defineColumns({
	select: selectionColumn(),
	symbol: column(stock => stock.symbol, { label: 'Symbol', width: 90 }),
	name: column(stock => stock.name, { label: 'Company', width: 170, flex: 1 }),
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
		cellClass: ({ value }) => (value >= 0 ? 'tone-up' : 'tone-down'),
	}),
	volume: column(stock => stock.volume, {
		label: 'Volume',
		width: 110,
		align: 'right',
		format: volume => volume.toLocaleString('en-US'),
	}),
	renders: column(() => 0, { label: 'Renders', kind: 'service', width: 88, align: 'center', pinned: 'end', sortable: false, resizable: false }),
});

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: { sorting: sorting(), selection: selection({ selection: selected }) },
});

const changes = useCellChanges(grid.scope, { columns: ['price', 'volume'] });

const renders = new Map<string, number>();
let totalRenders = 0;

function countRender(key: string) {
	const count = (renders.get(key) ?? 0) + 1;

	renders.set(key, count);
	totalRenders += 1;

	return count;
}

const { records, measure, follow } = useUpdateMeter(() => totalRenders);

follow(() => grid.state.sort.value, 'Sort');
follow(selected, 'Selection');
follow(() => grid.state.layout.value, 'Resize or layout');

function pickIndexes(count: number) {
	const indexes = rows.value.map((_, index) => index);

	for (let position = 0; position < count; position += 1) {
		const other = random.int(position, indexes.length - 1);

		[indexes[position], indexes[other]] = [indexes[other], indexes[position]];
	}

	return new Set(indexes.slice(0, count));
}

function updatePrices(count: number) {
	measure(count === 1 ? 'Update 1 price' : `Update ${count} prices`, () => {
		const picked = pickIndexes(count);

		rows.value = rows.value.map((stock, index) => (picked.has(index) ? tickStock(stock, random) : stock));
	});
}

function selectRandom() {
	measure('Select 5 rows', () => {
		selected.value = [...pickIndexes(5)].map(index => rows.value[index].id);
	});
}

function sortByChange() {
	measure('Sort', () => {
		const descending = grid.state.sort.value[0]?.direction !== 'desc';

		grid.state.sort.value = [{ name: 'change', direction: descending ? 'desc' : 'asc' }];
	});
}
</script>

<template>
	<div>
		<UiToolbar>
			<UiButton size="sm" variant="solid" @click="updatePrices(1)">Update 1 price</UiButton>
			<UiButton size="sm" @click="updatePrices(10)">10 prices</UiButton>
			<UiButton size="sm" @click="updatePrices(rows.length)">All prices</UiButton>
			<span class="ui-separator" />
			<UiButton size="sm" @click="sortByChange">Sort by change</UiButton>
			<UiButton size="sm" @click="selectRandom">Select 5 rows</UiButton>
		</UiToolbar>

		<GridRoot :grid="grid" label="Render counts" class="ui-grid" data-size="sm">
			<GridCellTemplate v-slot="{ key, value }" :column="columns.price">
				<FlashCell :text="value.toFixed(2)" :change="() => changes.getChange(key, 'price')" />
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ key, value }" :column="columns.volume">
				<FlashCell :text="value.toLocaleString('en-US')" :change="() => changes.getChange(key, 'volume')" />
			</GridCellTemplate>
			<UiDataGridHeader />
			<GridBody v-slot="{ rows: shown }">
				<GridRow v-for="row in shown" :key="row.key" :row="row">
					<GridCells v-slot="{ column, key }">
						<span v-if="column.name === 'renders'" class="render-count">{{ countRender(key) }}</span>
					</GridCells>
				</GridRow>
			</GridBody>
		</GridRoot>

		<div class="meter" role="status">
			<template v-if="records[0]">
				<span class="meter-label">{{ records[0].label }}</span>
				<span class="meter-figure">{{ records[0].ms.toFixed(1) }} ms</span>
				<span class="meter-figure">{{ records[0].rows }} of {{ rows.length }} rows rendered</span>
			</template>
			<span v-else class="meter-hint">Update a price, sort, select or resize a column: the time and the rows it rendered show here.</span>
			<ol v-if="records.length > 1" class="meter-history" aria-label="Earlier updates">
				<li v-for="record in records.slice(1)" :key="record.id">
					{{ record.label }} · {{ record.ms.toFixed(1) }} ms · {{ record.rows }} rows
				</li>
			</ol>
		</div>
	</div>
</template>

<style scoped>
.render-count {
	min-width: 28px;
	padding: 2px 8px;
	border-radius: 999px;
	background: var(--ui-accent-soft);
	color: var(--ui-accent-text);
	font: 600 12px/1.4 var(--ui-font-mono);
	text-align: center;
}

.meter {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px 14px;
	min-height: 52px;
	margin-block-start: 12px;
	padding: 10px 14px;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
	background: var(--ui-bg);
	font: 400 13px/1.4 var(--ui-font);
}

.meter-label {
	color: var(--ui-fg);
	font-weight: 600;
}

.meter-figure {
	padding: 2px 8px;
	border-radius: 999px;
	background: var(--ui-bg-muted);
	color: var(--ui-fg);
	font: 600 12px/1.4 var(--ui-font-mono);
}

.meter-hint {
	color: var(--ui-fg-muted);
}

.meter-history {
	display: flex;
	flex-basis: 100%;
	flex-wrap: wrap;
	gap: 4px 14px;
	margin: 0;
	padding: 0;
	color: var(--ui-fg-subtle);
	font-size: 12px;
	list-style: none;
}
</style>
