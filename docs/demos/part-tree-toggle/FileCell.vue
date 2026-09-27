<script setup lang="ts">
import { type RowNode, TableTreeToggle } from '@vue-data-grid/core';
import IconChevronRight from '~icons/lucide/chevron-right';
import IconFileArchive from '~icons/lucide/file-archive';
import IconFileCode from '~icons/lucide/file-code';
import IconFileImage from '~icons/lucide/file-image';
import IconFileText from '~icons/lucide/file-text';
import IconFileVideo from '~icons/lucide/file-video';
import IconFolder from '~icons/lucide/folder';
import IconFolderOpen from '~icons/lucide/folder-open';
import { type Component, computed } from 'vue';

import type { FileEntry, FileKind } from '@/data/files';

const props = defineProps<{
	file: FileEntry;
	node?: RowNode;
}>();

const ICONS: Readonly<Record<Exclude<FileKind, 'folder'>, Component>> = {
	image: IconFileImage,
	code: IconFileCode,
	document: IconFileText,
	video: IconFileVideo,
	archive: IconFileArchive,
};

const INDENT = 20;

const icon = computed(() => {
	if (props.file.kind === 'folder') {
		return props.node?.expanded ? IconFolderOpen : IconFolder;
	}

	return ICONS[props.file.kind];
});
</script>

<template>
	<span class="file">
		<span class="indent" :style="{ width: `${(node?.level ?? 0) * INDENT}px` }" />
		<TableTreeToggle v-slot="{ expanded }" class="toggle">
			<IconChevronRight class="chevron" :data-expanded="expanded || undefined" />
		</TableTreeToggle>
		<component :is="icon" class="icon" :data-kind="file.kind" aria-hidden="true" />
		<span class="name">{{ file.name }}</span>
	</span>
</template>

<style scoped>
.file {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.indent {
	flex: none;
}

.chevron {
	width: 14px;
	height: 14px;
	transition: rotate 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.chevron[data-expanded] {
	rotate: 90deg;
}

.icon {
	flex: none;
	width: 16px;
	height: 16px;
	color: var(--ui-fg-subtle);
}

.icon[data-kind='folder'] {
	color: var(--ui-warn);
}

.icon[data-kind='image'] {
	color: var(--ui-violet);
}

.icon[data-kind='code'] {
	color: var(--ui-info);
}

.icon[data-kind='video'] {
	color: var(--ui-down);
}

.name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
