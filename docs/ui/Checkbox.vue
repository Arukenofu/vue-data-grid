<!-- A checkbox on reka-ui with its label in the default slot. -->
<script setup lang="ts">
import IconCheck from '~icons/lucide/check';
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui';
import { useId } from 'vue';

defineProps<{
	disabled?: boolean;
}>();

const model = defineModel<boolean>({ default: false });
const id = useId();
</script>

<template>
	<span class="ui-checkbox" :data-disabled="disabled || undefined">
		<CheckboxRoot :id="id" v-model="model" :disabled="disabled" class="ui-checkbox-root">
			<CheckboxIndicator class="ui-checkbox-indicator">
				<IconCheck aria-hidden="true" />
			</CheckboxIndicator>
		</CheckboxRoot>
		<label :for="id"><slot /></label>
	</span>
</template>

<style scoped>
.ui-checkbox {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	color: var(--ui-fg);
	font: 450 13px/1.3 var(--ui-font);
}

.ui-checkbox label {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: pointer;
	user-select: none;
}

.ui-checkbox[data-disabled] {
	opacity: 0.5;
}

.ui-checkbox-root {
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 16px;
	height: 16px;
	padding: 0;
	border: 1.5px solid var(--ui-border-strong);
	border-radius: 4px;
	background: var(--ui-bg);
	cursor: pointer;
	transition: background-color 0.12s, border-color 0.12s;
}

.ui-checkbox-root[data-state='checked'] {
	border-color: var(--ui-accent);
	background: var(--ui-accent);
	color: var(--ui-accent-fg);
}

.ui-checkbox-root:focus-visible {
	outline: none;
	box-shadow: var(--ui-ring);
}

.ui-checkbox-indicator svg {
	display: block;
	width: 11px;
	height: 11px;
}
</style>
