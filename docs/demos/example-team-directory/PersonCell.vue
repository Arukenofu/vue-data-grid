<script setup lang="ts">
import type { Person } from '@/data/people';
import { UiAvatar } from '@/ui';

defineProps<{ person: Person }>();
</script>

<template>
	<span class="person">
		<UiAvatar :name="person.name" />
		<span class="person-text">
			<span class="person-name">{{ person.name }}</span>
			<span class="person-email">{{ person.email }}</span>
		</span>
	</span>
</template>

<style scoped>
.person {
	display: flex;
	flex: 1;
	align-items: center;
	gap: 10px;
	min-width: 0;
	contain: inline-size;
}

.person-text {
	display: grid;
	min-width: 0;
	line-height: 1.3;
}

.person-name {
	overflow: hidden;
	font-weight: 560;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.person-email {
	overflow: hidden;
	color: var(--ui-fg-subtle);
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
