<script setup lang="ts">
import type { FileRow } from './explorer';
import FileName from './FileName.vue';

defineProps<{
	label: string;
	file?: FileRow;
}>();
</script>

<template>
	<span class="ghost">
		<FileName v-if="file" :file="file" />
		<template v-else>{{ label }}</template>
	</span>
</template>

<style scoped>
.ghost {
	display: flex;
	width: 240px;
}
</style>
