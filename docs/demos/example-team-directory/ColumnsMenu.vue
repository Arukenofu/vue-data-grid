<script setup lang="ts">
import type { AnyColumn, TableScope } from '@vue-stack/table';
import IconColumns from '~icons/lucide/columns-3-cog';
import { computed } from 'vue';

import { type MenuEntry, UiButton, UiMenu } from '@/ui';

const props = defineProps<{ scope: TableScope }>();

const emit = defineEmits<{ reset: [] }>();

function getLabel(column: AnyColumn) {
	return column.label ?? column.name;
}

const entries = computed<readonly MenuEntry[]>(() => {
	const { scope } = props;
	const columns = scope.orderedColumns.value.filter(column => column.kind === 'data');

	return [
		{ type: 'label', key: 'shown', label: 'Shown columns' },
		...columns.map((column): MenuEntry => ({
			type: 'checkbox',
			key: `shown-${column.name}`,
			label: getLabel(column),
			checked: !scope.isColumnHidden(column.name),
			disabled: !column.hideable,
			toggle: () => scope.toggleColumn(column.name),
		})),
		{ type: 'separator', key: 'pinned-line' },
		{ type: 'label', key: 'pinned', label: 'Pinned' },
		...columns.filter(column => column.pinnable).map((column): MenuEntry => ({
			type: 'checkbox',
			key: `pinned-${column.name}`,
			label: `${getLabel(column)} to the ${column.pinned === 'end' ? 'end' : 'start'}`,
			checked: scope.getPin(column.name) !== undefined,
			toggle: checked => scope.pinColumn(column.name, checked ? column.pinned ?? 'start' : null),
		})),
		{ type: 'separator', key: 'actions-line' },
		{ type: 'action', key: 'fit', label: 'Fit columns to the width', select: () => scope.fitColumns() },
		{ type: 'action', key: 'reset', label: 'Reset layout', select: () => emit('reset') },
	];
});
</script>

<template>
	<UiMenu :entries="entries">
		<UiButton>
			<IconColumns aria-hidden="true" />
			Columns
		</UiButton>
	</UiMenu>
</template>
