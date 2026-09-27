<script setup lang="ts">
import IconStar from '~icons/lucide/star';

defineProps<{
	starred: boolean;
	label: string;
}>();

defineEmits<{ toggle: [] }>();
</script>

<template>
	<button
		type="button"
		class="star"
		:aria-pressed="starred"
		:aria-label="`Star ${label}`"
		@click="$emit('toggle')"
	>
		<IconStar aria-hidden="true" />
	</button>
</template>

<style scoped>
.star {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	padding: 0;
	border: none;
	border-radius: var(--ui-radius-xs);
	background: none;
	color: var(--ui-fg-subtle);
	font-size: 15px;
	cursor: pointer;
	transition: color 0.15s, background-color 0.15s, scale 0.15s;
}

.star:hover {
	background: var(--ui-bg-hover);
	color: var(--ui-fg);
}

.star[aria-pressed='true'] {
	color: #f5a524;
}

.star[aria-pressed='true'] svg {
	fill: currentColor;
}

.star:active {
	scale: 0.9;
}
</style>
