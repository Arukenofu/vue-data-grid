<script setup lang="ts">
import {
	GridCellTemplate,
	GridFooterTemplate,
	grouping,
	navigation,
	tree,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import IconFoldVertical from '~icons/lucide/fold-vertical';
import IconUnfoldVertical from '~icons/lucide/unfold-vertical';
import { computed, ref, shallowRef, watch } from 'vue';

import { sales } from '@/data/sales';
import { type Option, UiButton, UiDataGrid, UiStat, UiSwitch, UiToggleGroup, UiToolbar } from '@/ui';

import { columns, groups } from './columns';
import MarginCell from './MarginCell.vue';
import { collectGroups, getMargin, GROUPINGS, type Grouping, money, type ReportRow, toLines } from './report';

const GROUP_OPTIONS: readonly Option<Grouping>[] = [
	{ value: 'region', label: 'Region' },
	{ value: 'category', label: 'Product' },
	{ value: 'quarter', label: 'Quarter' },
];

const groupBy = shallowRef<Grouping>('region');
const expanded = ref<string[]>();

const rows = computed(() => toLines(sales, groupBy.value));

const grid = useDataGrid({
	columns,
	groups,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	sort: [{ name: 'revenue', direction: 'desc' }],
	features: {
		grouping: grouping<ReportRow, typeof columns>({
			by: () => GROUPINGS[groupBy.value].levels,
			createGroup: group => ({
				id: group.key,
				label: String(group.value),
				units: group.aggregates.units ?? 0,
				revenue: group.aggregates.revenue ?? 0,
				cost: group.aggregates.cost ?? 0,
				children: group.children,
			}),
		}),
		tree: tree<ReportRow>({ childrenField: 'children', expanded, defaultExpanded: 1 }),
		navigation: navigation(),
	},
});

useGridMotion(grid);

watch(groupBy, () => {
	expanded.value = undefined;
});

const detailed = computed({
	get: () => !grid.scope.isGroupCollapsed('money'),
	set: (value: boolean) => grid.scope.batch(() => {
		for (const name of Object.keys(groups)) {
			if (grid.scope.isGroupCollapsed(name) === value) {
				grid.scope.toggleGroup(name);
			}
		}
	}),
});

const revenue = computed(() => rows.value.reduce((sum, row) => sum + row.revenue, 0));
const margin = computed(() => getMargin(rows.value));

function expandAll() {
	expanded.value = collectGroups(grid.grouping.rows.value);
}

function collapseAll() {
	expanded.value = [];
}
</script>

<template>
	<div>
		<UiToolbar>
			<UiToggleGroup v-model="groupBy" :options="GROUP_OPTIONS" label="Group by" />
			<span class="ui-separator" />
			<UiButton @click="expandAll">
				<IconUnfoldVertical aria-hidden="true" />
				Expand all
			</UiButton>
			<UiButton @click="collapseAll">
				<IconFoldVertical aria-hidden="true" />
				Collapse all
			</UiButton>
			<span class="ui-separator" />
			<UiSwitch v-model="detailed" label="All columns" />
			<span class="ui-spacer" />
			<UiStat label="Revenue" :value="money.format(revenue)" />
			<UiStat label="Margin" :value="margin === null ? '—' : `${(margin * 100).toFixed(1)}%`" />
		</UiToolbar>

		<UiDataGrid :grid="grid" label="Sales report" footer data-size="lg">
			<GridCellTemplate v-slot="{ value }" :column="columns.margin">
				<MarginCell :value="value" />
			</GridCellTemplate>
			<GridFooterTemplate v-slot="{ rows: footerRows }" :column="columns.margin">
				<MarginCell :value="getMargin(footerRows)" />
			</GridFooterTemplate>
		</UiDataGrid>
	</div>
</template>
