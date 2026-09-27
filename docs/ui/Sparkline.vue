<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
	values: readonly number[];
	width?: number;
	height?: number;
}>(), { width: 88, height: 26 });

const PADDING = 2;

const path = computed(() => {
	const { values, width, height } = props;

	if (values.length < 2) {
		return '';
	}

	const min = Math.min(...values);
	const range = Math.max(...values) - min || 1;
	const step = (width - PADDING * 2) / (values.length - 1);

	return values
		.map((value, index) => {
			const x = PADDING + index * step;
			const y = height - PADDING - ((value - min) / range) * (height - PADDING * 2);

			return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
		})
		.join(' ');
});

const rising = computed(() => (props.values.at(-1) ?? 0) >= (props.values[0] ?? 0));
</script>

<template>
	<svg
		class="ui-sparkline"
		:data-trend="rising ? 'up' : 'down'"
		:width="width"
		:height="height"
		:viewBox="`0 0 ${width} ${height}`"
		aria-hidden="true"
	>
		<path :d="path" />
	</svg>
</template>

<style scoped>
.ui-sparkline {
	flex: none;
	overflow: visible;
}

.ui-sparkline path {
	fill: none;
	stroke: var(--ui-up);
	stroke-linecap: round;
	stroke-linejoin: round;
	stroke-width: 1.5;
}

.ui-sparkline[data-trend='down'] path {
	stroke: var(--ui-down);
}
</style>
