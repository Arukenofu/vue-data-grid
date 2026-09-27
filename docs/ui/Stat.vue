<script setup lang="ts">
defineProps<{
	label: string;
	/** The value; the default slot instead, for one with markup. */
	value?: string | number;
}>();
</script>

<template>
	<span class="ui-stat">
		<span class="ui-stat-label">{{ label }}</span>
		<span class="ui-stat-value"><slot>{{ value }}</slot></span>
	</span>
</template>

<style scoped>
.ui-stat {
	display: inline-flex;
	flex: none;
	align-items: baseline;
	gap: 6px;
	font: 400 12.5px/1.4 var(--ui-font);
	white-space: nowrap;
}

.ui-stat-label {
	color: var(--ui-fg-subtle);
}

.ui-stat-value {
	color: var(--ui-fg);
	font-weight: 560;
	font-variant-numeric: tabular-nums;
}
</style>
