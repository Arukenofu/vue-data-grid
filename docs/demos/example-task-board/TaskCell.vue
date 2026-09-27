<script setup lang="ts">
import { UiProgress } from '@/ui';

import type { BoardTask } from './board';

defineProps<{ task: BoardTask }>();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDue(date: string) {
	const [, month, day] = date.split('-');

	return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}
</script>

<template>
	<span class="task">
		<span class="task-title">{{ task.title }}</span>
		<span class="task-meta">
			<span>{{ task.estimate }} {{ task.estimate === 1 ? 'pt' : 'pts' }} · {{ formatDue(task.due) }}</span>
			<span class="task-progress">
				<UiProgress :value="task.progress" />
				{{ task.progress }}%
			</span>
		</span>
	</span>
</template>

<style scoped>
.task {
	display: grid;
	flex: 1;
	gap: 2px;
	min-width: 0;
	contain: inline-size;
	line-height: 1.35;
}

.task-title {
	overflow: hidden;
	font-weight: 520;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.task-meta {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	color: var(--ui-fg-subtle);
	font-size: 12px;
	white-space: nowrap;
}

.task-progress {
	display: flex;
	flex: none;
	align-items: center;
	gap: 6px;
	width: 88px;
	font-variant-numeric: tabular-nums;
}
</style>
