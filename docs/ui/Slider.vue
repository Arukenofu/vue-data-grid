<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui';
import { computed } from 'vue';

const model = defineModel<number>({ required: true });

withDefaults(defineProps<{
	label: string;
	min?: number;
	max?: number;
	step?: number;
}>(), { min: 0, max: 100, step: 1 });

const values = computed({
	get: () => [model.value],
	set: (next: number[] | undefined) => {
		model.value = next?.[0] ?? model.value;
	},
});
</script>

<template>
	<span class="ui-slider">
		<span class="ui-slider-label">{{ label }}</span>
		<SliderRoot v-model="values" class="ui-slider-root" :min="min" :max="max" :step="step">
			<SliderTrack class="ui-slider-track">
				<SliderRange class="ui-slider-range" />
			</SliderTrack>
			<SliderThumb class="ui-slider-thumb" :aria-label="label" />
		</SliderRoot>
	</span>
</template>

<style scoped>
.ui-slider {
	display: inline-flex;
	align-items: center;
	gap: 10px;
}

.ui-slider-label {
	color: var(--ui-fg-muted);
	font-size: 13px;
	white-space: nowrap;
}

.ui-slider-root {
	position: relative;
	display: flex;
	align-items: center;
	width: 120px;
	height: 20px;
	touch-action: none;
	user-select: none;
}

.ui-slider-track {
	position: relative;
	flex: 1;
	height: 4px;
	border-radius: 999px;
	background: var(--ui-border);
}

.ui-slider-range {
	position: absolute;
	height: 100%;
	border-radius: 999px;
	background: var(--ui-accent);
}

.ui-slider-thumb {
	display: block;
	width: 16px;
	height: 16px;
	border: 2px solid var(--ui-accent);
	border-radius: 999px;
	background: var(--ui-bg);
	box-shadow: 0 1px 3px rgb(0 0 0 / 20%);
}

.ui-slider-thumb:focus-visible {
	outline: none;
	box-shadow: 0 0 0 4px var(--ui-accent-soft);
}
</style>
