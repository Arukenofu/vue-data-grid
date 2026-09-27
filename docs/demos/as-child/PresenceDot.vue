<script setup lang="ts">
import { useBodyRowContext } from 'vue-data-grid';
import { computed } from 'vue';

import type { Person } from '@/data/people';

const row = useBodyRowContext<Person>();

const presence = computed(() => row().original.presence);
</script>

<template>
	<span class="presence" :data-presence="presence" :title="presence" aria-hidden="true" />
</template>

<style scoped>
.presence {
	flex: none;
	width: 8px;
	height: 8px;
	margin-inline-end: 8px;
	border-radius: 999px;
	background: var(--ui-fg-subtle);
	box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 0%, transparent);
}

.presence[data-presence='active'] {
	background: var(--ui-up);
}

.presence[data-presence='away'] {
	background: var(--ui-warn);
}
</style>
