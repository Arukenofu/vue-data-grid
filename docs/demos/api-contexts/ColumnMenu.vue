<script setup lang="ts">
import { type SortDirection, useDataTableContext, useHeaderCellContext } from '@vue-stack/table';
import IconMore from '~icons/lucide/ellipsis-vertical';
import { computed } from 'vue';

import { type MenuEntry, UiButton, UiMenu } from '@/ui';

const table = useDataTableContext();
const cell = useHeaderCellContext();

function sortBy(name: string, direction: SortDirection | null) {
	table.state.sort.value = direction ? [{ name, direction }] : [];
}

const entries = computed<MenuEntry[]>(() => {
	const { column } = cell();

	if (!column) {
		return [];
	}

	const { name } = column;
	const pin = table.scope.getPin(name);
	const direction = table.scope.getSortDirection(name);
	const items: MenuEntry[] = [];

	if (column.sortable) {
		items.push(
			{ type: 'label', key: 'sort', label: 'Sort' },
			{ type: 'checkbox', key: 'asc', label: 'Ascending', checked: direction === 'asc', toggle: on => sortBy(name, on ? 'asc' : null) },
			{ type: 'checkbox', key: 'desc', label: 'Descending', checked: direction === 'desc', toggle: on => sortBy(name, on ? 'desc' : null) },
		);
	}

	if (column.pinnable) {
		items.push(
			{ type: 'separator', key: 'pin-line' },
			{ type: 'checkbox', key: 'pin', label: 'Pin to the start', checked: pin === 'start', toggle: on => table.scope.pinColumn(name, on ? 'start' : null) },
		);
	}

	if (column.hideable) {
		items.push({ type: 'action', key: 'hide', label: 'Hide column', select: () => table.scope.toggleColumn(name) });
	}

	return items;
});

const label = computed(() => `Options of ${cell().column?.label ?? ''}`);
</script>

<template>
	<UiMenu v-if="entries.length > 0" :entries="entries">
		<UiButton variant="ghost" size="sm" icon class="column-menu" :aria-label="label">
			<IconMore aria-hidden="true" />
		</UiButton>
	</UiMenu>
</template>

<style scoped>
.column-menu {
	margin-inline-start: auto;
}
</style>
