<script setup lang="ts">
import type { CellChange } from 'vue-data-grid';

defineProps<{
	text: string;
	change: () => CellChange | undefined;
}>();
</script>

<template>
	<span :key="change()?.at" class="flash" :data-flash="change()?.direction ?? undefined">{{ text }}</span>
</template>

<style scoped>
.flash {
	margin-inline-end: -6px;
	padding: 2px 6px;
	border-radius: 6px;
}

.flash[data-flash='up'] {
	animation: flash-up 1s ease-out;
}

.flash[data-flash='down'] {
	animation: flash-down 1s ease-out;
}

@keyframes flash-up {
	from {
		background: var(--ui-up-soft);
		color: var(--ui-up);
	}
}

@keyframes flash-down {
	from {
		background: var(--ui-down-soft);
		color: var(--ui-down);
	}
}

@media (prefers-reduced-motion: reduce) {
	.flash[data-flash] {
		animation: none;
	}
}
</style>
