<script setup lang="ts">
import {
	autosizeColumns,
	defineColumn,
	defineColumns,
	localStorageStore,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import IconArrowLeftRight from '~icons/lucide/arrow-left-right';
import IconRotateCcw from '~icons/lucide/rotate-ccw';
import IconUnfoldHorizontal from '~icons/lucide/unfold-horizontal';

import { type Person, people } from '@/data/people';
import { UiButton, UiDataGrid, UiToolbar } from '@/ui';

import ColumnsMenu from './ColumnsMenu.vue';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const column = defineColumn<Person>({ resizable: true, movable: true, hideable: true, pinnable: true });

const columns = defineColumns({
	name: column('name', { label: 'Name', width: 160, pinned: 'start', hideable: false }),
	email: column('email', { label: 'Email', width: 200 }),
	team: column('team', { label: 'Team', width: 120 }),
	role: column('role', { label: 'Role', width: 170 }),
	location: column('location', { label: 'Location', width: 110 }),
	started: column('started', { label: 'Started', width: 110, hiddenByDefault: true }),
	projects: column('projects', { label: 'Projects', width: 96, align: 'right' }),
	salary: column('salary', { label: 'Salary', width: 110, align: 'right', format: salary => money.format(salary) }),
});

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	persist: localStorageStore('vue-data-grid-docs:column-layout'),
});

useGridMotion(grid);

function fitToContent() {
	autosizeColumns(grid.scope);
}

function fitToWidth() {
	grid.scope.fitColumns();
}
</script>

<template>
	<div>
		<UiToolbar>
			<ColumnsMenu :scope="grid.scope" />
			<UiButton @click="fitToContent">
				<IconUnfoldHorizontal aria-hidden="true" />
				Fit to content
			</UiButton>
			<UiButton @click="fitToWidth">
				<IconArrowLeftRight aria-hidden="true" />
				Fit to width
			</UiButton>
			<span class="ui-spacer" />
			<UiButton variant="ghost" @click="grid.state.reset()">
				<IconRotateCcw aria-hidden="true" />
				Reset
			</UiButton>
		</UiToolbar>
		<UiDataGrid :grid="grid" label="People" />
	</div>
</template>
