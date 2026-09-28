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
	useDataGrid,
} from '@vue-data-grid/core';
import {
	GridDragPreview,
	GridDropZone,
	type GridDropZoneEvent,
	type GridRowDropEvent,
	GridRowDrag,
} from '@vue-data-grid/core/drag-and-drop';
import IconFile from '~icons/lucide/file';
import IconStar from '~icons/lucide/star';
import IconTrash from '~icons/lucide/trash-2';
import { h, shallowRef } from 'vue';

import { type FileEntry, files, formatSize } from '@/data/files';
import { UiButton, UiToolbar } from '@/ui';

const initial = files.filter(file => file.kind !== 'folder');

const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const rows = shallowRef<readonly FileEntry[]>(initial);
const starred = shallowRef<ReadonlySet<string>>(new Set(['launch']));

const column = defineColumn<FileEntry>();

const columns = defineColumns({
	name: column(file => file.name, {
		label: 'Name',
		width: 180,
		flex: 1,
		cell: ({ key, value }) => h('span', { class: 'file-name' }, [
			value,
			starred.value.has(key) ? h(IconStar, { class: 'file-star', 'aria-label': 'Starred' }) : null,
		]),
	}),
	size: column(file => file.size, { label: 'Size', width: 84, align: 'right', format: formatSize }),
	modified: column(file => file.modified, { label: 'Modified', width: 90, format: modified => day.format(new Date(modified)) }),
});

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 38,
});

function reorder({ key, index }: GridRowDropEvent<unknown>) {
	const row = rows.value.find(file => file.id === key);

	if (row) {
		rows.value = moveRow(rows.value, { key, row, parent: null, index }, { rowKey: 'id' });
	}
}

function star({ key }: GridDropZoneEvent) {
	starred.value = new Set([...starred.value, key]);
}

function remove({ key }: GridDropZoneEvent) {
	rows.value = rows.value.filter(file => file.id !== key);
}

function restore() {
	rows.value = initial;
	starred.value = new Set(['launch']);
}
</script>

<template>
	<div>
		<UiToolbar>
			<span class="ui-toolbar-text">{{ rows.length }} files</span>
			<span class="ui-spacer" />
			<UiButton size="sm" variant="ghost" @click="restore">Restore all</UiButton>
		</UiToolbar>

		<div class="layout">
			<GridRoot :grid="grid" label="Files" class="ui-grid" data-size="sm">
				<GridHeader>
					<GridHeaderRow v-slot="{ columns: headers }">
						<GridHeaderCell v-for="header in headers" :key="header.key" :column="header" />
					</GridHeaderRow>
				</GridHeader>
				<GridRowDrag bounds="window" @drop="reorder">
					<GridBody v-slot="{ rows: bodyRows }">
						<GridRow v-for="row in bodyRows" :key="row.key" :row="row">
							<GridCells />
						</GridRow>
					</GridBody>
					<GridDragPreview v-slot="{ label }">
						<IconFile class="ghost-icon" aria-hidden="true" />
						{{ label }}
					</GridDragPreview>
				</GridRowDrag>
			</GridRoot>

			<div class="zones">
				<GridDropZone v-slot="{ ready, over }" class="zone" data-kind="star" @drop="star">
					<IconStar class="zone-icon" aria-hidden="true" />
					<strong>Starred</strong>
					<span v-if="over">Release to star</span>
					<span v-else-if="ready">Drop a file here</span>
					<span v-else>{{ starred.size }} starred</span>
				</GridDropZone>
				<GridDropZone v-slot="{ ready, over }" class="zone" data-kind="trash" @drop="remove">
					<IconTrash class="zone-icon" aria-hidden="true" />
					<strong>Trash</strong>
					<span v-if="over">Release to delete</span>
					<span v-else-if="ready">Drop a file here</span>
					<span v-else>Drag files here</span>
				</GridDropZone>
			</div>
		</div>
	</div>
</template>

<style scoped>
.layout {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 170px;
	gap: 14px;
}

.zones {
	display: grid;
	grid-template-rows: 1fr 1fr;
	gap: 14px;
}

.zone {
	--tone: var(--ui-warn);

	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	padding: 16px;
	border: 1.5px dashed var(--ui-border-strong);
	border-radius: var(--ui-radius);
	background: var(--ui-bg);
	color: var(--ui-fg-muted);
	font-size: 12.5px;
	text-align: center;
	transition: border-color 0.15s, background-color 0.15s, transform 0.15s;
}

.zone[data-kind='trash'] {
	--tone: var(--ui-down);
}

.zone strong {
	color: var(--ui-fg);
	font-size: 13.5px;
}

.zone-icon {
	width: 22px;
	height: 22px;
	margin-block-end: 4px;
	color: var(--tone);
}

.zone[data-dg-state='ready'] {
	border-color: var(--tone);
	background: color-mix(in srgb, var(--tone) 6%, var(--ui-bg));
}

.zone[data-dg-state='over'] {
	border-style: solid;
	border-color: var(--tone);
	background: color-mix(in srgb, var(--tone) 14%, var(--ui-bg));
	transform: scale(1.03);
}

.ghost-icon {
	width: 14px;
	height: 14px;
	color: var(--ui-accent);
}

.layout :deep(.file-name) {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.layout :deep(.file-star) {
	flex: none;
	width: 13px;
	height: 13px;
	color: var(--ui-warn);
	fill: currentColor;
}

@media (max-width: 640px) {
	.layout {
		grid-template-columns: minmax(0, 1fr);
	}

	.zones {
		grid-template-columns: 1fr 1fr;
		grid-template-rows: none;
	}
}
</style>
