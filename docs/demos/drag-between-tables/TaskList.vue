<script setup lang="ts">
import { type DataTable, TableBody, TableCells, TableRow } from '@vue-stack/table';
import { TableDragOverlay, TableDragPreview, type TableRowDropEvent, TableRowDrag } from '@vue-stack/table/drag-and-drop';
import IconGripVertical from '~icons/lucide/grip-vertical';

import { UiDataTable } from '@/ui';

defineProps<{
	table: DataTable;
	label: string;
}>();

const emit = defineEmits<{
	drop: [event: TableRowDropEvent<unknown>];
}>();
</script>

<template>
	<section class="task-list">
		<h3 class="task-list-title">
			{{ label }}
			<span class="task-list-count">{{ table.rows.value.length }}</span>
		</h3>
		<UiDataTable :table="table" :label="label" data-size="sm">
			<TableRowDrag group="tasks" @drop="event => emit('drop', event)">
				<TableBody v-slot="{ rows }">
					<TableRow v-for="row in rows" :key="row.key" :row="row">
						<TableCells />
					</TableRow>
				</TableBody>
				<TableDragOverlay v-slot="{ label: task }">Drop “{{ task }}” into {{ label }}</TableDragOverlay>
				<TableDragPreview v-slot="{ label: task }">
					<IconGripVertical aria-hidden="true" />
					{{ task }}
				</TableDragPreview>
			</TableRowDrag>
		</UiDataTable>
	</section>
</template>

<style scoped>
.task-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;
}

.task-list-title {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0;
	color: var(--ui-fg);
	font: 600 13.5px/1.4 var(--ui-font);
}

.task-list-count {
	padding: 1px 7px;
	border-radius: 999px;
	background: var(--ui-bg-muted);
	color: var(--ui-fg-muted);
	font-size: 12px;
	font-weight: 560;
}
</style>
