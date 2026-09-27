<script setup lang="ts">
import {
	downloadCsv,
	localStorageStore,
	navigation,
	selection,
	sorting,
	TableBody,
	TableCells,
	TableEmpty,
	TableRoot,
	TableRow,
	toCsv,
	useDataTable,
	useTableMotion,
} from '@vue-data-grid/core';
import { TableColumnDrag, TableDragPreview } from '@vue-data-grid/core/drag-and-drop';
import IconDownload from '~icons/lucide/download';
import IconMail from '~icons/lucide/mail';
import IconUserX from '~icons/lucide/user-x';
import IconX from '~icons/lucide/x';
import { computed, shallowRef } from 'vue';

import { people as initialPeople, type Person, type Team } from '@/data/people';
import { type SelectOption, UiButton, UiDataTableHeader, UiInput, UiSelect, UiStat, UiToolbar } from '@/ui';

import { columns } from './columns';
import ColumnsMenu from './ColumnsMenu.vue';

type TeamFilter = Team | 'all';

const TEAMS: readonly SelectOption<TeamFilter>[] = [
	{ value: 'all', label: 'All teams' },
	{ value: 'Design', label: 'Design' },
	{ value: 'Engineering', label: 'Engineering' },
	{ value: 'Marketing', label: 'Marketing' },
	{ value: 'Sales', label: 'Sales' },
	{ value: 'Support', label: 'Support' },
];

const people = shallowRef<readonly Person[]>(initialPeople);
const query = shallowRef('');
const team = shallowRef<TeamFilter>('all');

const filtered = computed(() => {
	const text = query.value.trim().toLowerCase();

	return people.value.filter(person => (team.value === 'all' || person.team === team.value)
		&& `${person.name} ${person.email} ${person.role}`.toLowerCase().includes(text));
});

const table = useDataTable({
	columns,
	rows: filtered,
	rowKey: 'id',
	rowHeight: 52,
	multiSort: true,
	persist: localStorageStore('team-directory'),
	features: {
		sorting: sorting(),
		selection: selection(),
		navigation: navigation(),
	},
});

useTableMotion(table);

const selected = computed(() => people.value.filter(person => table.selection.isSelected(person.id)));

function clearFilters() {
	query.value = '';
	team.value = 'all';
}

function exportCsv() {
	const shown = table.scope.columns.value.flatMap(item => (item.column ? [item.column] : []));

	downloadCsv(toCsv({ columns: shown, rows: selected.value }), { name: 'team' });
}

async function copyEmails() {
	await navigator.clipboard.writeText(selected.value.map(person => person.email).join(', '));
}

function remove() {
	people.value = people.value.filter(person => !table.selection.isSelected(person.id));
	table.selection.clear();
}
</script>

<template>
	<div class="directory">
		<UiToolbar>
			<UiInput v-model="query" label="Search people" placeholder="Search people…" search />
			<UiSelect v-model="team" :options="TEAMS" label="Team" />
			<span class="ui-spacer" />
			<UiStat label="People" :value="filtered.length" />
			<ColumnsMenu :scope="table.scope" @reset="table.state.reset()" />
		</UiToolbar>

		<div class="directory-table">
			<TableRoot :table="table" label="Team directory" class="ui-table" data-size="lg">
				<TableColumnDrag>
					<UiDataTableHeader />
					<TableDragPreview />
				</TableColumnDrag>
				<TableBody v-slot="{ rows }">
					<TableRow v-for="row in rows" :key="row.key" :row="row">
						<TableCells />
					</TableRow>
				</TableBody>
				<TableEmpty>
					<span class="directory-empty">
						No one matches these filters.
						<UiButton size="sm" @click="clearFilters">Clear filters</UiButton>
					</span>
				</TableEmpty>
			</TableRoot>

			<Transition name="bulk">
				<div v-if="selected.length > 0" class="bulk" role="region" aria-label="Actions for the selected people">
					<span class="bulk-count">{{ selected.length }} selected</span>
					<UiButton size="sm" variant="ghost" @click="copyEmails">
						<IconMail aria-hidden="true" />
						Copy emails
					</UiButton>
					<UiButton size="sm" variant="ghost" @click="exportCsv">
						<IconDownload aria-hidden="true" />
						Export CSV
					</UiButton>
					<UiButton size="sm" variant="ghost" @click="remove">
						<IconUserX aria-hidden="true" />
						Remove
					</UiButton>
					<UiButton size="sm" variant="ghost" icon aria-label="Clear the selection" @click="table.selection.clear()">
						<IconX aria-hidden="true" />
					</UiButton>
				</div>
			</Transition>
		</div>
	</div>
</template>

<style scoped>
.directory-table {
	position: relative;
	display: flex;
}

.directory-empty {
	display: inline-flex;
	align-items: center;
	gap: 12px;
}

.bulk {
	position: absolute;
	inset-block-end: 20px;
	left: 50%;
	z-index: 6;
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 6px 6px 6px 16px;
	border: 1px solid var(--ui-border);
	border-radius: 999px;
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-lg);
	translate: -50% 0;
}

.bulk-count {
	margin-inline-end: 8px;
	font-size: 13px;
	font-weight: 600;
}

.bulk-enter-active,
.bulk-leave-active {
	transition: opacity 0.2s, translate 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.bulk-enter-from,
.bulk-leave-to {
	opacity: 0;
	translate: -50% 12px;
}
</style>
