<script setup lang="ts">
import IconChevronRight from '~icons/lucide/chevron-right';
import IconX from '~icons/lucide/x';
import { computed, useId, useTemplateRef } from 'vue';

import { type FileEntry, formatSize } from '@/data/files';
import { UiButton } from '@/ui';

import { type FileRow, formatDate, KIND_LABELS } from './explorer';
import FileIcon from './FileIcon.vue';

const props = defineProps<{
	file: FileRow;
	folders: readonly FileEntry[];
}>();

const emit = defineEmits<{
	close: [];
}>();

const titleId = useId();
const title = useTemplateRef<HTMLElement>('title');

const bytes = computed(() => `${Math.round(props.file.size).toLocaleString('en-US')} bytes`);

function focus() {
	title.value?.focus();
}

defineExpose({ focus });
</script>

<template>
	<aside class="details" :aria-labelledby="titleId" @keydown.esc.stop="emit('close')">
		<div class="details-head">
			<span class="details-tile" :data-kind="file.kind">
				<FileIcon :kind="file.kind" />
			</span>
			<UiButton icon size="sm" variant="ghost" aria-label="Close details" class="details-close" @click="emit('close')">
				<IconX aria-hidden="true" />
			</UiButton>
		</div>

		<div :id="titleId" ref="title" class="details-title" role="heading" aria-level="3" tabindex="-1">
			{{ file.name }}
		</div>
		<p class="details-kind">{{ KIND_LABELS[file.kind] }}</p>

		<dl class="details-list">
			<div>
				<dt>Size</dt>
				<dd>
					{{ formatSize(file.size) }}
					<span class="details-muted">{{ bytes }}</span>
				</dd>
			</div>
			<div v-if="file.items !== undefined">
				<dt>Contains</dt>
				<dd>{{ file.items }} {{ file.items === 1 ? 'file' : 'files' }}</dd>
			</div>
			<div>
				<dt>Modified</dt>
				<dd>{{ formatDate(file.modified) }}</dd>
			</div>
			<div>
				<dt>Location</dt>
				<dd>
					<ol class="details-path" aria-label="Folders">
						<li>Home</li>
						<li v-for="folder in folders" :key="folder.id">
							<IconChevronRight aria-hidden="true" />
							{{ folder.name }}
						</li>
					</ol>
				</dd>
			</div>
		</dl>
	</aside>
</template>

<style scoped>
.details {
	display: flex;
	flex-direction: column;
	gap: 4px;
	width: 100%;
	height: 100%;
	padding: 16px;
	overflow: auto;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-sm);
	color: var(--ui-fg);
	font: 400 13px/1.45 var(--ui-font);
}

.details-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	margin-block-end: 10px;
}

.details-tile {
	--tone: var(--ui-fg-subtle);

	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 52px;
	height: 52px;
	border-radius: 14px;
	background: color-mix(in srgb, var(--tone) 12%, var(--ui-bg));
}

.details-tile[data-kind='folder'] {
	--tone: var(--ui-warn);
}

.details-tile[data-kind='image'] {
	--tone: var(--ui-violet);
}

.details-tile[data-kind='code'] {
	--tone: var(--ui-info);
}

.details-tile[data-kind='video'] {
	--tone: var(--ui-down);
}

.details-tile[data-kind='archive'] {
	--tone: var(--ui-accent-text);
}

.details-tile :deep(.file-icon) {
	width: 26px;
	height: 26px;
}

.details-title {
	overflow-wrap: anywhere;
	font-size: 15px;
	font-weight: 600;
	line-height: 1.35;
}

.details-title:focus-visible {
	border-radius: 4px;
	outline: none;
	box-shadow: var(--ui-ring);
}

.details-kind {
	margin: 0;
	color: var(--ui-fg-muted);
}

.details-list {
	display: grid;
	gap: 12px;
	margin: 14px 0 0;
	padding-block-start: 14px;
	border-block-start: 1px solid var(--ui-border);
}

.details-list dt {
	color: var(--ui-fg-subtle);
	font-size: 11.5px;
	font-weight: 600;
	letter-spacing: 0.04em;
	text-transform: uppercase;
}

.details-list dd {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 6px;
	margin: 2px 0 0;
}

.details-muted {
	color: var(--ui-fg-subtle);
	font-size: 12px;
}

.details-path {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 2px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.details-path li {
	display: inline-flex;
	align-items: center;
	gap: 2px;
}

.details-path svg {
	width: 13px;
	height: 13px;
	color: var(--ui-fg-subtle);
}
</style>
