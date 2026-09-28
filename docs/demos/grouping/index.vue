<script setup lang="ts">
import {
	type ColumnAggregates,
	defineColumn,
	defineColumns,
	GridCellTemplate,
	grouping,
	navigation,
	type RowGroup,
	type RowGroupLevel,
	tree,
	treeColumn,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import { shallowRef } from 'vue';

import { UiBadge, UiDataGrid, UiToggleGroup, UiToolbar } from '@/ui';

import { type SalesRow, salesRows } from './data';

type GroupBy = 'region' | 'country' | 'product';

const GROUPINGS = [
	{ value: 'region', label: 'Region' },
	{ value: 'country', label: 'Region › Country' },
	{ value: 'product', label: 'Category › Product' },
] as const;

const LEVELS: Readonly<Record<GroupBy, readonly RowGroupLevel<SalesRow>[]>> = {
	region: [{ name: 'region', value: row => row.region }],
	country: [{ name: 'region', value: row => row.region }, { name: 'country', value: row => row.country }],
	product: [{ name: 'category', value: row => row.category }, { name: 'product', value: row => row.product }],
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function sum(rows: readonly SalesRow[], read: (row: SalesRow) => number) {
	return rows.reduce((total, row) => total + read(row), 0);
}

function formatMargin(revenue: number, cost: number) {
	return revenue === 0 ? '' : `${Math.round(((revenue - cost) / revenue) * 100)}%`;
}

const column = defineColumn<SalesRow>({ sortable: true });
const amount = defineColumn<SalesRow>({ sortable: true, align: 'right', width: 110 });

const columns = defineColumns({
	label: treeColumn(column('label', {
		label: 'Group',
		width: 216,
		sortOrder: ['asc', 'desc'],
		footer: () => 'Total',
	})),
	units: amount('units', {
		label: 'Units',
		width: 84,
		format: units => units.toLocaleString('en-US'),
		aggregate: 'sum',
		footer: ({ aggregate }) => (aggregate ?? 0).toLocaleString('en-US'),
	}),
	revenue: amount('revenue', {
		label: 'Revenue',
		format: revenue => money.format(revenue),
		aggregate: 'sum',
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	}),
	cost: amount('cost', {
		label: 'Cost',
		format: cost => money.format(cost),
		aggregate: 'sum',
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	}),
	margin: amount(row => (row.revenue - row.cost) / row.revenue, {
		label: 'Margin',
		width: 80,
		format: margin => `${Math.round(margin * 100)}%`,
		footer: ({ rows }) => formatMargin(sum(rows, row => row.revenue), sum(rows, row => row.cost)),
	}),
});

function createGroup(group: RowGroup<SalesRow, ColumnAggregates<typeof columns>>): SalesRow {
	const [first] = group.rows;

	return {
		...first,
		id: group.key,
		label: String(group.value),
		quarter: null,
		units: group.aggregates.units ?? 0,
		revenue: group.aggregates.revenue ?? 0,
		cost: group.aggregates.cost ?? 0,
		count: group.rows.length,
		children: group.children,
	};
}

const groupBy = shallowRef<GroupBy>('country');

const grid = useDataGrid({
	columns,
	rows: salesRows,
	rowKey: 'id',
	rowHeight: 40,
	sort: [{ name: 'revenue', direction: 'desc' }],
	features: {
		grouping: grouping({ by: () => LEVELS[groupBy.value], createGroup }),
		tree: tree({ childrenField: 'children', defaultExpanded: 1 }),
		navigation: navigation(),
	},
});

useGridMotion(grid);
</script>

<template>
	<div class="sales">
		<UiToolbar>
			<span class="ui-toolbar-text">Group by</span>
			<UiToggleGroup v-model="groupBy" :options="GROUPINGS" label="Group by" />
		</UiToolbar>
		<UiDataGrid :grid="grid" label="Sales" footer>
			<GridCellTemplate v-slot="{ row, value }" :column="columns.label">
				<span v-if="row.count > 0" class="group-label">
					{{ value }}
					<UiBadge>{{ row.count }}</UiBadge>
				</span>
			</GridCellTemplate>
		</UiDataGrid>
	</div>
</template>

<style scoped>
.group-label {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	font-weight: 600;
}
</style>
