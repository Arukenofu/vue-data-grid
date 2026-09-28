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
	moveRow,
	selection,
	selectionColumn,
	tree,
	treeColumn,
	useDataGrid,
} from '@vue-data-grid/core';
import { dragHandleColumn, GridDragPreview, type GridRowDropEvent, GridRowDrag } from '@vue-data-grid/core/drag-and-drop';
import IconGripVertical from '~icons/lucide/grip-vertical';
import { shallowRef } from 'vue';

import { UiStat, UiToolbar } from '@/ui';

import { type WorkItem, workItems } from './data';

const column = defineColumn<WorkItem>();

const columns = defineColumns({
	drag: dragHandleColumn(),
	select: selectionColumn(),
	number: column(item => item.number, {
		label: 'ID',
		width: 72,
		format: number => `#${number}`,
		cellClass: () => 'ui-cell-muted',
	}),
	title: treeColumn(column(item => item.title, { label: 'Work item', width: 230, flex: 1, rowHeader: true })),
	owner: column(item => item.owner, { label: 'Owner', width: 140 }),
	points: column(item => item.points, {
		label: 'Points',
		width: 84,
		align: 'right',
		format: points => (points === 0 ? '—' : String(points)),
	}),
});

const rows = shallowRef<readonly WorkItem[]>(workItems);

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		tree: tree({ parentKey: 'parent', defaultExpanded: -1 }),
		selection: selection(),
	},
});

const { selectedCount } = grid.selection;

function drop({ key, parent, index }: GridRowDropEvent<unknown>) {
	const row = rows.value.find(item => item.id === key);

	if (row) {
		rows.value = moveRow(rows.value, { key, row, parent, index }, { rowKey: 'id', parentKey: 'parent' });
	}
}
</script>

<template>
	<div>
		<UiToolbar>
			<UiStat label="Selected tasks" :value="selectedCount" />
		</UiToolbar>

		<GridRoot :grid="grid" label="Work items" class="ui-grid" data-size="auto">
			<GridHeader>
				<GridHeaderRow v-slot="{ columns: headers }">
					<GridHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</GridHeaderRow>
			</GridHeader>
			<GridRowDrag handle @drop="drop">
				<GridBody v-slot="{ rows: bodyRows }">
					<GridRow v-for="row in bodyRows" :key="row.key" :row="row">
						<GridCells />
					</GridRow>
				</GridBody>
				<GridDragPreview v-slot="{ label }">
					<IconGripVertical aria-hidden="true" />
					{{ label }}
				</GridDragPreview>
			</GridRowDrag>
		</GridRoot>
	</div>
</template>
