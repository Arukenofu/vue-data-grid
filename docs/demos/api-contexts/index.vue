<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	sorting,
	TableBody,
	TableCells,
	TableHeader,
	TableHeaderCell,
	TableHeaderContent,
	TableHeaderRow,
	TableRoot,
	TableRow,
	TableSortIndicator,
	useDataTable,
} from 'vue-data-grid';
import IconReset from '~icons/lucide/rotate-ccw';

import { type Person, people } from '@/data/people';
import { UiButton, UiSortIcon, UiToolbar } from '@/ui';

import ColumnMenu from './ColumnMenu.vue';

const column = defineColumn<Person>({ sortable: true, pinnable: true, hideable: true });

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name', width: 190 }),
	team: column(person => person.team, { label: 'Team', width: 150 }),
	role: column(person => person.role, { label: 'Role', width: 210 }),
	location: column(person => person.location, { label: 'Location', width: 150 }),
	projects: column(person => person.projects, { label: 'Projects', width: 130, align: 'right' }),
});

const table = useDataTable({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	features: { sorting: sorting() },
});
</script>

<template>
	<div>
		<UiToolbar>
			<span class="ui-toolbar-text">Open the menu in a header: sort, pin or hide the column.</span>
			<span class="ui-spacer" />
			<UiButton @click="table.state.reset()">
				<IconReset aria-hidden="true" />
				Reset columns
			</UiButton>
		</UiToolbar>

		<TableRoot :table="table" label="People" class="ui-table">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns }">
					<TableHeaderCell v-for="column in columns" :key="column.key" :column="column">
						<TableHeaderContent />
						<TableSortIndicator v-slot="{ direction }">
							<UiSortIcon :direction="direction" />
						</TableSortIndicator>
						<ColumnMenu />
					</TableHeaderCell>
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows }">
				<TableRow v-for="row in rows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
			</TableBody>
		</TableRoot>
	</div>
</template>
