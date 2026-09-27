<script setup lang="ts">
defineProps<{
	letter: string;
	name: string;
}>();
</script>

<template>
	<span class="heading">
		<span class="heading-letter">{{ letter }}</span>
		<span class="heading-name">{{ name }}</span>
	</span>
</template>

<style scoped>
.heading {
	display: flex;
	align-items: baseline;
	gap: 8px;
	min-width: 0;
}

.heading-letter {
	color: var(--ui-fg);
	font-weight: 650;
}

.heading-name {
	overflow: hidden;
	color: var(--ui-fg-subtle);
	font-size: 11.5px;
	font-weight: 500;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
