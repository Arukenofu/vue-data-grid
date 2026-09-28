<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	editing,
	GridBody,
	GridCells,
	GridCellTemplate,
	GridEditorTemplate,
	GridFooter,
	GridFooterCell,
	GridFooterRow,
	GridFooterTemplate,
	GridHeaderTemplate,
	GridRoot,
	GridRow,
	navigation,
	sorting,
	useDataGrid,
} from '@vue-data-grid/core';
import { shallowRef } from 'vue';

import { type Priority, type Task, tasks } from '@/data/tasks';
import { type BadgeTone, UiAvatar, UiBadge, UiDataGridHeader, UiProgress } from '@/ui';

const PRIORITY: Readonly<Record<Priority, BadgeTone>> = {
	low: 'gray',
	medium: 'blue',
	high: 'amber',
	urgent: 'red',
};

const column = defineColumn<Task>({ sortable: true });

const columns = defineColumns({
	title: column('title', { label: 'Task', width: 240, flex: 1 }),
	assignee: column('assignee', { label: 'Owner', width: 170 }),
	priority: column('priority', { label: 'Priority', width: 110 }),
	progress: column('progress', { label: 'Progress', width: 150 }),
	estimate: column('estimate', {
		label: 'Days',
		width: 80,
		align: 'right',
		aggregate: 'sum',
		editable: true,
		setValue: (task, estimate) => ({ ...task, estimate }),
		validate: estimate => (Number.isInteger(estimate) && estimate > 0 ? undefined : 'Whole days, one or more'),
		parse: text => Number(text),
	}),
});

const rows = shallowRef<readonly Task[]>(tasks);

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 44,
	features: {
		sorting: sorting(),
		navigation: navigation(),
		editing: editing({
			onCommit: (commit) => {
				rows.value = commit.apply(rows.value);
			},
		}),
	},
});

function readText(event: Event) {
	return event.target instanceof HTMLInputElement ? event.target.value : '';
}
</script>

<template>
	<div>
		<GridRoot :grid="grid" label="Tasks" class="ui-grid">
			<GridHeaderTemplate v-slot="{ column: header }" :column="columns.estimate">
				<abbr title="Estimate in working days">{{ header.label }}</abbr>
			</GridHeaderTemplate>

			<GridCellTemplate v-slot="{ value }" :column="columns.assignee">
				<span class="owner">
					<UiAvatar :name="value" />
					{{ value }}
				</span>
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ value }" :column="columns.priority">
				<UiBadge :tone="PRIORITY[value]" dot>{{ value }}</UiBadge>
			</GridCellTemplate>
			<GridCellTemplate v-slot="{ value }" :column="columns.progress">
				<UiProgress :value="value" />
			</GridCellTemplate>

			<GridEditorTemplate v-slot="{ inputProps, text, draft, error, errorId, setText }" :column="columns.estimate">
				<input v-bind="inputProps" type="text" inputmode="numeric" :value="text ?? draft" @input="setText(readText($event))">
				<span v-if="error" :id="errorId" data-dg-part="editor-error">{{ error }}</span>
			</GridEditorTemplate>

			<GridFooterTemplate v-slot="{ aggregate }" :column="columns.estimate">
				<strong>{{ aggregate ?? 0 }}</strong>
			</GridFooterTemplate>

			<GridFooterTemplate :column="columns.title">
				<strong>{{rows.length}} {{ rows.length === 1 ? 'task' : 'tasks' }}</strong>
			</GridFooterTemplate>

			<UiDataGridHeader />

			<GridBody v-slot="{ rows: bodyRows }">
				<GridRow v-for="row in bodyRows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
			<GridFooter>
				<GridFooterRow v-slot="{ columns: footers }">
					<GridFooterCell v-for="footer in footers" :key="footer.key" :column="footer" />
				</GridFooterRow>
			</GridFooter>
		</GridRoot>
	</div>
</template>

<style scoped>
.owner {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	width: 100%;
}
</style>
