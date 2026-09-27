<script setup lang="ts">
import {
	defineColumn,
	defineColumnGroups,
	defineColumns,
	sorting,
	TableBody,
	TableCells,
	TableFooter,
	TableFooterCell,
	TableFooterRow,
	TableGroupCell,
	TableGroupContent,
	TableGroupRow,
	TableGroupToggle,
	TableHeader,
	TableHeaderCell,
	TableHeaderContent,
	TableHeaderRow,
	TableRoot,
	TableRow,
	TableSortIndicator,
	useDataTable,
	useTableMotion,
} from '@vue-stack/table';
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

const table = useDataTable({
	columns,
	groups,
	rows: productYears,
	rowKey: 'id',
	rowHeight: 40,
	features: { sorting: sorting() },
});

useTableMotion(table);

function setCollapsed(collapsed: boolean) {
	table.scope.batch(() => {
		for (const name of HALVES) {
			if (table.scope.isGroupCollapsed(name) !== collapsed) {
				table.scope.toggleGroup(name);
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
		<TableRoot :table="table" label="Revenue by product" class="ui-table" data-size="auto">
			<TableHeader v-slot="{ groups: levels }">
				<TableGroupRow v-for="(cells, level) in levels" :key="level" :level="level">
					<TableGroupCell v-for="cell in cells" :key="cell.key" :cell="cell">
						<TableGroupContent />
						<TableGroupToggle v-slot="{ collapsed }" class="ui-cell-button">
							<IconChevronRight v-if="collapsed" aria-hidden="true" />
							<IconChevronLeft v-else aria-hidden="true" />
						</TableGroupToggle>
					</TableGroupCell>
				</TableGroupRow>
				<TableHeaderRow v-slot="{ columns: shown }">
					<TableHeaderCell v-for="rendered in shown" :key="rendered.key" :column="rendered">
						<TableHeaderContent />
						<TableSortIndicator v-slot="{ direction, sortIndex }">
							<UiSortIcon :direction="direction" :sort-index="sortIndex" />
						</TableSortIndicator>
					</TableHeaderCell>
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows }">
				<TableRow v-for="row in rows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
			</TableBody>
			<TableFooter>
				<TableFooterRow v-slot="{ columns: shown }">
					<TableFooterCell v-for="rendered in shown" :key="rendered.key" :column="rendered" />
				</TableFooterRow>
			</TableFooter>
		</TableRoot>
	</div>
</template>
