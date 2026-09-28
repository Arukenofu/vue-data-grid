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
import IconReset from '~icons/lucide/rotate-ccw';

import { type Person, people } from '@/data/people';
import { UiButton, UiSortIcon, UiToolbar } from '@/ui';

import ColumnMenu from './ColumnMenu.vue';

const column = defineColumn<Person>({ sortable: true, pinnable: true, hideable: true });

const columns = defineColumns({
	name: column('name', { label: 'Name', width: 190 }),
	team: column('team', { label: 'Team', width: 150 }),
	role: column('role', { label: 'Role', width: 210 }),
	location: column('location', { label: 'Location', width: 150 }),
	projects: column('projects', { label: 'Projects', width: 130, align: 'right' }),
});

const grid = useDataGrid({
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
			<UiButton @click="grid.state.reset()">
				<IconReset aria-hidden="true" />
				Reset columns
			</UiButton>
		</UiToolbar>

		<GridRoot :grid="grid" label="People" class="ui-grid">
			<GridHeader>
				<GridHeaderRow v-slot="{ columns }">
					<GridHeaderCell v-for="column in columns" :key="column.key" :column="column">
						<GridHeaderContent />
						<GridSortIndicator v-slot="{ direction }">
							<UiSortIcon :direction="direction" />
						</GridSortIndicator>
						<ColumnMenu />
					</GridHeaderCell>
				</GridHeaderRow>
			</GridHeader>
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
		</GridRoot>
	</div>
</template>
