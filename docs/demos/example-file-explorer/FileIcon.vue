<script setup lang="ts">
import IconFileArchive from '~icons/lucide/file-archive';
import IconFileCode from '~icons/lucide/file-code';
import IconFileImage from '~icons/lucide/file-image';
import IconFileText from '~icons/lucide/file-text';
import IconFileVideo from '~icons/lucide/file-video';
import IconFolder from '~icons/lucide/folder';
import IconFolderOpen from '~icons/lucide/folder-open';
import { type Component, computed } from 'vue';

import type { FileKind } from '@/data/files';

const props = defineProps<{
	kind: FileKind;
	open?: boolean;
}>();

const ICONS: Readonly<Record<Exclude<FileKind, 'folder'>, Component>> = {
	image: IconFileImage,
	code: IconFileCode,
	document: IconFileText,
	video: IconFileVideo,
	archive: IconFileArchive,
};

const icon = computed(() => {
	if (props.kind === 'folder') {
		return props.open ? IconFolderOpen : IconFolder;
	}

	return ICONS[props.kind];
});
</script>

<template>
	<component :is="icon" class="file-icon" :data-kind="kind" aria-hidden="true" />
</template>

<style scoped>
.file-icon {
	flex: none;
	width: 17px;
	height: 17px;
	color: var(--ui-fg-subtle);
}

.file-icon[data-kind='folder'] {
	color: var(--ui-warn);
}

.file-icon[data-kind='image'] {
	color: var(--ui-violet);
}

.file-icon[data-kind='code'] {
	color: var(--ui-info);
}

.file-icon[data-kind='video'] {
	color: var(--ui-down);
}

.file-icon[data-kind='archive'] {
	color: var(--ui-accent-text);
}
</style>
