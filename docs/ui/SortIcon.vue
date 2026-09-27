<!-- The sort state of a column as an icon, and its place in a multi-sort. -->
<script setup lang="ts">
import type { SortDirection } from 'vue-data-grid';
import IconArrowDown from '~icons/lucide/arrow-down';
import IconArrowUp from '~icons/lucide/arrow-up';
import IconChevronsUpDown from '~icons/lucide/chevrons-up-down';

defineProps<{
	direction: SortDirection | undefined;
	sortIndex?: number;
}>();
</script>

<template>
	<IconArrowUp v-if="direction === 'asc'" />
	<IconArrowDown v-else-if="direction === 'desc'" />
	<IconChevronsUpDown v-else class="is-idle" />
	<span v-if="direction && sortIndex !== undefined">{{ sortIndex }}</span>
</template>
