<script setup lang="ts">
import { UiAvatar, UiBadge } from '@/ui';

import { type BoardTask, PRIORITIES } from './board';

defineProps<{
	label: string;
	task?: BoardTask;
}>();
</script>

<template>
	<span class="ghost">
		<UiBadge v-if="task" :tone="PRIORITIES[task.priority].tone" dot>{{ PRIORITIES[task.priority].label }}</UiBadge>
		<span class="ghost-title">{{ label }}</span>
		<UiAvatar v-if="task" :name="task.assignee" />
	</span>
</template>

<style scoped>
.ghost {
	display: flex;
	align-items: center;
	gap: 10px;
	max-width: 340px;
	rotate: -1.5deg;
}

.ghost-title {
	overflow: hidden;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
