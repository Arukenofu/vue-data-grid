<script setup lang="ts">
import { defineColumn, defineColumns, moveRow, useDataGrid, useGridMotion } from '@vue-data-grid/core';
import { GridDropZone, type GridDropZoneEvent, type GridRowDropEvent } from '@vue-data-grid/core/drag-and-drop';
import IconArchive from '~icons/lucide/archive';
import { computed, h, shallowRef } from 'vue';

import { type Priority, type Task, tasks } from '@/data/tasks';
import { type BadgeTone, UiBadge } from '@/ui';

import TaskList from './TaskList.vue';

const PRIORITY: Readonly<Record<Priority, BadgeTone>> = {
	urgent: 'red',
	high: 'amber',
	medium: 'blue',
	low: 'gray',
};

const column = defineColumn<Task>();

const columns = defineColumns({
	title: column(task => task.title, { label: 'Task', width: 176 }),
	priority: column(task => task.priority, {
		label: 'Priority',
		width: 84,
		cell: ({ value }) => h(UiBadge, { tone: PRIORITY[value] }, () => value),
	}),
	estimate: column(task => task.estimate, { label: 'Days', width: 52, align: 'right' }),
});

const backlog = shallowRef<readonly Task[]>(tasks.filter(task => task.status === 'todo'));
const sprint = shallowRef<readonly Task[]>(tasks.filter(task => task.status === 'doing' || task.status === 'review'));
const archived = shallowRef<readonly Task[]>([]);

const lists = { backlog, sprint };

const backlogGrid = useDataGrid({ columns, rows: backlog, rowKey: 'id', rowHeight: 40, header: false });
const sprintGrid = useDataGrid({ columns, rows: sprint, rowKey: 'id', rowHeight: 40, header: false });

useGridMotion(backlogGrid);
useGridMotion(sprintGrid);

function take(key: string) {
	const task = [...backlog.value, ...sprint.value].find(item => item.id === key);

	backlog.value = backlog.value.filter(item => item.id !== key);
	sprint.value = sprint.value.filter(item => item.id !== key);

	return task;
}

function place(list: keyof typeof lists, event: GridRowDropEvent<unknown>) {
	const task = take(event.key);

	if (task) {
		lists[list].value = moveRow(lists[list].value, { ...event, row: task }, { rowKey: 'id' });
	}
}

function archive(event: GridDropZoneEvent) {
	const task = take(event.key);

	if (task) {
		archived.value = [task, ...archived.value];
	}
}

const archiveText = computed(() => (archived.value.length === 0
	? 'Drag a task here to archive it'
	: `Archived: ${archived.value.map(task => task.title).join(', ')}`));
</script>

<template>
	<div class="ui-stack">
		<div class="boards">
			<TaskList :grid="backlogGrid" label="Backlog" @drop="event => place('backlog', event)" />
			<TaskList :grid="sprintGrid" label="This sprint" @drop="event => place('sprint', event)" />
		</div>

		<GridDropZone v-slot="{ ready, over }" class="bin" group="tasks" @drop="archive">
			<IconArchive class="bin-icon" aria-hidden="true" />
			<span v-if="over">Release to archive</span>
			<span v-else-if="ready">Drop here to archive</span>
			<span v-else class="bin-text">{{ archiveText }}</span>
		</GridDropZone>
	</div>
</template>

<style scoped>
.boards {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16px;
}

.bin {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	min-height: 56px;
	padding: 12px 16px;
	border: 1.5px dashed var(--ui-border-strong);
	border-radius: var(--ui-radius);
	color: var(--ui-fg-muted);
	font: 500 13px/1.4 var(--ui-font);
	transition: border-color 0.15s, background-color 0.15s, color 0.15s;
}

.bin[data-dg-state='ready'] {
	border-color: var(--ui-accent);
	color: var(--ui-accent-text);
}

.bin[data-dg-state='over'] {
	border-style: solid;
	border-color: var(--ui-accent);
	background: var(--ui-accent-soft);
	color: var(--ui-accent-text);
}

.bin-icon {
	flex: none;
	width: 18px;
	height: 18px;
}

.bin-text {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

@media (max-width: 639px) {
	.boards {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
