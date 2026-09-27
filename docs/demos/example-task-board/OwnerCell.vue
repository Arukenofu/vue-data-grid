<script setup lang="ts">
import { UiAvatar } from '@/ui';

defineProps<{ name: string }>();
</script>

<template>
	<span class="owner" :title="name">
		<UiAvatar :name="name" />
		<span class="owner-name">{{ name }}</span>
	</span>
</template>

<style scoped>
.owner {
	display: inline-flex;
}

.owner-name {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}
</style>
