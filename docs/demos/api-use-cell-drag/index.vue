<script setup lang="ts">
import {
	type CellPosition,
	defineColumn,
	defineColumns,
	readGridPosition,
	selection,
	selectionColumn,
	useCellDrag,
	useDataTable,
} from 'vue-data-grid';

import { createPeople, type Person } from '@/data/people';
import { UiButton, UiDataTable, UiStat, UiToolbar } from '@/ui';

const people = createPeople(300, 23);

const column = defineColumn<Person>();

const columns = defineColumns({
	select: selectionColumn(),
	name: column(person => person.name, { label: 'Name', width: 170 }),
	role: column(person => person.role, { label: 'Role', flex: 1, width: 200 }),
	team: column(person => person.team, { label: 'Team', width: 130 }),
	location: column(person => person.location, { label: 'Location', width: 120 }),
});

const table = useDataTable({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 38,
	virtual: true,
	features: { selection: selection() },
});

const dataColumns = ['name', 'role', 'team', 'location'];

let anchor: number | null = null;

function selectFrom(start: number, end: number) {
	const keys = table.scope.rowKeys.value.slice(Math.min(start, end), Math.max(start, end) + 1);

	table.selection.set(keys);
}

const drag = useCellDrag(table, {
	getColumns: () => dataColumns,
	onCell: (cell) => {
		if (anchor !== null) {
			selectFrom(anchor, cell.index);
		}
	},
	onEnd: () => {
		anchor = null;
	},
});

function readCell(target: EventTarget | null): CellPosition | null {
	const cell = target instanceof Element ? target.closest('[data-tc-column]') : null;
	const position = cell ? readGridPosition(cell) : null;

	return position?.section === 'body' && dataColumns.includes(position.cell)
		? { index: position.row, column: position.cell }
		: null;
}

function startPainting(event: PointerEvent) {
	const cell = event.button === 0 ? readCell(event.target) : null;

	if (!cell) {
		return;
	}

	event.preventDefault();
	anchor = cell.index;
	selectFrom(cell.index, cell.index);
	drag.start(event, cell);
}

const selectedCount = table.selection.selectedCount;
</script>

<template>
	<div class="paint">
		<UiToolbar>
			<span class="ui-toolbar-text">Press on a row and drag up or down; near an edge the table scrolls.</span>
			<span class="ui-spacer" />
			<UiStat label="Selected" :value="selectedCount" />
			<UiButton variant="ghost" @click="table.selection.clear()">Clear</UiButton>
		</UiToolbar>

		<UiDataTable :table="table" label="People" data-size="sm" @pointerdown="startPainting" />
	</div>
</template>

<style scoped>
.paint :deep([data-tc-part='body']) {
	cursor: cell;
	user-select: none;
}
</style>
