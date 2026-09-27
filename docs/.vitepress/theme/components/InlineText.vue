<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ text: string }>();

/** The text in pieces, every other one wrapped in backticks: code. */
const pieces = computed(() => props.text.split('`').map((value, index) => ({ value, code: index % 2 === 1 })));
</script>

<template>
	<template v-for="(piece, index) in pieces" :key="index">
		<code v-if="piece.code">{{ piece.value }}</code>
		<template v-else>{{ piece.value }}</template>
	</template>
</template>
