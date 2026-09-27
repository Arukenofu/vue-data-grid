<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	TableBody,
	TableCells,
	TableEmpty,
	TableLoading,
	TableRoot,
	TableRow,
	type TableSort,
	useDataTable,
} from '@vue-data-grid/core';
import IconLoaderCircle from '~icons/lucide/loader-circle';
import IconSearchX from '~icons/lucide/search-x';
import { onMounted, shallowRef, watch } from 'vue';

import type { Person } from '@/data/people';
import { UiDataTableHeader, UiInput, UiSlider, UiStat, UiToolbar } from '@/ui';

import { fetchPeople } from './api';

const PAGE_SIZE = 40;
const PREFETCH_ROWS = 10;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const column = defineColumn<Person>({ sortable: true, sortOrder: ['asc', 'desc'] });

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name', width: 170 }),
	team: column(person => person.team, { label: 'Team', width: 130 }),
	location: column(person => person.location, { label: 'Office', width: 120 }),
	salary: column(person => person.salary, {
		label: 'Salary',
		width: 120,
		align: 'right',
		sortOrder: ['desc', 'asc'],
		format: salary => money.format(salary),
	}),
});

const people = shallowRef<readonly Person[]>([]);
const total = shallowRef(0);
const loading = shallowRef(true);
const query = shallowRef('');
const sort = shallowRef<readonly TableSort[]>([]);
const latency = shallowRef(800);

const table = useDataTable({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	sort,
	rowCount: () => (total.value > people.value.length ? total.value : undefined),
});

let request = 0;

async function load(from: number) {
	request += 1;

	const current = request;

	loading.value = true;

	const page = await fetchPeople({ query: query.value, sort: sort.value, offset: from, limit: PAGE_SIZE, latency: latency.value });

	if (current !== request) {
		return;
	}

	people.value = from === 0 ? page.rows : [...people.value, ...page.rows];
	total.value = page.total;
	loading.value = false;
}

onMounted(() => {
	void load(0);
});

watch([query, sort], () => {
	void load(0);
});

watch(() => table.scope.visibleRange.value.end, (end) => {
	const more = people.value.length < total.value;

	if (more && !loading.value && end >= people.value.length - PREFETCH_ROWS) {
		void load(people.value.length);
	}
});
</script>

<template>
	<div>
		<UiToolbar>
			<UiInput v-model="query" label="Search people" placeholder="Search 500 people…" search />
			<UiSlider v-model="latency" label="Latency" :min="0" :max="2000" :step="100" />
			<span class="ui-spacer" />
			<UiStat label="Loaded" :value="`${people.length} of ${total}`" />
		</UiToolbar>
		<TableRoot :table="table" label="People from the server" class="ui-table">
			<UiDataTableHeader />
			<TableBody v-slot="{ rows }">
				<TableRow v-for="row in rows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
			</TableBody>
			<TableEmpty v-if="!loading">
				<span class="state">
					<IconSearchX aria-hidden="true" />
					No one matches “{{ query }}”
				</span>
			</TableEmpty>
			<TableLoading v-if="loading">
				<IconLoaderCircle class="spinner" aria-hidden="true" />
				Loading people…
			</TableLoading>
		</TableRoot>
	</div>
</template>

<style scoped>
.state {
	display: inline-flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	color: var(--ui-fg-muted);
}

.state svg {
	width: 28px;
	height: 28px;
	color: var(--ui-fg-subtle);
}

.spinner {
	color: var(--ui-accent);
	animation: spin 0.8s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
