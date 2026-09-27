<script setup lang="ts">
import { defineColumn, defineColumns, useDataTable, useTableMotion } from '@vue-stack/table';
import { h, shallowRef } from 'vue';

import { getChange, type Stock, stocks } from '@/data/stocks';
import { UiDataTable, UiStat, UiToolbar } from '@/ui';

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
		header: () => h('span', { class: 'ui-visually-hidden' }, 'Starred'),
		cell: ({ row, value }) => h(StarButton, { starred: value, label: row.name, onToggle: () => toggleStar(row.id) }),
	}),
	symbol: column(stock => stock.symbol, { label: 'Symbol', width: 96 }),
	name: column(stock => stock.name, { label: 'Company', flex: 1, width: 196 }),
	sector: column(stock => stock.sector, { label: 'Sector', width: 110 }),
	price: column(stock => stock.price, { label: 'Price', width: 84, align: 'right', format: price => price.toFixed(2) }),
	change: column(stock => getChange(stock), {
		label: 'Change',
		width: 100,
		align: 'right',
		format: change => `${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
		cellClass: ({ value }) => (value >= 0 ? 'ui-cell-up' : 'ui-cell-down'),
	}),
});

const table = useDataTable({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 40,
	sort: [{ name: 'change', direction: 'desc' }],
	features: { sorting: starredFirst(starred) },
});

useTableMotion(table);
</script>

<template>
	<div>
		<UiToolbar>
			<span class="ui-toolbar-text">Star a company: it rises above the sort, and stays sorted among the starred.</span>
			<span class="ui-spacer" />
			<UiStat label="Starred" :value="starred.size" />
		</UiToolbar>

		<UiDataTable :table="table" label="Stocks" />
	</div>
</template>
