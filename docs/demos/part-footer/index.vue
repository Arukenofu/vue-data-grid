<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	type RuntimeColumn,
	TableBody,
	TableCells,
	TableFooter,
	TableFooterCell,
	TableFooterRow,
	TableHeader,
	TableHeaderCell,
	TableHeaderRow,
	TableRoot,
	TableRow,
	useDataTable,
} from '@vue-stack/table';
import { computed, shallowRef } from 'vue';

import { type Region, type Sale, sales } from '@/data/sales';
import { UiToggleGroup, UiToolbar } from '@/ui';

type RegionFilter = Region | 'all';

const REGIONS = [
	{ value: 'all', label: 'All regions' },
	{ value: 'Americas', label: 'Americas' },
	{ value: 'Europe', label: 'Europe' },
	{ value: 'Asia Pacific', label: 'Asia Pacific' },
] as const;

const AVERAGED = new Set(['units', 'revenue', 'cost']);

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const count = new Intl.NumberFormat('en-US');

const column = defineColumn<Sale>({ width: 120, align: 'right' });

const columns = defineColumns({
	product: column(sale => sale.product, {
		label: 'Product',
		width: 150,
		flex: 1,
		align: 'left',
		aggregate: 'count',
		footer: ({ aggregate }) => `${aggregate} sales`,
	}),
	region: column(sale => sale.region, { label: 'Region', width: 130, align: 'left' }),
	quarter: column(sale => sale.quarter, { label: 'Quarter', width: 90, align: 'left' }),
	units: column(sale => sale.units, {
		label: 'Units',
		width: 90,
		aggregate: 'sum',
		footer: ({ aggregate }) => count.format(aggregate ?? 0),
	}),
	revenue: column(sale => sale.revenue, {
		label: 'Revenue',
		format: revenue => money.format(revenue),
		aggregate: 'sum',
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	}),
	cost: column(sale => sale.cost, {
		label: 'Cost',
		format: cost => money.format(cost),
		aggregate: 'sum',
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	}),
	margin: column(sale => (sale.revenue - sale.cost) / sale.revenue, {
		label: 'Margin',
		width: 96,
		format: margin => `${Math.round(margin * 100)}%`,
		aggregate: (_margins, rows) => {
			let revenue = 0;
			let profit = 0;

			for (const sale of rows) {
				revenue += sale.revenue;
				profit += sale.revenue - sale.cost;
			}

			return revenue === 0 ? 0 : profit / revenue;
		},
		footer: ({ aggregate }) => `${Math.round(aggregate * 100)}%`,
	}),
});

const region = shallowRef<RegionFilter>('all');

const rows = computed(() => (region.value === 'all' ? sales : sales.filter(sale => sale.region === region.value)));

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
});

function average(column: RuntimeColumn, shown: readonly unknown[]) {
	if (column.name === 'product') {
		return 'Average sale';
	}

	if (!AVERAGED.has(column.name) || shown.length === 0) {
		return '';
	}

	let total = 0;

	for (const row of shown) {
		total += Number(column.value(row));
	}

	const mean = total / shown.length;

	return column.format ? column.format(mean, undefined) : count.format(Math.round(mean));
}
</script>

<template>
	<div>
		<UiToolbar>
			<UiToggleGroup v-model="region" :options="REGIONS" label="Region" />
		</UiToolbar>

		<TableRoot :table="table" label="Sales" class="ui-table">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns: headers }">
					<TableHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows: bodyRows }">
				<TableRow v-for="row in bodyRows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
			</TableBody>
			<TableFooter>
				<TableFooterRow v-slot="{ columns: footers }">
					<TableFooterCell v-for="footer in footers" :key="footer.key" :column="footer" />
				</TableFooterRow>
				<TableFooterRow v-slot="{ columns: footers }" :index="1">
					<TableFooterCell v-for="footer in footers" :key="footer.key" v-slot="{ column, rows: shown }" :column="footer" class="ui-cell-muted">
						{{ average(column, shown) }}
					</TableFooterCell>
				</TableFooterRow>
			</TableFooter>
		</TableRoot>
	</div>
</template>
