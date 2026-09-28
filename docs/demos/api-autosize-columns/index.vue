<script setup lang="ts">
import { autosizeColumns, defineColumn, defineColumns, sorting, useDataGrid, useGridMotion } from '@vue-data-grid/core';
import IconMoveHorizontal from '~icons/lucide/move-horizontal';
import IconRotateCcw from '~icons/lucide/rotate-ccw';
import { shallowRef } from 'vue';

import { createPeople, type Person } from '@/data/people';
import { UiButton, UiDataGrid, UiToolbar } from '@/ui';

const people = createPeople(400, 23);

const column = defineColumn<Person>({ sortable: true, resizable: true, width: 110, minWidth: 60 });

const columns = defineColumns({
	name: column('name', { label: 'Name' }),
	email: column('email', { label: 'Email' }),
	role: column('role', { label: 'Role' }),
	team: column('team', { label: 'Team' }),
	location: column('location', { label: 'Office' }),
});

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 38,
	virtual: true,
	features: { sorting: sorting() },
});

useGridMotion(grid);

const measured = shallowRef<readonly string[]>([]);

function fitRendered() {
	measured.value = autosizeColumns(grid.scope);
}

function fitAll() {
	measured.value = autosizeColumns(grid.scope, undefined, { rows: 'all' });
}

function reset() {
	grid.state.reset();
	measured.value = [];
}
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<UiButton @click="fitRendered">
				<IconMoveHorizontal aria-hidden="true" />
				Fit rendered rows
			</UiButton>
			<UiButton @click="fitAll">Fit all 400 rows</UiButton>
			<UiButton variant="ghost" @click="reset">
				<IconRotateCcw aria-hidden="true" />
				Reset
			</UiButton>
			<span class="ui-spacer" />
			<span class="ui-toolbar-text">{{ measured.length > 0 ? `Measured ${measured.length} columns` : 'Or double-click a column edge' }}</span>
		</UiToolbar>

		<UiDataGrid :grid="grid" label="People" data-size="sm" />
	</div>
</template>
