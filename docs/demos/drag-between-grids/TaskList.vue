<script setup lang="ts">
import { type DataGrid, GridBody, GridCells, GridRow } from '@vue-data-grid/core';
import { GridDragOverlay, GridDragPreview, type GridRowDropEvent, GridRowDrag } from '@vue-data-grid/core/drag-and-drop';
import IconGripVertical from '~icons/lucide/grip-vertical';

import { UiDataGrid } from '@/ui';

defineProps<{
	grid: DataGrid;
	label: string;
}>();

const emit = defineEmits<{
	drop: [event: GridRowDropEvent<unknown>];
}>();
</script>

<template>
	<section class="task-list">
		<h3 class="task-list-title">
			{{ label }}
			<span class="task-list-count">{{ grid.rows.value.length }}</span>
		</h3>
		<UiDataGrid :grid="grid" :label="label" data-size="sm">
			<slot />
			<template #body>
				<GridRowDrag group="tasks" @drop="event => emit('drop', event)">
					<GridBody v-slot="{ rows }">
						<GridRow v-for="row in rows" :key="row.key" :row="row">
							<GridCells />
						</GridRow>
					</GridBody>
					<GridDragOverlay v-slot="{ label: task }">Drop “{{ task }}” into {{ label }}</GridDragOverlay>
					<GridDragPreview v-slot="{ label: task }">
						<IconGripVertical aria-hidden="true" />
						{{ task }}
					</GridDragPreview>
				</GridRowDrag>
			</template>
		</UiDataGrid>
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
