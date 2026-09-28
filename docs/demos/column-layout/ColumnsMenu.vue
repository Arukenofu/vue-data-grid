<script setup lang="ts">
import type { AnyColumn, GridScope } from '@vue-data-grid/core';
import IconColumns from '~icons/lucide/columns-3';
import { computed } from 'vue';

import { type MenuEntry, UiButton, UiMenu } from '@/ui';

const props = defineProps<{ scope: GridScope }>();

function getLabel(column: AnyColumn) {
	return column.label ?? column.name;
}

function toShownEntry(column: AnyColumn): MenuEntry {
	return {
		type: 'checkbox',
		key: `shown-${column.name}`,
		label: getLabel(column),
		checked: !props.scope.isColumnHidden(column.name),
		disabled: !column.hideable,
		toggle: () => props.scope.toggleColumn(column.name),
	};
}

function toPinnedEntry(column: AnyColumn): MenuEntry {
	return {
		type: 'checkbox',
		key: `pinned-${column.name}`,
		label: getLabel(column),
		checked: props.scope.getPin(column.name) === 'start',
		toggle: checked => props.scope.pinColumn(column.name, checked ? 'start' : null),
	};
}

const entries = computed<readonly MenuEntry[]>(() => {
	const columns = props.scope.orderedColumns.value;

	return [
		{ type: 'label', key: 'shown', label: 'Shown' },
		...columns.map(toShownEntry),
		{ type: 'separator', key: 'separator' },
		{ type: 'label', key: 'pinned', label: 'Pinned to the start' },
		...columns.filter(column => column.pinnable).map(toPinnedEntry),
	];
});
</script>

<template>
	<UiMenu :entries="entries" align="start">
		<UiButton>
			<IconColumns aria-hidden="true" />
			Columns
		</UiButton>
	</UiMenu>
</template>
