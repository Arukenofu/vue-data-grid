<script setup lang="ts">
import { type SortDirection, useDataGridContext, useHeaderCellContext } from '@vue-data-grid/core';
import IconMore from '~icons/lucide/ellipsis-vertical';
import { computed } from 'vue';

import { type MenuEntry, UiButton, UiMenu } from '@/ui';

const grid = useDataGridContext();
const cell = useHeaderCellContext();

function sortBy(name: string, direction: SortDirection | null) {
	grid.state.sort.value = direction ? [{ name, direction }] : [];
}

const entries = computed<MenuEntry[]>(() => {
	const { column } = cell();

	if (!column) {
		return [];
	}

	const { name } = column;
	const pin = grid.scope.getPin(name);
	const direction = grid.scope.getSortDirection(name);
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
			{ type: 'checkbox', key: 'pin', label: 'Pin to the start', checked: pin === 'start', toggle: on => grid.scope.pinColumn(name, on ? 'start' : null) },
		);
	}

	if (column.hideable) {
		items.push({ type: 'action', key: 'hide', label: 'Hide column', select: () => grid.scope.toggleColumn(name) });
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
