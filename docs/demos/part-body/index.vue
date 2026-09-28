<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	defineGridCells,
	GridBody,
	GridCellTemplate,
	GridHeader,
	GridHeaderCell,
	GridHeaderRow,
	GridRoot,
	GridRow,
	useDataGrid,
} from '@vue-data-grid/core';
import { computed, shallowRef } from 'vue';

import { type Task, type TaskStatus, tasks } from '@/data/tasks';
import { type BadgeTone, UiBadge, UiButton, UiProgress, UiStat, UiToolbar } from '@/ui';

import AssigneeCell from './AssigneeCell.vue';

const STATUS: Readonly<Record<TaskStatus, { label: string; tone: BadgeTone }>> = {
	todo: { label: 'To do', tone: 'gray' },
	doing: { label: 'In progress', tone: 'blue' },
	review: { label: 'In review', tone: 'violet' },
	done: { label: 'Done', tone: 'green' },
};

const TODAY = '2026-09-28';
const STEP = 20;

const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const column = defineColumn<Task>();

const columns = defineColumns({
	title: column('title', {
		label: 'Task',
		width: 240,
		flex: 1,
		cellClass: ({ row }) => (row.status === 'done' ? 'task-done' : undefined),
	}),
	status: column('status', { label: 'Status', width: 124 }),
	assignee: column('assignee', { label: 'Assignee', width: 160 }),
	progress: column('progress', { label: 'Progress', width: 150 }),
	due: column('due', {
		label: 'Due',
		width: 90,
		align: 'right',
		format: due => day.format(new Date(due)),
		cellClass: ({ row }) => (row.due < TODAY && row.status !== 'done' ? 'ui-cell-down' : undefined),
	}),
});

const rows = shallowRef<readonly Task[]>(tasks);

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 44,
});

const Cells = defineGridCells(columns);

const done = computed(() => rows.value.filter(task => task.status === 'done').length);

function advance() {
	const next = rows.value.find(task => task.status !== 'done');

	if (!next) {
		rows.value = tasks;

		return;
	}

	const progress = Math.min(next.progress + STEP, 100);
	const status: TaskStatus = progress === 100 ? 'done' : 'doing';

	rows.value = rows.value.map(task => (task === next ? { ...task, progress, status } : task));
}
</script>

<template>
	<div class="body-demo">
		<UiToolbar>
			<UiButton size="sm" variant="solid" @click="advance">Advance a task</UiButton>
			<span class="ui-spacer" />
			<UiStat label="Done" :value="`${done} of ${rows.length}`" />
		</UiToolbar>

		<GridRoot :grid="grid" label="Tasks" class="ui-grid" data-size="sm">
			<GridCellTemplate v-slot="{ value }" :column="columns.status">
				<UiBadge :tone="STATUS[value].tone" dot>{{ STATUS[value].label }}</UiBadge>
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ value }" :column="columns.assignee">
				<AssigneeCell :name="value" />
			</GridCellTemplate>
			<GridHeader>
				<GridHeaderRow v-slot="{ columns: headers }">
					<GridHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</GridHeaderRow>
			</GridHeader>
			<GridBody v-slot="{ rows: bodyRows }">
				<GridRow v-for="row in bodyRows" :key="row.key" :row="row">
					<Cells>
						<template #progress="{ value }">
							<span class="progress">
								<UiProgress :value="value" />
								<span class="progress-value">{{ value }}%</span>
							</span>
						</template>
					</Cells>
				</GridRow>
			</GridBody>
		</GridRoot>
	</div>
</template>

<style scoped>
.progress {
	display: flex;
	flex: 1;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.progress-value {
	width: 34px;
	color: var(--ui-fg-muted);
	font-size: 12px;
	text-align: end;
}

.body-demo :deep(.task-done) {
	color: var(--ui-fg-subtle);
	text-decoration: line-through;
}
</style>
