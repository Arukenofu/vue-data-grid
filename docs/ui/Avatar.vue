<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ name: string }>();

const HUES = [152, 172, 200, 262, 330, 24, 45];

const initials = computed(() => props.name.split(' ').map(part => part[0] ?? '').join('').slice(0, 2));

const hue = computed(() => {
	let sum = 0;

	for (const letter of props.name) {
		sum += letter.charCodeAt(0);
	}

	return HUES[sum % HUES.length];
});
</script>

<template>
	<span class="ui-avatar" :style="{ '--hue': hue }" aria-hidden="true">{{ initials }}</span>
</template>

<style scoped>
.ui-avatar {
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	border-radius: 999px;
	background: hsl(var(--hue) 70% 92%);
	color: hsl(var(--hue) 55% 30%);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.02em;
}

:where(.dark) .ui-avatar {
	background: hsl(var(--hue) 35% 22%);
	color: hsl(var(--hue) 70% 80%);
}
</style>
