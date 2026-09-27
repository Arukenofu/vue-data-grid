<script setup lang="ts">
import ExampleCard from './ExampleCard.vue';
import { EXAMPLES } from './examples';

withDefaults(defineProps<{
	/** How many examples to show, from the first; all by default. */
	limit?: number;
	/** How many cards a row holds at most. */
	columns?: number;
}>(), { limit: undefined, columns: 3 });
</script>

<template>
	<div class="example-gallery" :style="{ '--columns': columns }">
		<ExampleCard v-for="example in EXAMPLES.slice(0, limit)" :key="example.link" :example="example" data-example />
	</div>
</template>

<style scoped>
.example-gallery {
	display: grid;
	grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
	gap: 16px;
	margin-block: 24px;
}

@media (max-width: 959px) {
	.example-gallery {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@media (max-width: 639px) {
	.example-gallery {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
