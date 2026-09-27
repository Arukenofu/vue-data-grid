<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	moveRow,
	selection,
	selectionColumn,
	TableBody,
	TableCells,
	TableHeader,
	TableHeaderCell,
	TableHeaderRow,
	TableRoot,
	TableRow,
	tree,
	treeColumn,
	useDataTable,
} from 'vue-data-grid';
import { dragHandleColumn, TableDragPreview, type TableRowDropEvent, TableRowDrag } from 'vue-data-grid/drag-and-drop';
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

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		tree: tree({ parentKey: 'parent', defaultExpanded: -1 }),
		selection: selection(),
	},
});

const { selectedCount } = table.selection;

function drop({ key, parent, index }: TableRowDropEvent<unknown>) {
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

		<TableRoot :table="table" label="Work items" class="ui-table" data-size="auto">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns: headers }">
					<TableHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</TableHeaderRow>
			</TableHeader>
			<TableRowDrag handle @drop="drop">
				<TableBody v-slot="{ rows: bodyRows }">
					<TableRow v-for="row in bodyRows" :key="row.key" :row="row">
						<TableCells />
					</TableRow>
				</TableBody>
				<TableDragPreview v-slot="{ label }">
					<IconGripVertical aria-hidden="true" />
					{{ label }}
				</TableDragPreview>
			</TableRowDrag>
		</TableRoot>
	</div>
</template>
