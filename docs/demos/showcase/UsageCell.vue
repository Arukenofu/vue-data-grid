<script setup lang="ts">
import { UiProgress } from '@/ui';

import type { Account } from './accounts';

defineProps<{ account: Account }>();
</script>

<template>
	<span class="usage">
		<UiProgress :value="(account.seatsUsed / account.seats) * 100" />
		<span class="usage-text">{{ account.seatsUsed }}/{{ account.seats }}</span>
	</span>
</template>

<style scoped>
.usage {
	display: flex;
	flex: 1;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.usage-text {
	flex: none;
	min-width: 48px;
	color: var(--ui-fg-muted);
	font-size: 12px;
	text-align: end;
}
</style>
