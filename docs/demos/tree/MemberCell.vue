<script setup lang="ts">
import { UiAvatar } from '@/ui';

defineProps<{
	name: string;
}>();
</script>

<template>
	<span class="member">
		<UiAvatar :name="name" />
		{{ name }}
	</span>
</template>

<style scoped>
.member {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	font-weight: 550;
}
</style>
