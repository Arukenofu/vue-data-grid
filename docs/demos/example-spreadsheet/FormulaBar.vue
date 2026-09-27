<script setup lang="ts">
import IconFunctionSquare from '~icons/lucide/square-function';

defineProps<{
	reference: string;
	content: string;
	editing: boolean;
}>();
</script>

<template>
	<div class="formula" :data-editing="editing ? '' : undefined">
		<span class="formula-reference" aria-label="Active cell">{{ reference || '—' }}</span>
		<IconFunctionSquare class="formula-icon" aria-hidden="true" />
		<output class="formula-content" aria-label="Content of the active cell">{{ content }}</output>
	</div>
</template>

<style scoped>
.formula {
	display: flex;
	align-items: center;
	height: 34px;
	margin-block-end: 10px;
	overflow: hidden;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius-sm);
	background: var(--ui-bg);
	font-size: 13px;
	transition: border-color 0.15s, box-shadow 0.15s;
}

.formula[data-editing] {
	border-color: var(--ui-accent);
	box-shadow: var(--ui-ring);
}

.formula-reference {
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 64px;
	height: 100%;
	border-inline-end: 1px solid var(--ui-border);
	background: var(--ui-bg-subtle);
	font-family: var(--ui-font-mono);
	font-weight: 600;
}

.formula-icon {
	flex: none;
	margin-inline: 10px 8px;
	color: var(--ui-fg-subtle);
	font-size: 15px;
}

.formula-content {
	overflow: hidden;
	color: var(--ui-fg);
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
