<script setup lang="ts">
import { defineColumn, defineColumns, moveRow, useDataTable, useTableMotion } from '@vue-stack/table';
import { dragHandleColumn, TableDragPreview, useTableRowDrag } from '@vue-stack/table/drag-and-drop';
import { computed, shallowRef } from 'vue';

import { UiDataTable, UiToolbar } from '@/ui';

import { formatDuration, type Song, songs } from './songs';

const rows = shallowRef<readonly Song[]>(songs);

const column = defineColumn<Song>();

const columns = defineColumns({
	handle: dragHandleColumn(),
	number: column(song => song.number, { label: '#', width: 48, align: 'right', cellClass: () => 'ui-cell-muted' }),
	title: column(song => song.title, { label: 'Title', flex: 1, width: 180, rowHeader: true }),
	artist: column(song => song.artist, { label: 'Artist', width: 140 }),
	album: column(song => song.album, { label: 'Album', width: 130 }),
	length: column(song => song.seconds, { label: 'Length', width: 90, align: 'right', format: formatDuration }),
});

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 42,
});

useTableMotion(table);

const drag = useTableRowDrag(table, {
	handle: true,
	getLabel: song => song.title,
	onDrop: ({ key, row, index, parent }) => {
		rows.value = moveRow(rows.value, { key, row, index, parent }, { rowKey: 'id' });
	},
});

const status = computed(() => {
	const key = drag.active.value;
	const target = drag.target.value;

	if (key === null) {
		return 'Grab a handle, or focus it and press Space.';
	}

	const title = drag.getLabel(key);

	return target ? `Moving “${title}” to place ${target.index + 1}` : `Moving “${title}”`;
});
</script>

<template>
	<div>
		<UiToolbar>
			<span class="ui-toolbar-text">{{ status }}</span>
		</UiToolbar>

		<UiDataTable :table="table" label="Playlist" data-size="auto" />

		<TableDragPreview />
	</div>
</template>
