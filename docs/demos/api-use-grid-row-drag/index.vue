<script setup lang="ts">
import { defineColumn, defineColumns, moveRow, useDataGrid, useGridMotion } from '@vue-data-grid/core';
import { dragHandleColumn, GridDragPreview, useGridRowDrag } from '@vue-data-grid/core/drag-and-drop';
import { computed, shallowRef } from 'vue';

import { UiDataGrid, UiToolbar } from '@/ui';

import { formatDuration, type Song, songs } from './songs';

const rows = shallowRef<readonly Song[]>(songs);

const column = defineColumn<Song>();

const columns = defineColumns({
	handle: dragHandleColumn(),
	number: column('number', { label: '#', width: 48, align: 'right', cellClass: () => 'ui-cell-muted' }),
	title: column('title', { label: 'Title', flex: 1, width: 180, rowHeader: true }),
	artist: column('artist', { label: 'Artist', width: 140 }),
	album: column('album', { label: 'Album', width: 130 }),
	length: column('seconds', { label: 'Length', width: 90, align: 'right', format: formatDuration }),
});

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 42,
});

useGridMotion(grid);

const drag = useGridRowDrag(grid, {
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

		<UiDataGrid :grid="grid" label="Playlist" data-size="auto" />

		<GridDragPreview />
	</div>
</template>
