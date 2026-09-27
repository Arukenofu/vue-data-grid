<script setup lang="ts" generic="TValue extends string | number">
import IconCheck from '~icons/lucide/check';
import IconChevronDown from '~icons/lucide/chevron-down';
import {
	SelectContent,
	SelectIcon,
	SelectItem,
	SelectItemIndicator,
	SelectItemText,
	SelectPortal,
	SelectRoot,
	SelectTrigger,
	SelectValue,
	SelectViewport,
} from 'reka-ui';

import type { Option } from './types';

// The root renders no element of its own: attributes such as `class` go to the trigger.
defineOptions({ inheritAttrs: false });

defineProps<{
	options: readonly Option<TValue>[];
	/** The name of the field for screen readers. */
	label?: string;
	placeholder?: string;
	size?: 'sm' | 'md';
}>();

const model = defineModel<TValue>({ required: true });
</script>

<template>
	<SelectRoot v-model="model">
		<SelectTrigger class="ui-select-trigger" :data-size="size" :aria-label="label" v-bind="$attrs">
			<SelectValue :placeholder="placeholder" />
			<SelectIcon as-child>
				<IconChevronDown class="ui-select-chevron" aria-hidden="true" />
			</SelectIcon>
		</SelectTrigger>
		<SelectPortal>
			<SelectContent class="ui-select-content" position="popper" :side-offset="6">
				<SelectViewport class="ui-select-viewport">
					<SelectItem v-for="option in options" :key="option.value" :value="option.value" class="ui-select-item">
						<SelectItemText>{{ option.label }}</SelectItemText>
						<SelectItemIndicator class="ui-select-indicator">
							<IconCheck aria-hidden="true" />
						</SelectItemIndicator>
					</SelectItem>
				</SelectViewport>
			</SelectContent>
		</SelectPortal>
	</SelectRoot>
</template>

<style>
.ui-select-trigger {
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 120px;
	height: 32px;
	padding: 0 8px 0 10px;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius-sm);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-sm);
	color: var(--ui-fg);
	font: 450 13px/1 var(--ui-font);
	cursor: pointer;
	transition: border-color 0.15s, box-shadow 0.15s;
}

.ui-select-trigger[data-size='sm'] {
	min-width: 100px;
	height: 28px;
	font-size: 12.5px;
}

.ui-select-trigger:hover {
	border-color: var(--ui-border-strong);
}

.ui-select-trigger:focus-visible,
.ui-select-trigger[data-state='open'] {
	border-color: var(--ui-accent);
	outline: none;
	box-shadow: var(--ui-ring);
}

.ui-select-chevron {
	width: 15px;
	height: 15px;
	color: var(--ui-fg-subtle);
	transition: transform 0.15s;
}

.ui-select-trigger[data-state='open'] .ui-select-chevron {
	transform: rotate(180deg);
}

.ui-select-content {
	z-index: 100;
	min-width: var(--reka-select-trigger-width);
	max-height: var(--reka-select-content-available-height);
	overflow: hidden;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-lg);
	animation: ui-pop-in 0.14s ease-out;
}

.ui-select-viewport {
	padding: 4px;
}

.ui-select-item {
	position: relative;
	display: flex;
	align-items: center;
	height: 30px;
	padding: 0 30px 0 10px;
	border-radius: var(--ui-radius-xs);
	color: var(--ui-fg);
	font: 400 13px/1 var(--ui-font);
	outline: none;
	cursor: pointer;
	user-select: none;
}

.ui-select-item[data-highlighted] {
	background: var(--ui-accent-soft);
	color: var(--ui-accent-text);
}

.ui-select-item[data-state='checked'] {
	font-weight: 560;
}

.ui-select-indicator {
	position: absolute;
	inset-inline-end: 8px;
	display: inline-flex;
	color: var(--ui-accent-text);
}

.ui-select-indicator svg {
	width: 14px;
	height: 14px;
}
</style>
