<script setup lang="ts">
import { moveRow } from 'vue-data-grid';
import type { TableRowDropEvent } from 'vue-data-grid/drag-and-drop';
import { type ShallowRef, shallowRef } from 'vue';

import { type Task, tasks } from '@/data/tasks';

import TaskTable from './TaskTable.vue';

type Lane = 'backlog' | 'sprint';

const lanes: Readonly<Record<Lane, ShallowRef<readonly Task[]>>> = {
	backlog: shallowRef(tasks.filter(task => task.status === 'todo')),
	sprint: shallowRef(tasks.filter(task => task.status === 'doing' || task.status === 'review')),
};

function drop(lane: Lane, { key, index }: TableRowDropEvent<unknown>) {
	const target = lanes[lane];
	const source = lanes.backlog.value.some(task => task.id === key) ? lanes.backlog : lanes.sprint;
	const task = source.value.find(item => item.id === key);

	if (!task) {
		return;
	}

	if (source !== target) {
		source.value = source.value.filter(item => item.id !== key);
	}

	target.value = moveRow(target.value, { key, row: task, parent: null, index }, { rowKey: 'id' });
}
</script>

<template>
	<div class="board">
		<TaskTable label="Backlog" :tasks="lanes.backlog.value" @drop="event => drop('backlog', event)" />
		<TaskTable label="This sprint" :tasks="lanes.sprint.value" @drop="event => drop('sprint', event)" />
	</div>
</template>

<style scoped>
.board {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16px;
}

@media (max-width: 640px) {
	.board {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
