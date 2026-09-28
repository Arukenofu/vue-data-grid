<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridCellTemplate,
	GridHeaderTemplate,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import { shallowRef } from 'vue';

import { getChange, type Stock, stocks } from '@/data/stocks';
import { UiDataGrid, UiStat, UiToolbar } from '@/ui';

import StarButton from './StarButton.vue';
import { starredFirst } from './starred-first';

const starred = shallowRef<ReadonlySet<string>>(new Set(['NOVA', 'JUNO']));

function toggleStar(key: string) {
	const next = new Set(starred.value);

	if (!next.delete(key)) {
		next.add(key);
	}

	starred.value = next;
}

const column = defineColumn<Stock>({ sortable: true });

const columns = defineColumns({
	star: column(stock => starred.value.has(stock.id), {
		label: 'Starred',
		kind: 'service',
		width: 48,
		align: 'center',
		sortable: false,
	}),
	symbol: column('symbol', { label: 'Symbol', width: 96 }),
	name: column('name', { label: 'Company', flex: 1, width: 196 }),
	sector: column('sector', { label: 'Sector', width: 110 }),
	price: column('price', { label: 'Price', width: 84, align: 'right', format: price => price.toFixed(2) }),
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
	rowHeight: 40,
	sort: [{ name: 'change', direction: 'desc' }],
	features: { sorting: starredFirst(starred) },
});

useGridMotion(grid);
</script>

<template>
	<div>
		<UiToolbar>
			<span class="ui-toolbar-text">Star a company: it rises above the sort, and stays sorted among the starred.</span>
			<span class="ui-spacer" />
			<UiStat label="Starred" :value="starred.size" />
		</UiToolbar>

		<UiDataGrid :grid="grid" label="Stocks">
			<GridHeaderTemplate :column="columns.star">
				<span class="ui-visually-hidden">Starred</span>
			</GridHeaderTemplate>
			<GridCellTemplate v-slot="{ row, value }" :column="columns.star">
				<StarButton :starred="value" :label="row.name" @toggle="toggleStar(row.id)" />
			</GridCellTemplate>
		</UiDataGrid>
	</div>
</template>
