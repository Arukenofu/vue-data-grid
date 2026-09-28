<script setup lang="ts">
import { moveRow } from '@vue-data-grid/core';
import { GridDropZone } from '@vue-data-grid/core/drag-and-drop';
import IconArchive from '~icons/lucide/archive';
import IconArchiveRestore from '~icons/lucide/archive-restore';
import { computed, shallowRef } from 'vue';

import { UiBadge, UiButton, UiProgress, UiStat, UiToolbar } from '@/ui';

import { type BoardTask, createBoard, type ListName, SPRINT_CAPACITY } from './board';
import TaskGrid from './TaskGrid.vue';

const tasks = shallowRef<readonly BoardTask[]>(createBoard());
const archived = shallowRef<readonly BoardTask[]>([]);

const sprint = computed(() => tasks.value.filter(task => task.list === 'sprint'));
const backlog = computed(() => tasks.value.filter(task => task.list === 'backlog'));
const lists = { sprint, backlog };

const committed = computed(() => sprint.value.reduce((sum, task) => sum + task.estimate, 0));
const overCapacity = computed(() => committed.value > SPRINT_CAPACITY);

function move(list: ListName, key: string, index: number) {
	const task = tasks.value.find(item => item.id === key);

	if (task) {
		tasks.value = moveRow(tasks.value, { key, row: task, parent: list, index }, { rowKey: 'id', parentKey: 'list' });
	}
}

function transfer(key: string, list: ListName) {
	move(list, key, lists[list].value.length);
}

function archive(key: string) {
	const task = tasks.value.find(item => item.id === key);

	if (task) {
		tasks.value = tasks.value.filter(item => item !== task);
		archived.value = [task, ...archived.value];
	}
}

function restore() {
	tasks.value = [...tasks.value, ...archived.value.map(task => ({ ...task, list: 'backlog' as const }))];
	archived.value = [];
}
</script>

<template>
	<div class="board">
		<UiToolbar>
			<UiStat label="Sprint">
				<span class="board-capacity" :data-over="overCapacity || undefined">
					<UiProgress :value="(committed / SPRINT_CAPACITY) * 100" />
					{{ committed }} / {{ SPRINT_CAPACITY }} pts
				</span>
			</UiStat>
			<UiBadge v-if="overCapacity" tone="red" dot>Over capacity</UiBadge>
			<span class="ui-spacer" />
			<UiButton :disabled="archived.length === 0" @click="restore">
				<IconArchiveRestore aria-hidden="true" />
				Restore {{ archived.length }}
			</UiButton>
		</UiToolbar>

		<div class="board-lists">
			<TaskGrid
				title="This sprint"
				other="Backlog"
				:tasks="sprint"
				@move="(key, index) => move('sprint', key, index)"
				@transfer="key => transfer(key, 'backlog')"
				@archive="archive"
			>
				<UiBadge tone="green">{{ committed }} pts</UiBadge>
			</TaskGrid>
			<TaskGrid
				title="Backlog"
				other="This sprint"
				:tasks="backlog"
				@move="(key, index) => move('backlog', key, index)"
				@transfer="key => transfer(key, 'sprint')"
				@archive="archive"
			/>
		</div>

		<GridDropZone v-slot="{ ready, over }" group="tasks" class="board-bin" @drop="event => archive(event.key)">
			<IconArchive aria-hidden="true" />
			<template v-if="over">Release to archive the task</template>
			<template v-else-if="ready">Drop a task here to archive it</template>
			<template v-else>{{ archived.length }} archived · drag a task here to archive it</template>
		</GridDropZone>
	</div>
</template>

<style scoped>
.board {
	display: flex;
	flex-direction: column;
}

.board-capacity {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	width: 180px;
}

.board-capacity[data-over] {
	color: var(--ui-down);
}

.board-lists {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
	gap: 20px;
}

.board-bin {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	height: 64px;
	margin-block-start: 20px;
	border: 1.5px dashed var(--ui-border-strong);
	border-radius: var(--ui-radius);
	color: var(--ui-fg-muted);
	font-size: 13px;
	font-weight: 500;
	transition: border-color 0.15s, background-color 0.15s, color 0.15s;
}

.board-bin svg {
	width: 18px;
	height: 18px;
}

.board-bin[data-dg-state='ready'] {
	border-color: var(--ui-warn);
	background: var(--ui-warn-soft);
	color: var(--ui-warn);
}

.board-bin[data-dg-state='over'] {
	border-style: solid;
	border-color: var(--ui-down);
	background: var(--ui-down-soft);
	color: var(--ui-down);
}
</style>
