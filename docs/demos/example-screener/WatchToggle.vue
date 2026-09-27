<script setup lang="ts">
import { TableSelectionCheckbox } from '@vue-data-grid/core';
import IconStar from '~icons/lucide/star';

defineProps<{
	rowKey: string;
	symbol: string;
}>();
</script>

<template>
	<TableSelectionCheckbox v-slot="{ selected }" :row="rowKey" :label="`Watch ${symbol}`" as-child>
		<button type="button" class="watch" :data-watched="selected ? '' : undefined">
			<IconStar aria-hidden="true" />
		</button>
	</TableSelectionCheckbox>
</template>

<style scoped>
.watch[data-dg-part] {
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	margin: 0;
	padding: 0;
	border: none;
	border-radius: 6px;
	background: none;
	color: var(--ui-fg-subtle);
	cursor: pointer;
	appearance: none;
	transition: color 0.15s, background-color 0.15s, scale 0.15s;
}

.watch[data-dg-part]::before {
	content: none;
}

.watch[data-dg-part]:hover {
	background: var(--ui-bg-muted);
	color: var(--ui-fg);
}

.watch[data-dg-part]:focus-visible {
	outline: none;
	box-shadow: var(--ui-ring);
}

.watch[data-dg-part]:active {
	scale: 0.9;
}

.watch[data-watched] {
	color: #f59e0b;
}

.watch[data-watched]:hover {
	color: #d97706;
}

.watch svg {
	flex: none;
	width: 16px;
	height: 16px;
}

.watch[data-watched] :deep(path) {
	fill: currentColor;
}
</style>
