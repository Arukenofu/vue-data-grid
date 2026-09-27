<script setup lang="ts">
import IconUpgrade from '~icons/lucide/circle-arrow-up';
import IconCopy from '~icons/lucide/copy';
import IconEllipsis from '~icons/lucide/ellipsis';
import IconTrash from '~icons/lucide/trash-2';
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRoot,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from 'reka-ui';
import { shallowRef } from 'vue';

import { type Account, canUpgrade } from './accounts';

defineProps<{ account: Account }>();

const emit = defineEmits<{
	upgrade: [];
	copy: [];
	remove: [];
}>();

const open = shallowRef(false);

function openFromKeyboard(event: MouseEvent) {
	if (event.detail === 0) {
		open.value = true;
	}
}
</script>

<template>
	<DropdownMenuRoot v-model:open="open">
		<DropdownMenuTrigger class="actions-trigger" :aria-label="`Actions for ${account.company}`" @click="openFromKeyboard">
			<IconEllipsis aria-hidden="true" />
		</DropdownMenuTrigger>
		<DropdownMenuPortal>
			<DropdownMenuContent class="ui-menu" align="end" :side-offset="4">
				<DropdownMenuItem class="ui-menu-item" :disabled="!canUpgrade(account)" @select="emit('upgrade')">
					<IconUpgrade class="ui-menu-icon" aria-hidden="true" />
					Upgrade plan
				</DropdownMenuItem>
				<DropdownMenuItem class="ui-menu-item" @select="emit('copy')">
					<IconCopy class="ui-menu-icon" aria-hidden="true" />
					Copy email
				</DropdownMenuItem>
				<DropdownMenuSeparator class="ui-menu-separator" />
				<DropdownMenuItem class="ui-menu-item actions-danger" @select="emit('remove')">
					<IconTrash class="ui-menu-icon" aria-hidden="true" />
					Delete account
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenuPortal>
	</DropdownMenuRoot>
</template>

<style scoped>
.actions-trigger {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	padding: 0;
	border: none;
	border-radius: var(--ui-radius-xs);
	background: none;
	color: var(--ui-fg-subtle);
	cursor: pointer;
}

.actions-trigger:hover,
.actions-trigger[data-state='open'] {
	background: var(--ui-bg-muted);
	color: var(--ui-fg);
}

.actions-trigger:focus-visible {
	outline: none;
	box-shadow: var(--ui-ring);
}

.actions-trigger svg {
	width: 16px;
	height: 16px;
}

.actions-danger[data-highlighted] {
	background: var(--ui-down-soft);
	color: var(--ui-down);
}
</style>
