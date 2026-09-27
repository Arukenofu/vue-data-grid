<!--
	The empty and loading states of a kit table, with an icon and a spinner. They read the strings of
	the interface from the table's `messages`, so they sit inside `TableRoot`.
-->
<script setup lang="ts">
import { TableEmpty, TableLoading, useTableMessagesContext } from 'vue-data-grid';
import IconLoaderCircle from '~icons/lucide/loader-circle';
import IconSearchX from '~icons/lucide/search-x';

defineProps<{
	loading?: boolean;
}>();

const messages = useTableMessagesContext();
</script>

<template>
	<TableEmpty>
		<span class="ui-table-state">
			<IconSearchX aria-hidden="true" />
			{{ messages.empty }}
		</span>
	</TableEmpty>
	<TableLoading v-if="loading">
		<IconLoaderCircle class="ui-table-spinner" aria-hidden="true" />
		{{ messages.loading }}
	</TableLoading>
</template>

<style scoped>
.ui-table-state {
	display: inline-flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
}

.ui-table-state svg {
	width: 28px;
	height: 28px;
	color: var(--ui-fg-subtle);
}

.ui-table-spinner {
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
