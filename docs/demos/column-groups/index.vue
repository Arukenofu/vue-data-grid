<script setup lang="ts">
import {
	defineColumn,
	defineColumnGroups,
	defineColumns,
	GridBody,
	GridCells,
	GridFooter,
	GridFooterCell,
	GridFooterRow,
	GridGroupCell,
	GridGroupContent,
	GridGroupRow,
	GridGroupToggle,
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
	GridRoot,
	GridRow,
	GridSortIndicator,
	sorting,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import IconChevronLeft from '~icons/lucide/chevron-left';
import IconChevronRight from '~icons/lucide/chevron-right';
import IconFoldHorizontal from '~icons/lucide/fold-horizontal';
import IconUnfoldHorizontal from '~icons/lucide/unfold-horizontal';

import { UiButton, UiSortIcon, UiToolbar } from '@/ui';

import { type ProductYear, productYears } from './data';

const money = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	notation: 'compact',
	maximumFractionDigits: 1,
});

const column = defineColumn<ProductYear>({ sortable: true });
const amount = defineColumn<ProductYear>({ sortable: true, align: 'right', width: 92 });

function revenue(label: string, read: (row: ProductYear) => number, width = 92) {
	return amount(read, {
		label,
		width,
		format: value => money.format(value),
		aggregate: 'sum',
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	});
}

const columns = defineColumns({
	product: column(row => row.product, { label: 'Name', width: 140, footer: () => 'Total' }),
	category: column(row => row.category, { label: 'Category', width: 108 }),
	q1: revenue('Q1', row => row.q1),
	q2: revenue('Q2', row => row.q2),
	h1: revenue('Total', row => row.q1 + row.q2, 128),
	q3: revenue('Q3', row => row.q3),
	q4: revenue('Q4', row => row.q4),
	h2: revenue('Total', row => row.q3 + row.q4, 128),
	year: revenue('Year', row => row.q1 + row.q2 + row.q3 + row.q4, 100),
	units: amount(row => row.units, { label: 'Units', aggregate: 'sum', footer: ({ aggregate }) => aggregate?.toLocaleString('en-US') }),
	returns: amount(row => row.returns, { label: 'Returns', aggregate: 'sum', footer: ({ aggregate }) => aggregate?.toLocaleString('en-US') }),
});

const groups = defineColumnGroups({
	item: { label: 'Product', children: ['product', 'category'], keepTogether: true },
	revenue: { label: 'Revenue 2026', children: ['firstHalf', 'secondHalf', 'year'], keepTogether: true },
	firstHalf: {
		label: 'Jan – Jun',
		children: ['q1', 'q2', 'h1'],
		showWhen: { q1: 'expanded', q2: 'expanded', h1: 'collapsed' },
	},
	secondHalf: {
		label: 'Jul – Dec',
		children: ['q3', 'q4', 'h2'],
		showWhen: { q3: 'expanded', q4: 'expanded', h2: 'collapsed' },
		collapsedByDefault: true,
	},
	volume: { label: 'Volume', children: ['units', 'returns'] },
});

const HALVES = ['firstHalf', 'secondHalf'];

const grid = useDataGrid({
	columns,
	groups,
	rows: productYears,
	rowKey: 'id',
	rowHeight: 40,
	features: { sorting: sorting() },
});

useGridMotion(grid);

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
			<UiButton @click="setCollapsed(false)">
				<IconUnfoldHorizontal aria-hidden="true" />
				Show quarters
			</UiButton>
			<UiButton @click="setCollapsed(true)">
				<IconFoldHorizontal aria-hidden="true" />
				Show halves
			</UiButton>
		</UiToolbar>
		<GridRoot :grid="grid" label="Revenue by product" class="ui-grid" data-size="auto">
			<GridHeader v-slot="{ groups: levels }">
				<GridGroupRow v-for="(cells, level) in levels" :key="level" :level="level">
					<GridGroupCell v-for="cell in cells" :key="cell.key" :cell="cell">
						<GridGroupContent />
						<GridGroupToggle v-slot="{ collapsed }" class="ui-cell-button">
							<IconChevronRight v-if="collapsed" aria-hidden="true" />
							<IconChevronLeft v-else aria-hidden="true" />
						</GridGroupToggle>
					</GridGroupCell>
				</GridGroupRow>
				<GridHeaderRow v-slot="{ columns: shown }">
					<GridHeaderCell v-for="rendered in shown" :key="rendered.key" :column="rendered">
						<GridHeaderContent />
						<GridSortIndicator v-slot="{ direction, sortIndex }">
							<UiSortIcon :direction="direction" :sort-index="sortIndex" />
						</GridSortIndicator>
					</GridHeaderCell>
				</GridHeaderRow>
			</GridHeader>
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
			<GridFooter>
				<GridFooterRow v-slot="{ columns: shown }">
					<GridFooterCell v-for="rendered in shown" :key="rendered.key" :column="rendered" />
				</GridFooterRow>
			</GridFooter>
		</GridRoot>
	</div>
</template>
