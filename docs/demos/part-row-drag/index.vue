<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	moveRow,
	navigation,
	TableBody,
	TableCells,
	TableHeader,
	TableHeaderCell,
	TableHeaderRow,
	TableRoot,
	TableRow,
	useDataTable,
} from '@vue-stack/table';
import {
	type DragIndicator,
	TableDragHandle,
	TableDragPreview,
	type TableRowDropEvent,
	type TableRowDropTarget,
	TableRowDrag,
} from '@vue-stack/table/drag-and-drop';
import IconGripVertical from '~icons/lucide/grip-vertical';
import IconLock from '~icons/lucide/lock';
import IconMusic from '~icons/lucide/music';
import { computed, h, shallowRef } from 'vue';

import { UiStat, UiSwitch, UiToggleGroup, UiToolbar } from '@/ui';

import { type Track, tracks } from './data';

const INDICATORS = [
	{ value: 'gap', label: 'Gap' },
	{ value: 'line', label: 'Line' },
] as const;

function formatTime(seconds: number) {
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const column = defineColumn<Track>();

const columns = defineColumns({
	grip: column(() => null, { kind: 'service', label: 'Move', width: 40, align: 'center', header: () => '' }),
	number: column(track => track.number, { label: '#', width: 44, align: 'right', cellClass: () => 'ui-cell-muted' }),
	title: column(track => track.title, { label: 'Title', width: 170, flex: 1, rowHeader: true }),
	artist: column(track => track.artist, { label: 'Artist', width: 140 }),
	album: column(track => track.album, { label: 'Album', width: 120 }),
	seconds: column(track => track.seconds, { label: 'Time', width: 70, align: 'right', format: formatTime }),
});

const rows = shallowRef<readonly Track[]>(tracks);
const handle = shallowRef(true);
const indicator = shallowRef<DragIndicator>('gap');

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: { navigation: navigation() },
});

const locked = new Set(tracks.filter(track => track.locked).map(track => track.id));

const length = computed(() => {
	let total = 0;

	for (const track of rows.value) {
		total += track.seconds;
	}

	return formatTime(total);
});

function canDrag(_row: unknown, key: string) {
	return !locked.has(key);
}

function canDrop({ index }: TableRowDropTarget<unknown>) {
	return index > 0 && index < rows.value.length - 1;
}

function drop({ key, index }: TableRowDropEvent<unknown>) {
	const row = rows.value.find(track => track.id === key);

	if (row) {
		rows.value = moveRow(rows.value, { key, row, parent: null, index }, { rowKey: 'id' });
	}
}
</script>

<template>
	<div>
		<UiToolbar>
			<UiSwitch v-model="handle" label="Only by the handle" />
			<UiToggleGroup v-model="indicator" :options="INDICATORS" label="Show the place as" />
			<span class="ui-spacer" />
			<UiStat label="Playlist" :value="length" />
		</UiToolbar>

		<TableRoot :table="table" label="Playlist" class="ui-table" data-size="auto">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns: headers }">
					<TableHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</TableHeaderRow>
			</TableHeader>
			<TableRowDrag :handle="handle" :indicator="indicator" :can-drag="canDrag" :can-drop="canDrop" @drop="drop">
				<TableBody v-slot="{ rows: bodyRows }">
					<TableRow v-for="row in bodyRows" :key="row.key" :row="row">
						<TableCells v-slot="{ column }">
							<TableDragHandle v-if="column.name === 'grip'" v-slot="{ disabled }" class="ui-cell-button">
								<IconLock v-if="disabled" />
								<IconGripVertical v-else />
							</TableDragHandle>
						</TableCells>
					</TableRow>
				</TableBody>
				<TableDragPreview v-slot="{ label }">
					<IconMusic class="ghost-icon" aria-hidden="true" />
					{{ label }}
				</TableDragPreview>
			</TableRowDrag>
		</TableRoot>
	</div>
</template>

<style scoped>
.ghost-icon {
	width: 14px;
	height: 14px;
	color: var(--ui-accent);
}
</style>
