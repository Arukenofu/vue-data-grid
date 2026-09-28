<script setup lang="ts">
import {
	defineColumn,
	defineColumnGroups,
	defineColumns,
	GridBody,
	GridCells,
	GridGroupCell,
	GridGroupContent,
	GridGroupRow,
	GridGroupToggle,
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
	GridResizeHandle,
	GridRoot,
	GridRow,
	useDataGrid,
} from '@vue-data-grid/core';
import IconMinus from '~icons/lucide/minus';
import IconPlus from '~icons/lucide/plus';
import { h } from 'vue';

import { type BadgeTone, UiBadge, UiButton, UiToolbar } from '@/ui';

import { type ProductSales, productSales } from './data';

const TONES: Readonly<Record<ProductSales['category'], BadgeTone>> = {
	Hardware: 'blue',
	Software: 'violet',
	Services: 'amber',
};

const HALVES = ['firstHalf', 'secondHalf'];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

const column = defineColumn<ProductSales>({ resizable: true, width: 92, align: 'right' });

function revenue(value: (sale: ProductSales) => number, label: string) {
	return column(value, { label, format: amount => money.format(amount) });
}

const columns = defineColumns({
	product: column(sale => sale.product, { label: 'Name', width: 130, align: 'left' }),
	category: column(sale => sale.category, {
		label: 'Category',
		width: 116,
		align: 'left',
		cell: ({ value }) => h(UiBadge, { tone: TONES[value] }, () => value),
	}),
	q1: revenue(sale => sale.q1, 'Q1'),
	q2: revenue(sale => sale.q2, 'Q2'),
	h1: revenue(sale => sale.q1 + sale.q2, 'Total'),
	q3: revenue(sale => sale.q3, 'Q3'),
	q4: revenue(sale => sale.q4, 'Q4'),
	h2: revenue(sale => sale.q3 + sale.q4, 'Total'),
	margin: column(sale => sale.margin, { label: 'Margin', format: margin => `${Math.round(margin * 100)}%` }),
});

const groups = defineColumnGroups({
	item: { label: 'Product', children: ['product', 'category'] },
	revenue: { label: 'Revenue 2026', children: ['firstHalf', 'secondHalf'], keepTogether: true },
	firstHalf: { label: 'H1', children: ['q1', 'q2', 'h1'], showWhen: { q1: 'expanded', q2: 'expanded' } },
	secondHalf: {
		label: 'H2',
		children: ['q3', 'q4', 'h2'],
		showWhen: { q3: 'expanded', q4: 'expanded' },
		collapsedByDefault: true,
	},
});

const grid = useDataGrid({
	columns,
	groups,
	rows: productSales,
	rowKey: 'id',
	rowHeight: 40,
});

function setCollapsed(collapsed: boolean) {
	grid.scope.batch(() => {
		for (const name of HALVES) {
			if (grid.scope.isGroupCollapsed(name) !== collapsed) {
				grid.scope.toggleGroup(name);
			}
		}
	});
}
</script>

<template>
	<div>
		<UiToolbar>
			<UiButton size="sm" @click="setCollapsed(false)">Expand all</UiButton>
			<UiButton size="sm" @click="setCollapsed(true)">Collapse all</UiButton>
		</UiToolbar>

		<GridRoot :grid="grid" label="Revenue by product" class="ui-grid" data-size="auto">
			<GridHeader v-slot="{ groups: levels }">
				<GridGroupRow v-for="(cells, level) in levels" :key="level" :level="level">
					<GridGroupCell v-for="cell in cells" :key="cell.key" :cell="cell">
						<GridGroupContent />
						<GridGroupToggle v-slot="{ collapsed }" class="ui-cell-button">
							<IconPlus v-if="collapsed" />
							<IconMinus v-else />
						</GridGroupToggle>
					</GridGroupCell>
				</GridGroupRow>
				<GridHeaderRow v-slot="{ columns: headers }">
					<GridHeaderCell v-for="header in headers" :key="header.key" :column="header">
						<GridHeaderContent />
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
</template>
