<script setup lang="ts">
import {
	autosizeColumns,
	defineColumn,
	defineColumns,
	localStorageStore,
	useDataTable,
	useTableMotion,
} from '@vue-stack/table';
import IconArrowLeftRight from '~icons/lucide/arrow-left-right';
import IconRotateCcw from '~icons/lucide/rotate-ccw';
import IconUnfoldHorizontal from '~icons/lucide/unfold-horizontal';

import { type Person, people } from '@/data/people';
import { UiButton, UiDataTable, UiToolbar } from '@/ui';

import ColumnsMenu from './ColumnsMenu.vue';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const column = defineColumn<Person>({ resizable: true, movable: true, hideable: true, pinnable: true });

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name', width: 160, pinned: 'start', hideable: false }),
	email: column(person => person.email, { label: 'Email', width: 200 }),
	team: column(person => person.team, { label: 'Team', width: 120 }),
	role: column(person => person.role, { label: 'Role', width: 170 }),
	location: column(person => person.location, { label: 'Location', width: 110 }),
	started: column(person => person.started, { label: 'Started', width: 110, hiddenByDefault: true }),
	projects: column(person => person.projects, { label: 'Projects', width: 96, align: 'right' }),
	salary: column(person => person.salary, { label: 'Salary', width: 110, align: 'right', format: salary => money.format(salary) }),
});

const table = useDataTable({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	persist: localStorageStore('vue-stack-docs:column-layout'),
});

useTableMotion(table);

function fitToContent() {
	autosizeColumns(table.scope);
}

function fitToWidth() {
	table.scope.fitColumns();
}
</script>

<template>
	<div>
		<UiToolbar>
			<ColumnsMenu :scope="table.scope" />
			<UiButton @click="fitToContent">
				<IconUnfoldHorizontal aria-hidden="true" />
				Fit to content
			</UiButton>
			<UiButton @click="fitToWidth">
				<IconArrowLeftRight aria-hidden="true" />
				Fit to width
			</UiButton>
			<span class="ui-spacer" />
			<UiButton variant="ghost" @click="table.state.reset()">
				<IconRotateCcw aria-hidden="true" />
				Reset
			</UiButton>
		</UiToolbar>
		<UiDataTable :table="table" label="People" />
	</div>
</template>
