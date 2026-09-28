<script setup lang="ts">
import { defineColumn, defineColumns, navigation, selection, selectionColumn, useDataGrid } from '@vue-data-grid/core';
import { computed, h, shallowRef } from 'vue';

import { type Task, tasks } from '@/data/tasks';
import { UiButton, UiDataGrid, UiToolbar } from '@/ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDay(date: string) {
	const [, month, day] = date.split('-');

	return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

const column = defineColumn<Task>();

const columns = defineColumns({
	select: selectionColumn(),
	title: column(task => task.title, { label: 'Task', width: 220 }),
	assignee: column(task => task.assignee, { label: 'Assignee', flex: 1, width: 130 }),
	due: column(task => task.due, { label: 'Due', width: 90, format: formatDay }),
	actions: column(() => null, {
		label: 'Actions',
		kind: 'service',
		width: 150,
		cell: ({ row }) => h('span', { class: 'actions' }, [
			h(UiButton, { size: 'sm', onClick: () => announce(`Opened “${row.title}”`) }, () => 'Open'),
			h(UiButton, { size: 'sm', variant: 'ghost', onClick: () => announce(`Archived “${row.title}”`) }, () => 'Archive'),
		]),
	}),
});

const grid = useDataGrid({
	columns,
	rows: tasks,
	rowKey: 'id',
	rowHeight: 44,
	features: {
		selection: selection(),
		navigation: navigation(),
	},
});

const lastAction = shallowRef('Nothing pressed yet');

function announce(text: string) {
	lastAction.value = text;
}

const focused = computed(() => {
	const cell = grid.navigation.focused.value;

	return cell ? `${cell.section} · row ${cell.row + 1} · ${cell.cell}` : 'outside the grid';
});

function focusFirst() {
	void grid.navigation.focusCell({ section: 'body', row: 0, cell: 'title' });
}

function focusLast() {
	void grid.navigation.focusCell({ section: 'body', row: tasks.length - 1, cell: 'actions' });
}
</script>

<template>
	<div>
		<UiToolbar>
			<UiButton @click="focusFirst">Focus the first task</UiButton>
			<UiButton @click="focusLast">Focus the last actions</UiButton>
		</UiToolbar>

		<UiDataGrid :grid="grid" label="Tasks" data-size="sm" />

		<p class="status">
			<span><strong>Focused:</strong> {{ focused }}</span>
			<span><strong>Last action:</strong> {{ lastAction }}</span>
		</p>
	</div>
</template>

<style scoped>
.status {
	display: flex;
	flex-wrap: wrap;
	gap: 8px 24px;
	margin: 12px 0 0;
	color: var(--ui-fg-muted);
	font-size: 13px;
}

.status strong {
	color: var(--ui-fg);
	font-weight: 600;
}

:deep(.actions) {
	display: inline-flex;
	gap: 6px;
}
</style>
