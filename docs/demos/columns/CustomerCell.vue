<script setup lang="ts">
import { UiAvatar } from '@/ui';

defineProps<{
	name: string;
	email: string;
}>();
</script>

<template>
	<span class="customer">
		<UiAvatar :name="name" />
		<span class="customer-text">
			<span class="customer-name">{{ name }}</span>
			<span class="customer-email">{{ email }}</span>
		</span>
	</span>
</template>

<style scoped>
.customer {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.customer-text {
	display: grid;
	min-width: 0;
	line-height: 1.3;
}

.customer-name {
	overflow: hidden;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.customer-email {
	overflow: hidden;
	color: var(--ui-fg-muted);
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
