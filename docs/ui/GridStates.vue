<!--
	The empty and loading states of a kit grid, with an icon and a spinner. They read the strings of
	the interface from the grid's `messages`, so they sit inside `GridRoot`.
-->
<script setup lang="ts">
import { GridEmpty, GridLoading, useGridMessagesContext } from '@vue-data-grid/core';
import IconLoaderCircle from '~icons/lucide/loader-circle';
import IconSearchX from '~icons/lucide/search-x';

defineProps<{
	loading?: boolean;
}>();

const messages = useGridMessagesContext();
</script>

<template>
	<GridEmpty>
		<span class="ui-grid-state">
			<IconSearchX aria-hidden="true" />
			{{ messages.empty }}
		</span>
	</GridEmpty>
	<GridLoading v-if="loading">
		<IconLoaderCircle class="ui-grid-spinner" aria-hidden="true" />
		{{ messages.loading }}
	</GridLoading>
</template>

<style scoped>
.ui-grid-state {
	display: inline-flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
}

.ui-grid-state svg {
	width: 28px;
	height: 28px;
	color: var(--ui-fg-subtle);
}

.ui-grid-spinner {
	width: 14px;
	height: 14px;
	color: var(--ui-accent);
	animation: ui-spin 0.8s linear infinite;
}

@keyframes ui-spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
