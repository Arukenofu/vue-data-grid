<!--
	A menu that shows and hides columns, on reka-ui's dropdown menu. It works through the scope, so it
	fits a table of parts (`table.scope`) and one of hand-written markup alike. Columns that are not
	`hideable` are listed but locked; service columns, such as a checkbox or row actions, are not listed.
-->
<script setup lang="ts">
import type { TableScope } from '@vue-stack/table';
import IconCheck from '~icons/lucide/check';
import IconColumns from '~icons/lucide/columns-3';
import IconRotateCcw from '~icons/lucide/rotate-ccw';
import {
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuItemIndicator,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRoot,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from 'reka-ui';

import Button from './Button.vue';

defineProps<{
	scope: TableScope;
}>();

const emit = defineEmits<{
	/** The reset item was chosen: give the columns their declared layout. */
	reset: [];
}>();
</script>

<template>
	<DropdownMenuRoot>
		<DropdownMenuTrigger as-child>
			<Button>
				<IconColumns aria-hidden="true" />
				Columns
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuPortal>
			<DropdownMenuContent class="ui-menu" align="end" :side-offset="6">
				<DropdownMenuLabel class="ui-menu-label">Shown columns</DropdownMenuLabel>
				<DropdownMenuCheckboxItem
					v-for="column in scope.orderedColumns.value.filter(item => item.kind !== 'service')"
					:key="column.name"
					class="ui-menu-item"
					:model-value="!scope.isColumnHidden(column.name)"
					:disabled="!column.hideable"
					@update:model-value="scope.toggleColumn(column.name)"
					@select.prevent
				>
					<DropdownMenuItemIndicator class="ui-menu-indicator">
						<IconCheck aria-hidden="true" />
					</DropdownMenuItemIndicator>
					{{ column.label ?? column.name }}
				</DropdownMenuCheckboxItem>
				<DropdownMenuSeparator class="ui-menu-separator" />
				<DropdownMenuItem class="ui-menu-item" @select="emit('reset')">
					<IconRotateCcw class="ui-menu-icon" aria-hidden="true" />
					Reset layout
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenuPortal>
	</DropdownMenuRoot>
</template>
