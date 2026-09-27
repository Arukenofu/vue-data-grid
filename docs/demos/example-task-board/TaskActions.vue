<script setup lang="ts">
import IconArchive from '~icons/lucide/archive';
import IconArrowRightLeft from '~icons/lucide/arrow-right-left';

import { UiButton, UiTooltip } from '@/ui';

defineProps<{
	task: string;
	target: string;
}>();

const emit = defineEmits<{
	transfer: [];
	archive: [];
}>();
</script>

<template>
	<span class="actions">
		<UiTooltip :text="`Move to ${target}`">
			<UiButton variant="ghost" size="sm" icon :aria-label="`Move ${task} to ${target}`" @click="emit('transfer')">
				<IconArrowRightLeft aria-hidden="true" />
			</UiButton>
		</UiTooltip>
		<UiTooltip text="Archive">
			<UiButton variant="ghost" size="sm" icon :aria-label="`Archive ${task}`" @click="emit('archive')">
				<IconArchive aria-hidden="true" />
			</UiButton>
		</UiTooltip>
	</span>
</template>

<style scoped>
.actions {
	display: inline-flex;
	gap: 2px;
}
</style>
