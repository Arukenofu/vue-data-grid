<script setup lang="ts">
import type { CellChange } from 'vue-data-grid';

defineProps<{
	text: string;
	change: CellChange | undefined;
}>();
</script>

<template>
	<span :key="change?.at" class="price" :data-flash="change?.direction ?? undefined">{{ text }}</span>
</template>

<style scoped>
.price {
	padding: 3px 7px;
	margin-inline-end: -7px;
	border-radius: 6px;
	font-weight: 550;
}

.price[data-flash='up'] {
	animation: flash-up 0.9s ease-out;
}

.price[data-flash='down'] {
	animation: flash-down 0.9s ease-out;
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
	.price[data-flash] {
		animation: none;
	}
}
</style>
