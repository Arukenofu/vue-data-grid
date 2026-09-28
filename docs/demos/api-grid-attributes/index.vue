<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	type GridPosition,
	navigation,
	readGridPosition,
	sorting,
	useDataGrid,
} from '@vue-data-grid/core';
import IconCrosshair from '~icons/lucide/crosshair';
import { computed, shallowRef } from 'vue';

import { type Person, people } from '@/data/people';
import { UiDataGrid } from '@/ui';

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name', width: 130 }),
	team: column(person => person.team, { label: 'Team', width: 100 }),
	location: column(person => person.location, { label: 'Location', width: 90, flex: 1 }),
	projects: column(person => person.projects, { label: 'Projects', width: 80, align: 'right' }),
});

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 36,
	features: { sorting: sorting(), navigation: navigation() },
});

const position = shallowRef<GridPosition | null>(null);

const person = computed(() => (position.value?.section === 'body' ? grid.rows.value[position.value.row] : undefined));

const label = computed(() => (position.value ? grid.scope.getColumn(position.value.cell)?.column?.label : undefined));

function locate(event: Event) {
	const cell = event.target instanceof Element ? event.target.closest('[data-dg-column]') : null;

	position.value = cell ? readGridPosition(cell) : null;
}
</script>

<template>
	<div class="position-demo">
		<div class="position-grid">
			<UiDataGrid :grid="grid" label="People" data-size="sm" @pointerdown="locate" @focusin="locate" />
		</div>

		<section class="position-panel" aria-label="The position of the cell">
			<p class="position-title">
				<IconCrosshair aria-hidden="true" />
				readGridPosition
			</p>
			<dl v-if="position" class="position-list">
				<dt>section</dt>
				<dd>{{ position.section }}</dd>
				<dt>row</dt>
				<dd>{{ position.row }}</dd>
				<dt>cell</dt>
				<dd>{{ position.cell }}</dd>
			</dl>
			<p v-if="person" class="position-detail">{{ label }} of {{ person.name }}</p>
			<p v-else-if="position" class="position-detail">The header of {{ label }}</p>
			<p v-else class="position-empty">Click a cell, or move to one with the keys</p>
		</section>
	</div>
</template>

<style scoped>
.position-demo {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 200px;
	gap: 16px;
}

.position-grid {
	min-width: 0;
}

.position-panel {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-width: 0;
	padding: 14px;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-sm);
	font: 400 13px/1.45 var(--ui-font);
}

.position-title {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0;
	color: var(--ui-fg-muted);
	font-family: var(--ui-font-mono);
	font-size: 12px;
	font-weight: 600;
}

.position-title svg {
	width: 15px;
	height: 15px;
	color: var(--ui-accent-text);
}

.position-list {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr);
	gap: 6px 12px;
	margin: 0;
}

.position-list dt {
	color: var(--ui-fg-subtle);
}

.position-list dd {
	margin: 0;
	overflow: hidden;
	color: var(--ui-accent-text);
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.position-detail,
.position-empty {
	margin: 0;
	color: var(--ui-fg-subtle);
}

@media (max-width: 760px) {
	.position-demo {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
