<script setup lang="ts">
import {
	downloadCsv,
	GridBody,
	GridCells,
	GridCellTemplate,
	GridEmpty,
	GridRoot,
	GridRow,
	localStorageStore,
	navigation,
	selection,
	sorting,
	toCsv,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import { GridColumnDrag, GridDragPreview } from '@vue-data-grid/core/drag-and-drop';
import IconDownload from '~icons/lucide/download';
import IconMail from '~icons/lucide/mail';
import IconUserX from '~icons/lucide/user-x';
import IconX from '~icons/lucide/x';
import { computed, shallowRef } from 'vue';

import { people as initialPeople, type Person, type Team } from '@/data/people';
import { type SelectOption, UiBadge, UiButton, UiDataGridHeader, UiInput, UiSelect, UiStat, UiToolbar } from '@/ui';

import { columns, PRESENCE, TEAM_TONES } from './columns';
import ColumnsMenu from './ColumnsMenu.vue';
import PersonCell from './PersonCell.vue';

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

const grid = useDataGrid({
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

useGridMotion(grid);

const selected = computed(() => people.value.filter(person => grid.selection.isSelected(person.id)));

function clearFilters() {
	query.value = '';
	team.value = 'all';
}

function exportCsv() {
	const shown = grid.scope.columns.value.flatMap(item => (item.column ? [item.column] : []));

	downloadCsv(toCsv({ columns: shown, rows: selected.value }), { name: 'team' });
}

async function copyEmails() {
	await navigator.clipboard.writeText(selected.value.map(person => person.email).join(', '));
}

function remove() {
	people.value = people.value.filter(person => !grid.selection.isSelected(person.id));
	grid.selection.clear();
}
</script>

<template>
	<div class="directory">
		<UiToolbar>
			<UiInput v-model="query" label="Search people" placeholder="Search people…" search />
			<UiSelect v-model="team" :options="TEAMS" label="Team" />
			<span class="ui-spacer" />
			<UiStat label="People" :value="filtered.length" />
			<ColumnsMenu :scope="grid.scope" @reset="grid.state.reset()" />
		</UiToolbar>

		<div class="directory-grid">
			<GridRoot :grid="grid" label="Team directory" class="ui-grid" data-size="lg">
				<GridCellTemplate v-slot="{ row }" :column="columns.name">
					<PersonCell :person="row" />
				</GridCellTemplate>
				<GridCellTemplate v-slot="{ value }" :column="columns.team">
					<UiBadge :tone="TEAM_TONES[value]">{{ value }}</UiBadge>
				</GridCellTemplate>
				<GridCellTemplate v-slot="{ value }" :column="columns.presence">
					<UiBadge :tone="PRESENCE[value].tone" dot>{{ PRESENCE[value].label }}</UiBadge>
				</GridCellTemplate>
				<GridColumnDrag>
					<UiDataGridHeader />
					<GridDragPreview />
				</GridColumnDrag>
				<GridBody v-slot="{ rows }">
					<GridRow v-for="row in rows" :key="row.key" :row="row">
						<GridCells />
					</GridRow>
				</GridBody>
				<GridEmpty>
					<span class="directory-empty">
						No one matches these filters.
						<UiButton size="sm" @click="clearFilters">Clear filters</UiButton>
					</span>
				</GridEmpty>
			</GridRoot>

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
					<UiButton size="sm" variant="ghost" icon aria-label="Clear the selection" @click="grid.selection.clear()">
						<IconX aria-hidden="true" />
					</UiButton>
				</div>
			</Transition>
		</div>
	</div>
</template>

<style scoped>
.directory-grid {
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
