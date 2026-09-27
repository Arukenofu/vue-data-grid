<script setup lang="ts">
import IconFileText from '~icons/lucide/file-text';
import IconRocket from '~icons/lucide/rocket';
import IconUndo from '~icons/lucide/undo-2';
import { ToolbarButton, ToolbarRoot } from 'reka-ui';

import { UiButton } from '@/ui';

import type { Release } from './data';

defineProps<{ release: Release }>();

const emit = defineEmits<{ action: [name: string] }>();
</script>

<template>
	<ToolbarRoot class="release-actions" :aria-label="`Actions for ${release.version}`">
		<ToolbarButton as-child>
			<UiButton size="sm" @click="emit('action', 'Deployed')">
				<IconRocket aria-hidden="true" />
				Deploy
			</UiButton>
		</ToolbarButton>
		<ToolbarButton as-child>
			<UiButton size="sm" variant="ghost" icon :aria-label="`Revert ${release.version}`" @click="emit('action', 'Reverted')">
				<IconUndo aria-hidden="true" />
			</UiButton>
		</ToolbarButton>
		<ToolbarButton as-child>
			<UiButton size="sm" variant="ghost" icon :aria-label="`Logs of ${release.version}`" @click="emit('action', 'Opened the logs of')">
				<IconFileText aria-hidden="true" />
			</UiButton>
		</ToolbarButton>
	</ToolbarRoot>
</template>

<style scoped>
.release-actions {
	display: flex;
	align-items: center;
	gap: 4px;
}
</style>
