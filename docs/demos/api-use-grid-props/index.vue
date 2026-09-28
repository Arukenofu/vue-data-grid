<script setup lang="ts">
import { defineColumn, defineColumns, getCellText, sorting, useDataGrid, useHeaderCell } from '@vue-data-grid/core';

import { type Task, tasks } from '@/data/tasks';

const MARKS = { asc: '▲', desc: '▼', none: '' } as const;

const column = defineColumn<Task>({ sortable: true });

const columns = defineColumns({
	title: column(task => task.title, { label: 'Task', width: 250 }),
	assignee: column(task => task.assignee, { label: 'Assignee', width: 150 }),
	estimate: column(task => task.estimate, { label: 'Days', width: 90, align: 'right' }),
	due: column(task => task.due, { label: 'Due', flex: 1, width: 120 }),
});

const grid = useDataGrid({
	columns,
	rows: tasks,
	rowKey: 'id',
	rowHeight: 40,
	features: { sorting: sorting() },
});

const header = useHeaderCell(grid.scope);
const { root, head, items, rows, scope } = grid;
const rendered = scope.renderedColumns;
</script>

<template>
	<div ref="root" v-bind="grid.getGridProps()" aria-label="Tasks" class="ui-grid" data-size="sm">
		<div ref="head" v-bind="grid.getHeadProps()">
			<div v-bind="grid.getHeaderRowProps()">
				<div
					v-for="cell in rendered"
					:key="cell.key"
					v-bind="{ ...grid.getHeaderCellProps(cell), ...header.getHandlers(cell.key) }"
				>
					<template v-if="cell.column">
						<span data-dg-part="cell-text">{{ cell.column.label }}</span>
						<span class="sort-mark" aria-hidden="true">{{ MARKS[scope.getSortDirection(cell.key) ?? 'none'] }}</span>
					</template>
				</div>
			</div>
		</div>
		<div v-bind="grid.getBodyProps()">
			<div v-for="item in items" :key="item.key" v-bind="grid.getRowProps(item)">
				<div v-for="cell in rendered" :key="cell.key" v-bind="grid.getCellProps(cell)">
					<span v-if="cell.column" data-dg-part="cell-text">{{ getCellText(cell.column, rows[item.index]) }}</span>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.sort-mark {
	min-width: 1.25em;
	margin-inline-start: 4px;
	color: var(--ui-accent);
	font-size: 10px;
}
</style>
