<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridHeader,
	GridHeaderCell,
	GridHeaderRow,
	GridRoot,
	GridRow,
	useDataGrid,
} from '@vue-data-grid/core';
import { GridDragOverlay, GridDragPreview, type GridRowDropEvent, GridRowDrag } from '@vue-data-grid/core/drag-and-drop';
import { h } from 'vue';

import type { Priority, Task } from '@/data/tasks';
import { type BadgeTone, UiAvatar, UiBadge } from '@/ui';

const props = defineProps<{
	label: string;
	tasks: readonly Task[];
}>();

const emit = defineEmits<{ drop: [event: GridRowDropEvent<unknown>] }>();

const PRIORITY: Readonly<Record<Priority, BadgeTone>> = {
	low: 'gray',
	medium: 'blue',
	high: 'amber',
	urgent: 'red',
};

const column = defineColumn<Task>();

const columns = defineColumns({
	title: column(task => task.title, { label: 'Task', width: 150, flex: 1 }),
	priority: column(task => task.priority, {
		label: 'Priority',
		width: 92,
		cell: ({ value }) => h(UiBadge, { tone: PRIORITY[value] }, () => value),
	}),
});

const grid = useDataGrid({
	columns,
	rows: () => props.tasks,
	rowKey: 'id',
	rowHeight: 40,
});

function findTask(key: string) {
	return props.tasks.find(task => task.id === key);
}
</script>

<template>
	<section class="lane">
		<h3 class="lane-title">
			{{ label }}
			<span class="lane-count">{{ tasks.length }}</span>
		</h3>
		<GridRoot :grid="grid" :label="label" class="ui-grid" data-size="sm">
			<GridHeader>
				<GridHeaderRow v-slot="{ columns: headers }">
					<GridHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</GridHeaderRow>
			</GridHeader>
			<GridRowDrag group="sprint" @drop="emit('drop', $event)">
				<GridBody v-slot="{ rows }">
					<GridRow v-for="row in rows" :key="row.key" :row="row">
						<GridCells />
					</GridRow>
				</GridBody>
				<GridDragPreview v-slot="{ key, label: title }">
					<span class="card">
						<UiAvatar :name="findTask(key)?.assignee ?? title" />
						<span class="card-text">
							<strong>{{ title }}</strong>
							<span>{{ findTask(key)?.assignee }} · {{ findTask(key)?.estimate }} pts</span>
						</span>
					</span>
				</GridDragPreview>
				<GridDragOverlay v-slot="{ over, allowed }">
					<span class="message">
						{{ over && !allowed ? 'Not here' : `Drop to move to ${label}` }}
					</span>
				</GridDragOverlay>
			</GridRowDrag>
		</GridRoot>
	</section>
</template>

<style scoped>
.lane {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-width: 0;
}

.lane-title {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0;
	color: var(--ui-fg);
	font: 600 14px/1.2 var(--ui-font);
}

.lane-count {
	padding: 1px 8px;
	border-radius: 999px;
	background: var(--ui-bg-muted);
	color: var(--ui-fg-muted);
	font-size: 12px;
}

.card {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 220px;
}

.card-text {
	display: grid;
	line-height: 1.35;
}

.card-text span {
	color: var(--ui-fg-muted);
	font-size: 12px;
}

.message {
	padding: 8px 14px;
	border-radius: 999px;
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow);
	font-size: 13px;
}
</style>
