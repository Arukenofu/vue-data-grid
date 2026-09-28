<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridFooter,
	GridFooterCell,
	GridFooterRow,
	GridRoot,
	GridRow,
	selection,
	selectionColumn,
	useDataGrid,
	useStickyOffset,
} from '@vue-data-grid/core';
import { shallowRef } from 'vue';

import { type Person, people } from '@/data/people';
import { UiButton, UiDataGridHeader, UiStat, UiToolbar } from '@/ui';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const column = defineColumn<Person>();

const columns = defineColumns({
	select: selectionColumn(),
	name: column(person => person.name, { label: 'Name', width: 170, flex: 1, aggregate: 'count', footer: ({ aggregate }) => `${aggregate} people` }),
	team: column(person => person.team, { label: 'Team', width: 120 }),
	projects: column(person => person.projects, { label: 'Projects', width: 90, align: 'right' }),
	salary: column(person => person.salary, {
		label: 'Salary',
		width: 120,
		align: 'right',
		format: salary => money.format(salary),
		aggregate: 'sum',
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	}),
});

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 38,
	features: { selection: selection() },
});

const bar = shallowRef<HTMLElement | null>(null);
const barHeight = useStickyOffset(bar);
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<UiStat label="headHeight" :value="`${grid.headHeight.value}px`" />
			<UiStat label="footHeight" :value="`${grid.footHeight.value}px`" />
			<UiStat label="The bar" :value="`${barHeight}px`" />
			<span class="ui-toolbar-text">Select rows to show a bar on the footer.</span>
		</UiToolbar>

		<GridRoot :grid="grid" label="People" class="ui-grid" data-size="sm">
			<UiDataGridHeader />
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
			<div
				v-if="grid.selection.selectedCount.value > 0"
				ref="bar"
				class="bulk-bar"
				:style="{ insetBlockEnd: `${grid.footHeight.value}px` }"
			>
				<span>{{ grid.selection.selectedCount.value }} selected</span>
				<UiButton size="sm" @click="grid.selection.setAll(false)">Clear</UiButton>
			</div>
			<GridFooter>
				<GridFooterRow v-slot="{ columns: footerColumns }">
					<GridFooterCell v-for="footerColumn in footerColumns" :key="footerColumn.key" :column="footerColumn" />
				</GridFooterRow>
			</GridFooter>
		</GridRoot>
	</div>
</template>

<style scoped>
.bulk-bar {
	position: sticky;
	inset-inline-start: 0;
	z-index: 4;
	display: flex;
	flex: none;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 6px 12px;
	border-block-start: 1px solid var(--ui-border);
	background: var(--ui-accent-soft);
	color: var(--ui-accent-text);
	font: 500 13px/1.4 var(--ui-font);
}
</style>
