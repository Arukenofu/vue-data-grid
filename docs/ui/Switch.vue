<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui';
import { useId } from 'vue';

defineProps<{
	/** The label; the default slot instead, for one with markup. */
	label?: string;
}>();

const model = defineModel<boolean>({ default: false });
const id = useId();
</script>

<template>
	<span class="ui-switch">
		<SwitchRoot :id="id" v-model="model" class="ui-switch-root">
			<SwitchThumb class="ui-switch-thumb" />
		</SwitchRoot>
		<label :for="id"><slot>{{ label }}</slot></label>
	</span>
</template>

<style scoped>
.ui-switch {
	display: inline-flex;
	flex: none;
	align-items: center;
	gap: 8px;
	color: var(--ui-fg);
	font: 450 13px/1 var(--ui-font);
}

.ui-switch label {
	cursor: pointer;
	user-select: none;
}

.ui-switch-root {
	position: relative;
	width: 34px;
	height: 20px;
	padding: 0;
	border: none;
	border-radius: 999px;
	background: var(--ui-border-strong);
	cursor: pointer;
	transition: background-color 0.18s;
}

.ui-switch-root[data-state='checked'] {
	background: var(--ui-accent);
}

.ui-switch-root:focus-visible {
	outline: none;
	box-shadow: var(--ui-ring);
}

.ui-switch-thumb {
	display: block;
	width: 16px;
	height: 16px;
	border-radius: 999px;
	background: #fff;
	box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
	transform: translateX(2px);
	transition: transform 0.18s;
}

.ui-switch-thumb[data-state='checked'] {
	transform: translateX(16px);
}
</style>
