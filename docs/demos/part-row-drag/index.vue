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
	navigation,
	useDataGrid,
} from '@vue-data-grid/core';
import {
	type DragIndicator,
	GridDragHandle,
	GridDragPreview,
	type GridRowDropEvent,
	type GridRowDropTarget,
	GridRowDrag,
} from '@vue-data-grid/core/drag-and-drop';
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
	number: column('number', { label: '#', width: 44, align: 'right', cellClass: () => 'ui-cell-muted' }),
	title: column('title', { label: 'Title', width: 170, flex: 1, rowHeader: true }),
	artist: column('artist', { label: 'Artist', width: 140 }),
	album: column('album', { label: 'Album', width: 120 }),
	seconds: column('seconds', { label: 'Time', width: 70, align: 'right', format: formatTime }),
});

const rows = shallowRef<readonly Track[]>(tracks);
const handle = shallowRef(true);
const indicator = shallowRef<DragIndicator>('gap');

const grid = useDataGrid({
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

function canDrop({ index }: GridRowDropTarget<unknown>) {
	return index > 0 && index < rows.value.length - 1;
}

function drop({ key, index }: GridRowDropEvent<unknown>) {
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

		<GridRoot :grid="grid" label="Playlist" class="ui-grid" data-size="auto">
			<GridHeader>
				<GridHeaderRow v-slot="{ columns: headers }">
					<GridHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</GridHeaderRow>
			</GridHeader>
			<GridRowDrag :handle="handle" :indicator="indicator" :can-drag="canDrag" :can-drop="canDrop" @drop="drop">
				<GridBody v-slot="{ rows: bodyRows }">
					<GridRow v-for="row in bodyRows" :key="row.key" :row="row">
						<GridCells v-slot="{ column }">
							<GridDragHandle v-if="column.name === 'grip'" v-slot="{ disabled }" class="ui-cell-button">
								<IconLock v-if="disabled" />
								<IconGripVertical v-else />
							</GridDragHandle>
						</GridCells>
					</GridRow>
				</GridBody>
				<GridDragPreview v-slot="{ label }">
					<IconMusic class="ghost-icon" aria-hidden="true" />
					{{ label }}
				</GridDragPreview>
			</GridRowDrag>
		</GridRoot>
	</div>
</template>

<style scoped>
.ghost-icon {
	width: 14px;
	height: 14px;
	color: var(--ui-accent);
}
</style>
