<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
	GridRoot,
	GridRow,
	GridSortIndicator,
	sorting,
	useDataGrid,
} from '@vue-data-grid/core';

import { type Person, people } from '@/data/people';

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	name: column('name', { label: 'Name', width: 170 }),
	role: column('role', { label: 'Role', flex: 1, minWidth: 160 }),
	team: column('team', { label: 'Team', width: 130 }),
	salary: column('salary', {
		label: 'Salary',
		width: 120,
		align: 'right',
		format: salary => `$${salary.toLocaleString('en-US')}`,
	}),
});

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	multiSort: true,
	features: { sorting: sorting() },
});
</script>

<template>
	<GridRoot :grid="grid" label="People" class="ui-grid">
		<GridHeader>
			<GridHeaderRow v-slot="{ columns }">
				<GridHeaderCell v-for="column in columns" :key="column.key" :column="column">
					<GridHeaderContent />
					<GridSortIndicator />
				</GridHeaderCell>
			</GridHeaderRow>
		</GridHeader>
		<GridBody v-slot="{ rows }">
			<GridRow v-for="row in rows" :key="row.key" :row="row">
				<GridCells />
			</GridRow>
		</GridBody>
	</GridRoot>
</template>
