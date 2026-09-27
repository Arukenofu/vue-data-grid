<script setup lang="ts">
import IconTrendingDown from '~icons/lucide/trending-down';
import IconTrendingUp from '~icons/lucide/trending-up';

import { formatChange } from './format';

defineProps<{ value: number }>();
</script>

<template>
	<span class="change" :data-trend="value >= 0 ? 'up' : 'down'">
		<IconTrendingUp v-if="value >= 0" aria-hidden="true" />
		<IconTrendingDown v-else aria-hidden="true" />
		{{ formatChange(value) }}
	</span>
</template>

<style scoped>
.change {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 2px 8px;
	border-radius: 999px;
	font-size: 12.5px;
	font-weight: 600;
}

.change[data-trend='up'] {
	background: var(--ui-up-soft);
	color: var(--ui-up);
}

.change[data-trend='down'] {
	background: var(--ui-down-soft);
	color: var(--ui-down);
}

.change svg {
	font-size: 13px;
}
</style>
