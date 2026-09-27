<script setup lang="ts">
import IconSearch from '~icons/lucide/search';
import { type Component, computed } from 'vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
	/** The name of the field for screen readers, when no visible label names it. */
	label?: string;
	placeholder?: string;
	/** A search field: a magnifier in front, and the type of a search. */
	search?: boolean;
	/** An icon of your own in front of the text. */
	icon?: Component;
}>(), { label: undefined, placeholder: undefined, search: false, icon: undefined });

const model = defineModel<string>({ default: '' });

const shownIcon = computed(() => props.icon ?? (props.search ? IconSearch : undefined));
</script>

<template>
	<label class="ui-input" :data-with-icon="shownIcon ? '' : undefined">
		<component :is="shownIcon" v-if="shownIcon" class="ui-input-icon" aria-hidden="true" />
		<input v-model="model" :type="search ? 'search' : 'text'" :aria-label="label" :placeholder="placeholder" v-bind="$attrs">
	</label>
</template>

<style scoped>
.ui-input {
	position: relative;
	display: inline-flex;
	align-items: center;
	min-width: 0;
	height: 32px;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius-sm);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-sm);
	transition: border-color 0.15s, box-shadow 0.15s;
}

.ui-input:hover {
	border-color: var(--ui-border-strong);
}

.ui-input:focus-within {
	border-color: var(--ui-accent);
	box-shadow: var(--ui-ring);
}

.ui-input input {
	width: 220px;
	max-width: 100%;
	min-width: 0;
	height: 100%;
	padding: 0 10px;
	border: none;
	outline: none;
	background: none;
	color: var(--ui-fg);
	font: 400 13px/1 var(--ui-font);
}

.ui-input input::placeholder {
	color: var(--ui-fg-subtle);
}

.ui-input[data-with-icon] input {
	padding-inline-start: 32px;
}

.ui-input-icon {
	position: absolute;
	inset-inline-start: 10px;
	width: 15px;
	height: 15px;
	color: var(--ui-fg-subtle);
	pointer-events: none;
}
</style>
