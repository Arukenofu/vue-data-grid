<script setup lang="ts">
export type BadgeTone = 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'gray';

withDefaults(defineProps<{
	tone?: BadgeTone;
	/** A dot before the text, for a status. */
	dot?: boolean;
}>(), { tone: 'gray', dot: false });
</script>

<template>
	<span class="ui-badge" :data-tone="tone">
		<span v-if="dot" class="ui-badge-dot" aria-hidden="true" />
		<slot />
	</span>
</template>

<style scoped>
.ui-badge {
	--badge-fg: var(--ui-fg-muted);
	--badge-bg: var(--ui-bg-muted);

	display: inline-flex;
	flex: none;
	align-items: center;
	gap: 5px;
	height: 20px;
	padding: 0 7px;
	border-radius: 999px;
	background: var(--badge-bg);
	color: var(--badge-fg);
	font: 540 11.5px/1 var(--ui-font);
	letter-spacing: 0.01em;
	white-space: nowrap;
}

.ui-badge[data-tone='green'] {
	--badge-fg: var(--ui-accent-text);
	--badge-bg: var(--ui-accent-soft);
}

.ui-badge[data-tone='red'] {
	--badge-fg: var(--ui-down);
	--badge-bg: var(--ui-down-soft);
}

.ui-badge[data-tone='amber'] {
	--badge-fg: var(--ui-warn);
	--badge-bg: var(--ui-warn-soft);
}

.ui-badge[data-tone='blue'] {
	--badge-fg: var(--ui-info);
	--badge-bg: var(--ui-info-soft);
}

.ui-badge[data-tone='violet'] {
	--badge-fg: var(--ui-violet);
	--badge-bg: var(--ui-violet-soft);
}

.ui-badge-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentcolor;
}
</style>
