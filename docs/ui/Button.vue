<script setup lang="ts">
withDefaults(defineProps<{
	variant?: 'solid' | 'soft' | 'outline' | 'ghost';
	size?: 'sm' | 'md';
	/** A square button of an icon alone, named by `aria-label`. */
	icon?: boolean;
	type?: 'button' | 'submit' | 'reset';
}>(), { variant: 'outline', size: 'md', icon: false, type: 'button' });
</script>

<template>
	<button :type="type" class="ui-button" :data-variant="variant" :data-size="size" :data-square="icon || undefined">
		<slot />
	</button>
</template>

<style scoped>
.ui-button {
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	gap: 6px;
	height: 32px;
	padding: 0 12px;
	border: 1px solid transparent;
	border-radius: var(--ui-radius-sm);
	color: var(--ui-fg);
	font: 520 13px/1 var(--ui-font);
	letter-spacing: 0.01em;
	white-space: nowrap;
	cursor: pointer;
	transition: background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
}

.ui-button :deep(svg) {
	width: 15px;
	height: 15px;
	flex: none;
}

.ui-button[data-size='sm'] {
	height: 28px;
	padding: 0 10px;
	font-size: 12.5px;
}

.ui-button[data-square] {
	width: 32px;
	padding: 0;
}

.ui-button[data-size='sm'][data-square] {
	width: 28px;
}

.ui-button[data-variant='solid'] {
	background: var(--ui-accent);
	color: var(--ui-accent-fg);
	box-shadow: var(--ui-shadow-sm), inset 0 1px 0 rgb(255 255 255 / 16%);
}

.ui-button[data-variant='solid']:hover:not(:disabled) {
	background: var(--ui-accent-hover);
}

.ui-button[data-variant='soft'] {
	background: var(--ui-accent-soft);
	color: var(--ui-accent-text);
}

.ui-button[data-variant='soft']:hover:not(:disabled) {
	background: var(--ui-accent-soft-hover);
}

.ui-button[data-variant='outline'] {
	border-color: var(--ui-border);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-sm);
}

.ui-button[data-variant='outline']:hover:not(:disabled) {
	border-color: var(--ui-border-strong);
	background: var(--ui-bg-subtle);
}

.ui-button[data-variant='ghost'] {
	background: transparent;
	color: var(--ui-fg-muted);
}

.ui-button[data-variant='ghost']:hover:not(:disabled) {
	background: var(--ui-bg-muted);
	color: var(--ui-fg);
}

.ui-button:focus-visible {
	outline: none;
	box-shadow: var(--ui-ring);
}

.ui-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
</style>
