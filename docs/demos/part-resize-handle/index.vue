<script setup lang="ts">
import {
	autosizeColumns,
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
	GridResizeHandle,
	GridRoot,
	GridRow,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';

import { type Person, people } from '@/data/people';
import { UiButton, UiToolbar } from '@/ui';

const column = defineColumn<Person>({ resizable: true, minWidth: 80, maxWidth: 360 });

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name', width: 150 }),
	email: column(person => person.email, { label: 'Email', width: 170 }),
	role: column(person => person.role, { label: 'Role', width: 150 }),
	location: column(person => person.location, { label: 'Location', width: 110 }),
	salary: column(person => person.salary, {
		label: 'Salary',
		width: 110,
		align: 'right',
		format: salary => `$${salary.toLocaleString('en-US')}`,
	}),
});

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
});

useGridMotion(grid);

function fitContent() {
	autosizeColumns(grid.scope);
}

function fillWidth() {
	grid.scope.fitColumns();
}

function reset() {
	grid.state.reset();
}
</script>

<template>
	<div>
		<UiToolbar>
			<UiButton size="sm" @click="fitContent">Fit to content</UiButton>
			<UiButton size="sm" @click="fillWidth">Fill the width</UiButton>
			<span class="ui-toolbar-text">or double-click the edge of a header</span>
			<span class="ui-spacer" />
			<UiButton size="sm" variant="ghost" @click="reset">Reset</UiButton>
		</UiToolbar>

		<GridRoot :grid="grid" label="People" class="ui-grid" data-size="sm">
			<GridHeader>
				<GridHeaderRow v-slot="{ columns: headers }">
					<GridHeaderCell v-for="header in headers" :key="header.key" :column="header">
						<GridHeaderContent />
						<GridResizeHandle v-slot="{ width, resizing }">
							<span v-if="resizing" class="width">{{ Math.round(width) }} px</span>
						</GridResizeHandle>
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

<style scoped>
.width {
	position: absolute;
	inset-block-start: 50%;
	inset-inline-end: 10px;
	padding: 2px 6px;
	border-radius: 999px;
	background: var(--ui-accent);
	color: var(--ui-accent-fg);
	font-size: 11px;
	font-weight: 600;
	white-space: nowrap;
	translate: 0 -50%;
	pointer-events: none;
}
</style>
