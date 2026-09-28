<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridCellTemplate,
	GridHeader,
	GridHeaderCell,
	GridHeaderRow,
	GridRoot,
	GridRow,
	navigation,
	tree,
	useDataGrid,
} from '@vue-data-grid/core';
import { shallowRef } from 'vue';

import { type FileEntry, files, formatSize } from '@/data/files';
import { UiButton, UiToolbar } from '@/ui';

import FileCell from './FileCell.vue';

const FOLDERS = files.filter(file => file.kind === 'folder').map(file => file.id);

const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function measure(file: FileEntry): number {
	if (file.kind !== 'folder') {
		return file.size;
	}

	let total = 0;

	for (const child of files) {
		if (child.parent === file.id) {
			total += measure(child);
		}
	}

	return total;
}

const sizes = new Map(files.map(file => [file.id, measure(file)]));

const column = defineColumn<FileEntry>();

const columns = defineColumns({
	name: column(file => file.name, {
		label: 'Name',
		width: 280,
		flex: 1,
		tree: true,
	}),
	size: column(file => sizes.get(file.id) ?? file.size, {
		label: 'Size',
		width: 110,
		align: 'right',
		format: size => formatSize(size),
	}),
	modified: column(file => file.modified, {
		label: 'Modified',
		width: 140,
		format: modified => day.format(new Date(modified)),
	}),
});

const expanded = shallowRef<string[] | undefined>(['design', 'brand']);

const grid = useDataGrid({
	columns,
	rows: files,
	rowKey: 'id',
	rowHeight: 38,
	features: {
		tree: tree({ parentKey: 'parent', expanded }),
		navigation: navigation(),
	},
});
</script>

<template>
	<div class="files">
		<UiToolbar>
			<UiButton size="sm" @click="expanded = FOLDERS">Expand all</UiButton>
			<UiButton size="sm" @click="expanded = []">Collapse all</UiButton>
		</UiToolbar>

		<GridRoot :grid="grid" label="Files" class="ui-grid" data-size="sm">
			<GridCellTemplate v-slot="{ row, node }" :column="columns.name">
				<FileCell :file="row" :node="node" />
			</GridCellTemplate>
			<GridHeader>
				<GridHeaderRow v-slot="{ columns: headers }">
					<GridHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</GridHeaderRow>
			</GridHeader>
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
		</GridRoot>
	</div>
</template>

<style scoped>
.files :deep(button[data-dg-part='tree-toggle']::before) {
	content: none;
}
</style>
