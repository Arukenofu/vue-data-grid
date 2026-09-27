<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	navigation,
	TableBody,
	TableCells,
	TableRow,
	useDataTable,
	useTableMotion,
} from '@vue-data-grid/core';
import {
	dragHandleColumn,
	TableDragOverlay,
	TableDragPreview,
	TableRowDrag,
	type TableRowDropEvent,
} from '@vue-data-grid/core/drag-and-drop';
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line';
import { computed, h } from 'vue';

import { UiBadge, UiDataTable } from '@/ui';

import { type BoardTask, PRIORITIES } from './board';
import OwnerCell from './OwnerCell.vue';
import TaskActions from './TaskActions.vue';
import TaskCell from './TaskCell.vue';
import TaskGhost from './TaskGhost.vue';

const props = defineProps<{
	title: string;
	tasks: readonly BoardTask[];
	other: string;
}>();

const emit = defineEmits<{
	move: [key: string, index: number];
	transfer: [key: string];
	archive: [key: string];
}>();

defineSlots<{ default?: () => unknown }>();

const column = defineColumn<BoardTask>();

const columns = defineColumns({
	handle: dragHandleColumn(),
	title: column(task => task.title, {
		label: 'Task',
		flex: 1,
		minWidth: 200,
		cell: ({ row }) => h(TaskCell, { task: row }),
	}),
	priority: column(task => task.priority, {
		label: 'Priority',
		width: 96,
		cell: ({ value }) => h(UiBadge, { tone: PRIORITIES[value].tone, dot: true }, () => PRIORITIES[value].label),
	}),
	assignee: column(task => task.assignee, {
		label: 'Owner',
		width: 68,
		align: 'center',
		cell: ({ value }) => h(OwnerCell, { name: value }),
	}),
	actions: column(task => task.id, {
		label: 'Actions',
		kind: 'service',
		width: 76,
		align: 'center',
		cell: ({ row }) => h(TaskActions, {
			task: row.title,
			target: props.other,
			onTransfer: () => emit('transfer', row.id),
			onArchive: () => emit('archive', row.id),
		}),
	}),
});

const table = useDataTable({
	columns,
	rows: () => props.tasks,
	rowKey: 'id',
	rowHeight: 48,
	features: { navigation: navigation() },
});

useTableMotion(table);

const messages = { empty: 'Nothing here yet. Drag a task in.' };

const tasksByKey = computed(() => new Map(props.tasks.map(task => [task.id, task])));

function drop(event: TableRowDropEvent<unknown>) {
	emit('move', event.key, event.index);
}
</script>

<template>
	<section class="task-list">
		<header class="task-list-header">
			<h3 class="task-list-title">{{ title }}</h3>
			<UiBadge>{{ tasks.length }}</UiBadge>
			<span class="task-list-meta">
				<slot />
			</span>
		</header>

		<div class="task-list-table">
			<UiDataTable :table="table" :label="title" :messages="messages">
				<TableRowDrag group="tasks" handle @drop="drop">
					<TableBody v-slot="{ rows }">
						<TableRow v-for="row in rows" :key="row.key" :row="row">
							<TableCells />
						</TableRow>
					</TableBody>
					<TableDragPreview v-slot="{ key, label }">
						<TaskGhost :label="label" :task="tasksByKey.get(key)" />
					</TableDragPreview>
					<TableDragOverlay v-slot="{ label, over }" class="task-list-overlay">
						<IconArrowDownToLine aria-hidden="true" />
						{{ over ? `Drop “${label}” into ${title}` : `Move to ${title}` }}
					</TableDragOverlay>
				</TableRowDrag>
			</UiDataTable>
		</div>
	</section>
</template>

<style scoped>
.task-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-width: 0;
}

.task-list-header {
	display: flex;
	align-items: center;
	gap: 8px;
	min-height: 28px;
}

.task-list-title {
	margin: 0;
	font-size: 15px;
	font-weight: 650;
}

.task-list-meta {
	display: flex;
	flex: 1;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
}

.task-list-table {
	display: flex;
	height: 400px;
}

.task-list-table :deep([data-dg-part='body']) {
	flex: 1 0 auto;
}

.task-list-table :deep([data-dg-part='empty']) {
	position: absolute;
	inset: 38px 0 0;
	pointer-events: none;
}

.task-list-overlay {
	gap: 8px;
	font-size: 13px;
	font-weight: 600;
}
</style>
