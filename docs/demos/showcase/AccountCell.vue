<script setup lang="ts">
import { computed } from 'vue';

import type { Account } from './accounts';

const props = defineProps<{ account: Account }>();

const HUES = [152, 172, 200, 222, 262, 292, 330, 24, 45];

const initials = computed(() => props.account.company.split(' ').map(word => word[0] ?? '').join(''));

const hue = computed(() => HUES[[...props.account.company].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % HUES.length]);
</script>

<template>
	<span class="account">
		<span class="account-logo" :style="{ '--hue': hue }" aria-hidden="true">{{ initials }}</span>
		<span class="account-text">
			<span class="account-name">{{ account.company }}</span>
			<span class="account-email">{{ account.email }}</span>
		</span>
	</span>
</template>

<style scoped>
.account {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.account-logo {
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border-radius: 8px;
	background: linear-gradient(135deg, hsl(var(--hue) 70% 55%), hsl(calc(var(--hue) + 30) 70% 45%));
	color: #fff;
	font: 700 11px/1 var(--ui-font);
	letter-spacing: 0.02em;
}

.account-text {
	display: grid;
	min-width: 0;
	line-height: 1.3;
}

.account-name {
	overflow: hidden;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.account-email {
	overflow: hidden;
	color: var(--ui-fg-muted);
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
