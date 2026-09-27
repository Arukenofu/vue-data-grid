<script setup lang="ts">
import { defineColumn, defineColumns, rowNumberColumn, sorting, useDataTable } from '@vue-stack/table';

import { type Person, people } from '@/data/people';
import { UiDataTable, UiToolbar } from '@/ui';

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	place: rowNumberColumn({ width: 52 }),
	name: column(person => person.name, { label: 'Name', width: 170, flex: 1 }),
	team: column(person => person.team, { label: 'Team', width: 130 }),
	projects: column(person => person.projects, { label: 'Projects', width: 100, align: 'right' }),
	rating: column(person => person.rating, {
		label: 'Rating',
		width: 100,
		align: 'right',
		format: rating => rating.toFixed(1),
	}),
});

const table = useDataTable({
	columns,
	rows: people.slice(0, 12),
	rowKey: 'id',
	rowHeight: 40,
	sort: [{ name: 'rating', direction: 'desc' }],
	features: { sorting: sorting() },
});
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<span class="ui-toolbar-text">Sort by any column: the place of a row is its number, from 1.</span>
		</UiToolbar>

		<UiDataTable :table="table" label="Leaderboard" />
	</div>
</template>
