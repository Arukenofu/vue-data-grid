<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	navigation,
	rowEditing,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import { dragHandleColumn, GridDragPreview, useGridRowDrag } from '@vue-data-grid/core/drag-and-drop';
import IconPlus from '~icons/lucide/plus';
import IconTrash from '~icons/lucide/trash-2';
import { computed, shallowRef } from 'vue';

import { type Task, tasks } from '@/data/tasks';
import { UiButton, UiDataGrid, UiToolbar } from '@/ui';

const rows = shallowRef<readonly Task[]>(tasks.slice(0, 6));
const added = shallowRef(0);

const column = defineColumn<Task>();

const columns = defineColumns({
	handle: dragHandleColumn(),
	title: column('title', { label: 'Task', flex: 1, width: 220, rowHeader: true }),
	assignee: column('assignee', { label: 'Assignee', width: 140 }),
	estimate: column('estimate', { label: 'Days', width: 72, align: 'right' }),
});

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation(),
		rowEditing: rowEditing({
			onCommit: (commit) => {
				rows.value = commit.rows;
			},
		}),
	},
});

useGridMotion(grid);

useGridRowDrag(grid, { handle: true, getLabel: task => task.title });

const focusedKey = computed(() => grid.navigation.cells.focused.value?.key ?? null);

function createTask(): Task {
	added.value += 1;

	return {
		id: `new-${added.value}`,
		title: `New task ${added.value}`,
		status: 'todo',
		priority: 'medium',
		assignee: 'Unassigned',
		estimate: 1,
		progress: 0,
		due: '2026-10-30',
	};
}

function add() {
	grid.rowEditing.write([{ type: 'add', row: createTask(), after: focusedKey.value }], 'add');
}

function remove() {
	if (focusedKey.value !== null) {
		grid.rowEditing.write([{ type: 'remove', key: focusedKey.value }], 'remove');
	}
}

const status = computed(() => {
	const commit = grid.rowEditing.lastCommit.value;

	if (!commit) {
		return 'Focus a row, then add a task after it or remove it; drag a row by its handle.';
	}

	return `Last commit: ${commit.changes.map(change => change.type).join(', ')} from “${commit.source}”`;
});
</script>

<template>
	<div>
		<UiToolbar>
			<UiButton @click="add">
				<IconPlus aria-hidden="true" />
				Add task
			</UiButton>
			<UiButton :disabled="focusedKey === null" @click="remove">
				<IconTrash aria-hidden="true" />
				Remove task
			</UiButton>
			<span class="ui-toolbar-text">{{ status }}</span>
		</UiToolbar>

		<UiDataGrid :grid="grid" label="Tasks" data-size="auto" />

		<GridDragPreview />
	</div>
</template>
