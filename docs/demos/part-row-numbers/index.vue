<script setup lang="ts">
import { defineColumn, defineColumns, rowNumberColumn, sorting, useDataGrid } from '@vue-data-grid/core';

import { type Person, people } from '@/data/people';
import { UiDataGrid, UiToolbar } from '@/ui';

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	place: rowNumberColumn({ width: 52 }),
	name: column('name', { label: 'Name', width: 170, flex: 1 }),
	team: column('team', { label: 'Team', width: 130 }),
	projects: column('projects', { label: 'Projects', width: 100, align: 'right' }),
	rating: column('rating', {
		label: 'Rating',
		width: 100,
		align: 'right',
		format: rating => rating.toFixed(1),
	}),
});

const grid = useDataGrid({
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

		<UiDataGrid :grid="grid" label="Leaderboard" />
	</div>
</template>
