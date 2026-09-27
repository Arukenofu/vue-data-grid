<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
	/** From `0` to `1`; `null` without revenue. */
	value: number | null;
}>();

const tone = computed(() => {
	if (props.value === null) {
		return 'none';
	}

	if (props.value >= 0.44) {
		return 'high';
	}

	return props.value >= 0.36 ? 'mid' : 'low';
});
</script>

<template>
	<span class="margin" :data-tone="tone">
		<span class="margin-bar" aria-hidden="true">
			<span class="margin-fill" :style="{ width: `${Math.max(value ?? 0, 0) * 100}%` }" />
		</span>
		<span class="margin-value">{{ value === null ? '—' : `${(value * 100).toFixed(1)}%` }}</span>
	</span>
</template>

<style scoped>
.margin {
	--tone: var(--ui-fg-subtle);

	display: flex;
	flex: 1;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
}

.margin[data-tone='high'] {
	--tone: var(--ui-up);
}

.margin[data-tone='mid'] {
	--tone: var(--ui-warn);
}

.margin[data-tone='low'] {
	--tone: var(--ui-down);
}

.margin-bar {
	width: 40px;
	height: 5px;
	overflow: hidden;
	border-radius: 999px;
	background: var(--ui-bg-muted);
}

.margin-fill {
	display: block;
	height: 100%;
	border-radius: 999px;
	background: var(--tone);
}

.margin-value {
	width: 6ch;
	color: var(--tone);
	font-weight: 560;
	text-align: end;
}
</style>
