<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	TableBody,
	TableCells,
	TableEmpty,
	TableHeader,
	TableHeaderCell,
	TableHeaderRow,
	TableLoading,
	TableRoot,
	TableRow,
	useDataTable,
} from 'vue-data-grid';
import IconLoaderCircle from '~icons/lucide/loader-circle';
import IconRefreshCw from '~icons/lucide/refresh-cw';
import IconSearchX from '~icons/lucide/search-x';
import { computed, onBeforeUnmount, shallowRef } from 'vue';

import { type Person, people } from '@/data/people';
import { UiButton, UiInput, UiToolbar } from '@/ui';

const LATENCY = 1400;

const column = defineColumn<Person>();

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name', width: 170 }),
	role: column(person => person.role, { label: 'Role', width: 180, flex: 1 }),
	team: column(person => person.team, { label: 'Team', width: 120 }),
	location: column(person => person.location, { label: 'Location', width: 120 }),
});

const query = shallowRef('');
const loaded = shallowRef<readonly Person[]>(people);
const loading = shallowRef(false);
let timer: ReturnType<typeof setTimeout> | undefined;

const rows = computed(() => {
	const text = query.value.trim().toLowerCase();

	return text === '' ? loaded.value : loaded.value.filter(person => person.name.toLowerCase().includes(text));
});

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
});

function reload() {
	loading.value = true;
	clearTimeout(timer);
	timer = setTimeout(() => {
		loaded.value = [...people].reverse();
		loading.value = false;
	}, LATENCY);
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
	<div>
		<UiToolbar>
			<UiInput v-model="query" label="Search by name" placeholder="Search by name…" search />
			<span class="ui-spacer" />
			<UiButton size="sm" :disabled="loading" @click="reload">
				<IconRefreshCw aria-hidden="true" />
				Reload
			</UiButton>
		</UiToolbar>

		<TableRoot :table="table" label="People" class="ui-table" data-size="sm">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns: headers }">
					<TableHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows: bodyRows }">
				<TableRow v-for="row in bodyRows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
			</TableBody>
			<TableEmpty>
				<span class="empty">
					<IconSearchX class="empty-icon" aria-hidden="true" />
					<strong>No one is called “{{ query }}”</strong>
					<UiButton size="sm" variant="ghost" @click="query = ''">Clear the search</UiButton>
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
.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
}

.empty strong {
	color: var(--ui-fg);
	font-weight: 560;
}

.empty-icon {
	width: 28px;
	height: 28px;
	color: var(--ui-fg-subtle);
}

.spinner {
	width: 14px;
	height: 14px;
	color: var(--ui-accent);
	animation: spin 0.8s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
