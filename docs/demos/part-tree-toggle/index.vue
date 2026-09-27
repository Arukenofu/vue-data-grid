<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	navigation,
	TableBody,
	TableCells,
	TableHeader,
	TableHeaderCell,
	TableHeaderRow,
	TableRoot,
	TableRow,
	tree,
	useDataTable,
} from 'vue-data-grid';
import { h, shallowRef } from 'vue';

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
		cell: ({ row, node }) => h(FileCell, { file: row, node }),
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

const table = useDataTable({
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

		<TableRoot :table="table" label="Files" class="ui-table" data-size="sm">
			<TableHeader>
				<TableHeaderRow v-slot="{ columns: headers }">
					<TableHeaderCell v-for="header in headers" :key="header.key" :column="header" />
				</TableHeaderRow>
			</TableHeader>
			<TableBody v-slot="{ rows }">
				<TableRow v-for="row in rows" :key="row.key" :row="row">
					<TableCells />
				</TableRow>
			</TableBody>
		</TableRoot>
	</div>
</template>

<style scoped>
.files :deep(button[data-tc-part='tree-toggle']::before) {
	content: none;
}
</style>
