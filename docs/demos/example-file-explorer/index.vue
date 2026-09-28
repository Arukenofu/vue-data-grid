<script setup lang="ts">
import {
	defineColumn,
	defineColumns,
	GridBody,
	GridCells,
	GridRow,
	type GridSort,
	moveRow,
	navigation,
	tree,
	treeColumn,
	useDataGrid,
	useGridMotion,
} from '@vue-data-grid/core';
import { dragHandleColumn, GridDragPreview, useGridRowDrag } from '@vue-data-grid/core/drag-and-drop';
import IconFoldVertical from '~icons/lucide/fold-vertical';
import IconUnfoldVertical from '~icons/lucide/unfold-vertical';
import { computed, h, nextTick, ref, shallowRef, useTemplateRef } from 'vue';

import { type FileEntry, files as initialFiles, formatSize } from '@/data/files';
import { UiButton, UiDataGrid, UiStat, UiToolbar } from '@/ui';

import { type FileRow, formatDate, getFolders, KIND_LABELS, sortFiles, withFolderTotals } from './explorer';
import FileDetails from './FileDetails.vue';
import FileGhost from './FileGhost.vue';
import FileName from './FileName.vue';

const files = shallowRef<readonly FileEntry[]>(initialFiles);
const sort = ref<readonly GridSort[]>([{ name: 'name', direction: 'asc' }]);
const expanded = ref<string[]>();
const openKey = shallowRef<string | null>(null);
const details = useTemplateRef<InstanceType<typeof FileDetails>>('details');

const rows = computed(() => sortFiles(withFolderTotals(files.value), sort.value));
const rowsById = computed(() => new Map(rows.value.map(row => [row.id, row])));
const openFile = computed(() => (openKey.value === null ? undefined : rowsById.value.get(openKey.value)));
const openFolders = computed(() => (openKey.value === null ? [] : getFolders(files.value, openKey.value)));

const column = defineColumn<FileRow>({ sortable: true, resizable: true, sortOrder: ['asc', 'desc'] });

const columns = defineColumns({
	handle: dragHandleColumn(),
	name: treeColumn(column(file => file.name, {
		label: 'Name',
		flex: 1,
		minWidth: 280,
		cell: ({ row, node }) => h(FileName, { file: row, open: node?.expanded }),
	})),
	kind: column(file => KIND_LABELS[file.kind], { label: 'Kind', width: 130 }),
	size: column(file => file.size, { label: 'Size', width: 110, align: 'right', format: formatSize }),
	modified: column(file => file.modified, { label: 'Modified', width: 140, format: formatDate }),
});

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	sort,
	features: {
		tree: tree({ parentKey: 'parent', expanded, defaultExpanded: 1, sort: false }),
		navigation: navigation(),
	},
});

useGridMotion(grid);

useGridRowDrag(grid, {
	handle: true,
	enabled: true,
	stepKeys: false,
	indicator: 'line',
	canNest: file => file.kind === 'folder',
	canDrop: ({ row, parent }) => row.parent !== parent,
	getLabel: file => file.name,
	onDrop: ({ key, parent, index }) => {
		const file = files.value.find(entry => entry.id === key);

		if (file) {
			files.value = moveRow(files.value, { key, row: file, parent, index }, { rowKey: 'id', parentKey: 'parent' });
		}
	},
});

const totals = computed(() => {
	const stored = files.value.filter(file => file.kind !== 'folder');

	return { count: stored.length, size: stored.reduce((sum, file) => sum + file.size, 0) };
});

function expandAll() {
	expanded.value = files.value.filter(file => file.kind === 'folder').map(file => file.id);
}

function collapseAll() {
	expanded.value = [];
}

async function openDetails(key: string, moveFocus: boolean) {
	openKey.value = key;

	if (moveFocus) {
		await nextTick();
		details.value?.focus();
	}
}

function closeDetails() {
	const row = openKey.value === null ? -1 : grid.scope.getRowIndex(openKey.value);

	openKey.value = null;

	if (row !== -1) {
		void grid.navigation.focusCell({ section: 'body', row, cell: 'name' });
	}
}

function onRowClick(event: MouseEvent, key: string) {
	if (event.target instanceof Element && event.target.closest('button')) {
		return;
	}

	void openDetails(key, false);
}

function onRowKeydown(event: KeyboardEvent, key: string) {
	const cell = event.target instanceof HTMLElement && event.target.matches('[data-dg-column]') ? event.target : null;

	if (!cell || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
		return;
	}

	if (event.key === ' ' || (event.key === 'Enter' && !cell.querySelector('button'))) {
		event.preventDefault();
		void openDetails(key, true);
	}
}
</script>

