<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridCellTemplate,
	GridRow,
	navigation,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import {
	dragHandleColumn,
	GridDragOverlay,
	GridDragPreview,
	GridRowDrag,
	type GridRowDropEvent,
} from '@vue-data-grid/core/drag-and-drop';
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line';
import { computed } from 'vue';

import { UiBadge, UiDataGrid } from '@/ui';

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
	}),
	priority: column(task => task.priority, {
		label: 'Priority',
		width: 96,
	}),
	assignee: column(task => task.assignee, {
		label: 'Owner',
		width: 68,
		align: 'center',
	}),
	actions: column(task => task.id, {
		label: 'Actions',
		kind: 'service',
		width: 76,
		align: 'center',
	}),
});

const grid = useDataGrid({
	columns,
	rows: () => props.tasks,
	rowKey: 'id',
	rowHeight: 48,
	features: { navigation: navigation() },
});

useGridMotion(grid);

const messages = { empty: 'Nothing here yet. Drag a task in.' };

const tasksByKey = computed(() => new Map(props.tasks.map(task => [task.id, task])));

function drop(event: GridRowDropEvent<unknown>) {
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

		<div class="task-list-grid">
			<UiDataGrid :grid="grid" :label="title" :messages="messages">
				<GridCellTemplate v-slot="{ row }" :column="columns.title">
					<TaskCell :task="row" />
				</GridCellTemplate>
				<GridCellTemplate v-slot="{ value }" :column="columns.priority">
					<UiBadge :tone="PRIORITIES[value].tone" dot>{{ PRIORITIES[value].label }}</UiBadge>
				</GridCellTemplate>
				<GridCellTemplate v-slot="{ value }" :column="columns.assignee">
					<OwnerCell :name="value" />
				</GridCellTemplate>
				<GridCellTemplate v-slot="{ row }" :column="columns.actions">
					<TaskActions
						:task="row.title"
						:target="other"
						@transfer="emit('transfer', row.id)"
						@archive="emit('archive', row.id)"
					/>
				</GridCellTemplate>
				<template #body>
					<GridRowDrag group="tasks" handle @drop="drop">
						<GridBody v-slot="{ rows }">
							<GridRow v-for="row in rows" :key="row.key" :row="row">
								<GridCells />
							</GridRow>
						</GridBody>
						<GridDragPreview v-slot="{ key, label }">
							<TaskGhost :label="label" :task="tasksByKey.get(key)" />
						</GridDragPreview>
						<GridDragOverlay v-slot="{ label, over }" class="task-list-overlay">
							<IconArrowDownToLine aria-hidden="true" />
							{{ over ? `Drop “${label}” into ${title}` : `Move to ${title}` }}
						</GridDragOverlay>
					</GridRowDrag>
				</template>
			</UiDataGrid>
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

.task-list-grid {
	display: flex;
	height: 400px;
}

.task-list-grid :deep([data-dg-part='body']) {
	flex: 1 0 auto;
}

.task-list-grid :deep([data-dg-part='empty']) {
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
