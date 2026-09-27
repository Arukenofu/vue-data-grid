<script setup lang="ts">
import type { FileRow } from './explorer';
import FileIcon from './FileIcon.vue';

defineProps<{
	file: FileRow;
	open?: boolean;
}>();
</script>

<template>
	<span class="file" :data-kind="file.kind">
		<FileIcon :kind="file.kind" :open="open" />
		<span class="file-name">{{ file.name }}</span>
		<span v-if="file.items !== undefined" class="file-items">{{ file.items }} {{ file.items === 1 ? 'file' : 'files' }}</span>
	</span>
</template>

<style scoped>
.file {
	display: flex;
	flex: 1;
	align-items: center;
	gap: 8px;
	min-width: 0;
	contain: inline-size;
}

.file-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.file[data-kind='folder'] .file-name {
	font-weight: 560;
}

.file-items {
	flex: none;
	color: var(--ui-fg-subtle);
	font-size: 12px;
}
</style>
