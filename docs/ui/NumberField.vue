<!-- A number field on reka-ui with stepper buttons; `label` names it for screen readers. -->
<script setup lang="ts">
import IconMinus from '~icons/lucide/minus';
import IconPlus from '~icons/lucide/plus';
import { NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput, NumberFieldRoot } from 'reka-ui';

defineProps<{
	label: string;
	min?: number;
	max?: number;
	step?: number;
}>();

const model = defineModel<number>({ required: true });
</script>

<template>
	<NumberFieldRoot
		v-model="model"
		:min="min"
		:max="max"
		:step="step"
		:format-options="{ useGrouping: true }"
		locale="en-US"
		class="ui-number"
	>
		<NumberFieldDecrement class="ui-number-step" aria-label="Decrease">
			<IconMinus aria-hidden="true" />
		</NumberFieldDecrement>
		<NumberFieldInput class="ui-number-input" :aria-label="label" />
		<NumberFieldIncrement class="ui-number-step" aria-label="Increase">
			<IconPlus aria-hidden="true" />
		</NumberFieldIncrement>
	</NumberFieldRoot>
</template>

<style scoped>
.ui-number {
	display: inline-flex;
	flex: none;
	align-items: center;
	height: 32px;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius-sm);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-sm);
	transition: border-color 0.15s, box-shadow 0.15s;
}

.ui-number:focus-within {
	border-color: var(--ui-accent);
	box-shadow: var(--ui-ring);
}

.ui-number-input {
	width: 72px;
	height: 100%;
	padding: 0;
	border: none;
	outline: none;
	background: none;
	color: var(--ui-fg);
	font: 450 13px/1 var(--ui-font);
	font-variant-numeric: tabular-nums;
	text-align: center;
}

.ui-number-step {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 100%;
	padding: 0;
	border: none;
	background: none;
	color: var(--ui-fg-subtle);
	cursor: pointer;
}

.ui-number-step:hover:not(:disabled) {
	color: var(--ui-accent-text);
}

.ui-number-step:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.ui-number-step svg {
	width: 14px;
	height: 14px;
}
</style>