<template>
	<div class="explorer">
		<UiToolbar>
			<UiButton @click="expandAll">
				<IconUnfoldVertical aria-hidden="true" />
				Expand all
			</UiButton>
			<UiButton @click="collapseAll">
				<IconFoldVertical aria-hidden="true" />
				Collapse all
			</UiButton>
			<span class="ui-spacer" />
			<UiStat label="Files" :value="totals.count" />
			<UiStat label="Total size" :value="formatSize(totals.size)" />
		</UiToolbar>

		<div class="explorer-body">
			<div class="explorer-grid">
				<UiDataGrid :grid="grid" label="Files" data-size="lg">
					<GridBody v-slot="{ rows: shown }">
						<GridRow
							v-for="row in shown"
							:key="row.key"
							:row="row"
							:aria-current="row.key === openKey ? 'true' : undefined"
							@click="onRowClick($event, row.key)"
							@keydown="onRowKeydown($event, row.key)"
						>
							<GridCells />
						</GridRow>
					</GridBody>
					<GridDragPreview v-slot="{ key, label }">
						<FileGhost :label="label" :file="rowsById.get(key)" />
					</GridDragPreview>
				</UiDataGrid>
			</div>

			<Transition name="details">
				<div v-if="openFile" class="explorer-panel">
					<FileDetails ref="details" :file="openFile" :folders="openFolders" @close="closeDetails" />
				</div>
			</Transition>
		</div>

		<Transition name="backdrop">
			<div v-if="openFile" class="explorer-backdrop" aria-hidden="true" @click="closeDetails" />
		</Transition>
	</div>
</template>

<style scoped>
.explorer {
	position: relative;
	container: explorer / inline-size;
}

.explorer :deep(.ui-grid) {
	--dg-drop-color: var(--ui-accent);
}

.explorer :deep(.ui-grid [data-dg-part='row'][aria-level][aria-expanded] > [data-dg-column]) {
	font-weight: 400;
}

.explorer :deep(.ui-grid [data-dg-part='body'] > [data-dg-part='row']) {
	cursor: default;
}

.explorer :deep(.ui-grid [data-dg-part='body'] > [data-dg-part='row'][aria-current='true'] > [data-dg-column]) {
	background: color-mix(in srgb, var(--ui-accent) 10%, var(--ui-bg));
}

.explorer :deep(.ui-grid [data-dg-part='body'] > [data-dg-part='row'][aria-current='true'] > [data-dg-column]:first-child) {
	box-shadow: inset 2px 0 0 var(--ui-accent);
}

.explorer-body {
	display: flex;
}

.explorer-grid {
	flex: 1;
	min-width: 0;
}

.explorer-panel {
	flex: none;
	width: 300px;
	height: 520px;
	margin-inline-start: 12px;
	overflow: hidden;
}

.explorer-panel :deep(.details) {
	width: 300px;
}

.details-enter-active,
.details-leave-active {
	transition: width 0.25s cubic-bezier(0.2, 0, 0, 1), margin 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s, translate 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.details-enter-from,
.details-leave-to {
	width: 0;
	margin-inline-start: 0;
	opacity: 0;
}

.explorer-backdrop {
	display: none;
}

@container explorer (width < 720px) {
	.explorer-panel {
		position: absolute;
		inset: auto 0 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		width: auto;
		height: auto;
		max-height: 78%;
		margin: 0;
		overflow: visible;
	}

	.explorer-panel :deep(.details) {
		flex: 1 1 auto;
		width: 100%;
		height: auto;
		min-height: 0;
		border-radius: 16px 16px var(--ui-radius) var(--ui-radius);
		box-shadow: var(--ui-shadow-lg);
	}

	.details-enter-from,
	.details-leave-to {
		width: auto;
		opacity: 0;
		translate: 0 32px;
	}

	.explorer-backdrop {
		position: absolute;
		inset: 0;
		z-index: 9;
		display: block;
		border-radius: var(--ui-radius);
		background: rgb(0 0 0 / 32%);
	}

	.backdrop-enter-active,
	.backdrop-leave-active {
		transition: opacity 0.2s;
	}

	.backdrop-enter-from,
	.backdrop-leave-to {
		opacity: 0;
	}
}

@media (prefers-reduced-motion: reduce) {
	.details-enter-active,
	.details-leave-active,
	.backdrop-enter-active,
	.backdrop-leave-active {
		transition: none;
	}
}
</style>
