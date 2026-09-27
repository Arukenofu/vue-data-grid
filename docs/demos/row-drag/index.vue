<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	moveRow,
	navigation,
	TableBody,
	TableCells,
	TableRow,
	useDataTable,
} from '@vue-data-grid/core';
import {
	dragHandleColumn,
	type DragIndicator,
	TableDragPreview,
	type TableRowDropEvent,
	TableRowDrag,
} from '@vue-data-grid/core/drag-and-drop';
import IconMusic from '~icons/lucide/music';
import { computed, shallowRef } from 'vue';

import { type ToggleOption, UiDataTable, UiStat, UiToggleGroup, UiToolbar } from '@/ui';

import { type Track, tracks } from './data';

const INDICATORS: readonly ToggleOption<DragIndicator>[] = [
	{ value: 'gap', label: 'Gap' },
	{ value: 'line', label: 'Line' },
	{ value: 'mark', label: 'Mark' },
];

function formatTime(seconds: number) {
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const column = defineColumn<Track>();

const columns = defineColumns({
	handle: dragHandleColumn(),
	number: column(track => track.number, { label: '#', width: 48, align: 'right', cellClass: () => 'ui-cell-muted' }),
	title: column(track => track.title, { label: 'Title', width: 170, flex: 1, rowHeader: true }),
	artist: column(track => track.artist, { label: 'Artist', width: 140 }),
	time: column(track => track.seconds, { label: 'Time', width: 72, align: 'right', format: formatTime }),
});

const playlist = shallowRef(tracks);
const indicator = shallowRef<DragIndicator>('gap');

const table = useDataTable({
	columns,
	rows: playlist,
	rowKey: 'id',
	rowHeight: 44,
	features: { navigation: navigation() },
});

const length = computed(() => formatTime(playlist.value.reduce((total, track) => total + track.seconds, 0)));

function reorder(event: TableRowDropEvent<unknown>) {
	const track = playlist.value.find(item => item.id === event.key);

	if (track) {
		playlist.value = moveRow(playlist.value, { ...event, row: track }, { rowKey: 'id' });
	}
}
</script>

<template>
	<div class="ui-stack">
		<UiToolbar>
			<span class="ui-toolbar-text">Show the place as</span>
			<UiToggleGroup v-model="indicator" :options="INDICATORS" label="Show the place as" />
			<span class="ui-spacer" />
			<UiStat label="Tracks" :value="playlist.length" />
			<UiStat label="Length" :value="length" />
		</UiToolbar>

		<UiDataTable :table="table" label="Playlist">
			<TableRowDrag handle :indicator="indicator" @drop="reorder">
				<TableBody v-slot="{ rows }">
					<TableRow v-for="row in rows" :key="row.key" :row="row">
						<TableCells />
					</TableRow>
				</TableBody>
				<TableDragPreview v-slot="{ label }">
					<IconMusic aria-hidden="true" />
					{{ label }}
				</TableDragPreview>
			</TableRowDrag>
		</UiDataTable>
	</div>
</template>
