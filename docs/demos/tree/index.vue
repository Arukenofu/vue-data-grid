<script setup lang="ts">
import { defineColumn, defineColumns, navigation, tree, treeColumn, useDataGrid } from '@vue-data-grid/core';
import IconChevronsDownUp from '~icons/lucide/chevrons-down-up';
import IconChevronsUpDown from '~icons/lucide/chevrons-up-down';
import { h, shallowRef } from 'vue';

import { UiAvatar, UiBadge, UiButton, UiDataGrid, UiStat, UiToolbar } from '@/ui';

import { managers, org, type OrgMember } from './data';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

const column = defineColumn<OrgMember>({ sortable: true, sortOrder: ['asc', 'desc'] });

const columns = defineColumns({
	name: treeColumn(column(member => member.name, {
		label: 'Name',
		width: 220,
		cell: ({ row }) => h('span', { class: 'member' }, [h(UiAvatar, { name: row.name }), row.name]),
	})),
	title: column(member => member.title, { label: 'Title', width: 190 }),
	reports: column(member => member.reports, {
		label: 'Reports',
		width: 92,
		align: 'right',
		cell: ({ value }) => (value > 0 ? h(UiBadge, { tone: 'green' }, () => value) : ''),
	}),
	cost: column(member => member.cost, { label: 'Org cost', width: 104, align: 'right', format: cost => money.format(cost) }),
});

const expanded = shallowRef<string[] | undefined>(undefined);

const grid = useDataGrid({
	columns,
	rows: org,
	rowKey: 'id',
	rowHeight: 44,
	features: {
		tree: tree({ parentKey: 'manager', expanded, defaultExpanded: 2 }),
		navigation: navigation(),
	},
});

const shown = grid.rows;
</script>

<template>
	<div class="org">
		<UiToolbar>
			<UiButton @click="expanded = [...managers]">
				<IconChevronsUpDown aria-hidden="true" />
				Expand all
			</UiButton>
			<UiButton @click="expanded = []">
				<IconChevronsDownUp aria-hidden="true" />
				Collapse all
			</UiButton>
			<span class="ui-spacer" />
			<UiStat label="Shown" class="shown">{{ shown.length }} of {{ org.length }}</UiStat>
		</UiToolbar>
		<UiDataGrid :grid="grid" label="Organization" />
	</div>
</template>

<style scoped>
.shown {
	justify-content: flex-end;
	min-width: 104px;
}

.org :deep(.member) {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	font-weight: 550;
}
</style>
