<script setup lang="ts" generic="TValue extends string">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';

import type { Option } from './types';

const props = defineProps<{
	options: readonly Option<TValue>[];
	/** The name of the group for screen readers. */
	label: string;
}>();

const model = defineModel<TValue>({ required: true });

// A single toggle group can be emptied by pressing the option that is on; a segmented control cannot.
function update(value: unknown) {
	const option = props.options.find(item => item.value === value);

	if (option) {
		model.value = option.value;
	}
}
</script>

<template>
	<ToggleGroupRoot
		type="single"
		:model-value="model"
		:aria-label="label"
		class="ui-toggle-group"
		@update:model-value="update"
	>
		<ToggleGroupItem v-for="option in options" :key="option.value" :value="option.value" class="ui-toggle-item">
			{{ option.label }}
		</ToggleGroupItem>
	</ToggleGroupRoot>
</template>

<style scoped>
.ui-toggle-group {
	display: inline-flex;
	flex: none;
	gap: 2px;
	height: 32px;
	padding: 3px;
	border-radius: var(--ui-radius-sm);
	background: var(--ui-bg-muted);
}

.ui-toggle-item {
	padding: 0 10px;
	border: none;
	border-radius: var(--ui-radius-xs);
	background: none;
	color: var(--ui-fg-muted);
	font: 500 12.5px/1 var(--ui-font);
	white-space: nowrap;
	cursor: pointer;
	transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
}

.ui-toggle-item:hover {
	color: var(--ui-fg);
}

.ui-toggle-item[data-state='on'] {
	background: var(--ui-bg);
	color: var(--ui-accent-text);
	box-shadow: var(--ui-shadow-sm), 0 0 0 1px var(--ui-border);
}

.ui-toggle-item:focus-visible {
	outline: none;
	box-shadow: var(--ui-ring);
}
</style>
