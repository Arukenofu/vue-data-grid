<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	TableBody,
	TableCells,
	TableHeader,
	TableHeaderCell,
	TableHeaderRow,
	TableRoot,
	TableRow,
	useDataTable,
} from '@vue-stack/table';
import { computed, h, shallowRef } from 'vue';

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
	title: column(task => task.title, {
		label: 'Task',
		width: 240,
		flex: 1,
		cellClass: ({ row }) => (row.status === 'done' ? 'task-done' : undefined),
	}),
	status: column(task => task.status, {
		label: 'Status',
		width: 124,
		cell: ({ value }) => h(UiBadge, { tone: STATUS[value].tone, dot: true }, () => STATUS[value].label),
	}),
	assignee: column(task => task.assignee, {
		label: 'Assignee',
		width: 160,
		cell: ({ value }) => h(AssigneeCell, { name: value }),
	}),
	progress: column(task => task.progress, { label: 'Progress', width: 150 }),
	due: column(task => task.due, {
		label: 'Due',
		width: 90,
		align: 'right',
		format: due => day.format(new Date(due)),
		cellClass: ({ row }) => (row.due < TODAY && row.status !== 'done' ? 'ui-cell-down' : undefined),
	}),
});

const rows = shallowRef<readonly Task[]>(tasks);

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 44,
});

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

		<TableRoot :table="table" label="Tasks" class="ui-table" data-size="sm">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns: headers }">
					<TableHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows: bodyRows }">
				<TableRow v-for="row in bodyRows" :key="row.key" :row="row">
					<TableCells v-slot="{ column, value }">
						<span v-if="column.name === 'progress'" class="progress">
							<UiProgress :value="Number(value)" />
							<span class="progress-value">{{ value }}%</span>
						</span>
					</TableCells>
				</TableRow>
			</TableBody>
		</TableRoot>
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
