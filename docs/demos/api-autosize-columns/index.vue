<script setup lang="ts">
import { autosizeColumns, defineColumn, defineColumns, sorting, useDataTable, useTableMotion } from '@vue-stack/table';
import IconMoveHorizontal from '~icons/lucide/move-horizontal';
import IconRotateCcw from '~icons/lucide/rotate-ccw';
import { shallowRef } from 'vue';

import { createPeople, type Person } from '@/data/people';
import { UiButton, UiDataTable, UiToolbar } from '@/ui';

const people = createPeople(400, 23);

const column = defineColumn<Person>({ sortable: true, resizable: true, width: 110, minWidth: 60 });

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name' }),
	email: column(person => person.email, { label: 'Email' }),
	role: column(person => person.role, { label: 'Role' }),
	team: column(person => person.team, { label: 'Team' }),
	location: column(person => person.location, { label: 'Office' }),
});

const table = useDataTable({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 38,
	virtual: true,
	features: { sorting: sorting() },
});

useTableMotion(table);

const measured = shallowRef<readonly string[]>([]);

function fitRendered() {
	measured.value = autosizeColumns(table.scope);
}

function fitAll() {
	measured.value = autosizeColumns(table.scope, undefined, { rows: 'all' });
}

function reset() {
	table.state.reset();
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

		<UiDataTable :table="table" label="People" data-size="sm" />
	</div>
</template>
