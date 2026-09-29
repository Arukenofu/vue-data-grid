<script setup lang="ts">
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridEmpty,
	GridLoading,
	GridPlaceholderRows,
	GridRoot,
	GridRow,
	type GridSort,
	useDataGrid,
} from '@vue-data-grid/core';
import IconChevronLeft from '~icons/lucide/chevron-left';
import IconChevronRight from '~icons/lucide/chevron-right';
import { computed, shallowRef, watch } from 'vue';

import type { Person } from '@/data/people';
import { UiButton, UiDataGridHeader, UiSelect, UiStat, UiToolbar } from '@/ui';

import { fetchPeoplePage } from './api';

const ROW_HEIGHT = 40;

const PAGE_SIZES = [
	{ value: 10, label: '10 per page' },
	{ value: 20, label: '20 per page' },
	{ value: 50, label: '50 per page' },
];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const column = defineColumn<Person>({ sortable: true, sortOrder: ['asc', 'desc'] });

const columns = defineColumns({
	name: column('name', { label: 'Name', width: 170 }),
	team: column('team', { label: 'Team', width: 130 }),
	location: column('location', { label: 'Office', width: 120 }),
	salary: column('salary', {
		label: 'Salary',
		width: 120,
		flex: 1,
		align: 'right',
		sortOrder: ['desc', 'asc'],
		format: salary => money.format(salary),
	}),
});

const page = shallowRef(0);
const size = shallowRef(20);
const sort = shallowRef<readonly GridSort[]>([]);

const { data, isPending, isPlaceholderData } = useQuery({
	queryKey: ['people', page, size, sort],
	queryFn: () => fetchPeoplePage({ page: page.value, size: size.value, sort: sort.value }),
	placeholderData: keepPreviousData,
});

const people = computed(() => data.value?.rows ?? []);
const total = computed(() => data.value?.total ?? 0);
const pages = computed(() => Math.max(Math.ceil(total.value / size.value), 1));
const shown = computed(() => {
	const offset = data.value?.offset ?? 0;

	return people.value.length === 0 ? 'none' : `${offset + 1}–${offset + people.value.length} of ${total.value}`;
});

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: ROW_HEIGHT,
	sort,
	rowCount: () => data.value?.total,
	rowIndexOffset: () => data.value?.offset ?? 0,
});

watch([size, sort], () => {
	page.value = 0;
});
</script>

<template>
	<div>
		<UiToolbar>
			<UiStat label="People" :value="shown" />
			<span class="ui-spacer" />
			<UiSelect v-model="size" :options="PAGE_SIZES" label="Rows per page" size="sm" />
		</UiToolbar>
		<GridRoot :grid="grid" label="People, page by page" class="ui-grid">
			<UiDataGridHeader />
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
			<GridPlaceholderRows v-if="isPending" :count="size" />
			<GridEmpty />
			<GridLoading v-if="isPlaceholderData">Loading page {{ page + 1 }}…</GridLoading>
		</GridRoot>
		<nav class="pager" aria-label="Pages">
			<UiButton size="sm" icon aria-label="Previous page" :disabled="page === 0" @click="page -= 1">
				<IconChevronLeft aria-hidden="true" />
			</UiButton>
			<span>Page {{ page + 1 }} of {{ pages }}</span>
			<UiButton size="sm" icon aria-label="Next page" :disabled="page + 1 >= pages" @click="page += 1">
				<IconChevronRight aria-hidden="true" />
			</UiButton>
		</nav>
	</div>
</template>

<style scoped>
.pager {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
	margin-block-start: 12px;
	color: var(--ui-fg-muted);
	font: 400 12.5px/1.4 var(--ui-font);
}
</style>
