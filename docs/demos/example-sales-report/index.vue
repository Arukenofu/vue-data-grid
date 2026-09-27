<script setup lang="ts">
import { grouping, navigation, tree, useDataTable, useTableMotion } from 'vue-data-grid';
import IconFoldVertical from '~icons/lucide/fold-vertical';
import IconUnfoldVertical from '~icons/lucide/unfold-vertical';
import { computed, ref, shallowRef, watch } from 'vue';

import { sales } from '@/data/sales';
import { type Option, UiButton, UiDataTable, UiStat, UiSwitch, UiToggleGroup, UiToolbar } from '@/ui';

import { columns, groups } from './columns';
import { collectGroups, getMargin, GROUPINGS, type Grouping, money, type ReportRow, toLines } from './report';

const GROUP_OPTIONS: readonly Option<Grouping>[] = [
	{ value: 'region', label: 'Region' },
	{ value: 'category', label: 'Product' },
	{ value: 'quarter', label: 'Quarter' },
];

const groupBy = shallowRef<Grouping>('region');
const expanded = ref<string[]>();

const rows = computed(() => toLines(sales, groupBy.value));

const table = useDataTable({
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

useTableMotion(table);

watch(groupBy, () => {
	expanded.value = undefined;
});

const detailed = computed({
	get: () => !table.scope.isGroupCollapsed('money'),
	set: (value: boolean) => table.scope.batch(() => {
		for (const name of Object.keys(groups)) {
			if (table.scope.isGroupCollapsed(name) === value) {
				table.scope.toggleGroup(name);
			}
		}
	}),
});

const revenue = computed(() => rows.value.reduce((sum, row) => sum + row.revenue, 0));
const margin = computed(() => getMargin(rows.value));

function expandAll() {
	expanded.value = collectGroups(table.grouping.rows.value);
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

		<UiDataTable :table="table" label="Sales report" footer data-size="lg" />
	</div>
</template>
