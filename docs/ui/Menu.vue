<script setup lang="ts">
import IconCheck from '~icons/lucide/check';
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

/** An entry of the menu: an action, a checkbox, a heading or a line between groups. */
export type MenuEntry =
	| { type: 'action'; key: string; label: string; disabled?: boolean; select: () => void }
	| { type: 'checkbox'; key: string; label: string; checked: boolean; disabled?: boolean; toggle: (checked: boolean) => void }
	| { type: 'label'; key: string; label: string }
	| { type: 'separator'; key: string };

defineProps<{
	entries: readonly MenuEntry[];
	/** Where the menu opens along the trigger. */
	align?: 'start' | 'end';
}>();

defineSlots<{ default: () => unknown }>();

// A checkbox item closes the menu by default; it stays open so several columns can be toggled.
function keepOpen(event: Event) {
	event.preventDefault();
}
</script>

<template>
	<DropdownMenuRoot>
		<DropdownMenuTrigger as-child>
			<slot />
		</DropdownMenuTrigger>
		<DropdownMenuPortal>
			<DropdownMenuContent class="ui-menu" :align="align ?? 'end'" :side-offset="6">
				<template v-for="entry in entries" :key="entry.key">
					<DropdownMenuSeparator v-if="entry.type === 'separator'" class="ui-menu-separator" />
					<DropdownMenuLabel v-else-if="entry.type === 'label'" class="ui-menu-label">{{ entry.label }}</DropdownMenuLabel>
					<DropdownMenuCheckboxItem
						v-else-if="entry.type === 'checkbox'"
						class="ui-menu-item"
						:model-value="entry.checked"
						:disabled="entry.disabled"
						@update:model-value="value => entry.toggle(value === true)"
						@select="keepOpen"
					>
						<DropdownMenuItemIndicator class="ui-menu-indicator">
							<IconCheck />
						</DropdownMenuItemIndicator>
						{{ entry.label }}
					</DropdownMenuCheckboxItem>
					<DropdownMenuItem v-else class="ui-menu-item" :disabled="entry.disabled" @select="entry.select">
						{{ entry.label }}
					</DropdownMenuItem>
				</template>
			</DropdownMenuContent>
		</DropdownMenuPortal>
	</DropdownMenuRoot>
</template>

<style>
.ui-menu {
	z-index: 100;
	min-width: 200px;
	max-height: min(360px, var(--reka-dropdown-menu-content-available-height));
	overflow: auto;
	padding: 4px;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
	background: var(--ui-bg);
	box-shadow: var(--ui-shadow-lg);
	animation: ui-pop-in 0.14s ease-out;
}

.ui-menu-label {
	padding: 6px 8px 4px 30px;
	color: var(--ui-fg-subtle);
	font: 600 11px/1.4 var(--ui-font);
	letter-spacing: 0.06em;
	text-transform: uppercase;
}

.ui-menu-item {
	position: relative;
	display: flex;
	align-items: center;
	gap: 8px;
	height: 30px;
	padding: 0 10px 0 30px;
	border-radius: var(--ui-radius-xs);
	color: var(--ui-fg);
	font: 400 13px/1 var(--ui-font);
	outline: none;
	cursor: pointer;
	user-select: none;
}

.ui-menu-item[data-highlighted] {
	background: var(--ui-accent-soft);
	color: var(--ui-accent-text);
}

.ui-menu-item[data-disabled] {
	color: var(--ui-fg-subtle);
	cursor: default;
}

.ui-menu-indicator {
	position: absolute;
	inset-inline-start: 9px;
	display: inline-flex;
	color: var(--ui-accent-text);
}

.ui-menu-indicator svg,
.ui-menu-icon {
	width: 14px;
	height: 14px;
}

.ui-menu-icon {
	position: absolute;
	inset-inline-start: 9px;
}

.ui-menu-separator {
	height: 1px;
	margin: 4px;
	background: var(--ui-border);
}
</style>
