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
} from '@vue-stack/table';

import { type Person, people } from '@/data/people';

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name', width: 170 }),
	role: column(person => person.role, { label: 'Role', flex: 1, minWidth: 160 }),
	team: column(person => person.team, { label: 'Team', width: 130 }),
	salary: column(person => person.salary, {
		label: 'Salary',
		width: 120,
		align: 'right',
		format: salary => `$${salary.toLocaleString('en-US')}`,
	}),
});

const table = useDataTable({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	multiSort: true,
	features: { sorting: sorting() },
});
</script>

<template>
	<TableRoot :table="table" label="People" class="ui-table">
		<TableHeader>
			<TableHeaderRow v-slot="{ columns }">
				<TableHeaderCell v-for="column in columns" :key="column.key" :column="column">
					<TableHeaderContent />
					<TableSortIndicator />
				</TableHeaderCell>
			</TableHeaderRow>
		</TableHeader>
		<TableBody v-slot="{ rows }">
			<TableRow v-for="row in rows" :key="row.key" :row="row">
				<TableCells />
			</TableRow>
		</TableBody>
	</TableRoot>
</template>
