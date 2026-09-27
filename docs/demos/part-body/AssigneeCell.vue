<script setup lang="ts">
import { UiAvatar } from '@/ui';

defineProps<{ name: string }>();
</script>

<template>
	<span class="assignee">
		<UiAvatar :name="name" />
		<span class="assignee-name">{{ name }}</span>
	</span>
</template>

<style scoped>
.assignee {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.assignee-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
