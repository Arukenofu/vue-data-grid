<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
	/** From `0` to `100`. */
	value: number;
}>();

const tone = computed(() => {
	if (props.value >= 100) {
		return 'done';
	}

	return props.value < 25 ? 'low' : 'on';
});
</script>

<template>
	<span class="ui-progress" :data-tone="tone" aria-hidden="true">
		<span class="ui-progress-bar" :style="{ width: `${Math.min(Math.max(value, 0), 100)}%` }" />
	</span>
</template>

<style scoped>
.ui-progress {
	display: inline-block;
	flex: 1;
	min-width: 48px;
	height: 6px;
	overflow: hidden;
	border-radius: 999px;
	background: var(--ui-border);
}

.ui-progress-bar {
	display: block;
	height: 100%;
	border-radius: 999px;
	background: var(--ui-accent);
	transition: width 0.3s;
}

.ui-progress[data-tone='low'] .ui-progress-bar {
	background: var(--ui-warn);
}

.ui-progress[data-tone='done'] .ui-progress-bar {
	background: var(--ui-up);
}
</style>
