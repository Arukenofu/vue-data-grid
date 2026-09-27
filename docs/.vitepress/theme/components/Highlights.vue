<script setup lang="ts">
import IconCheck from '~icons/radix-icons/check';

import InlineText from './InlineText.vue';

defineProps<{ features: readonly string[] }>();
</script>

<template>
	<ul class="site-highlights">
		<li v-for="feature in features" :key="feature">
			<span class="site-highlights-mark" aria-hidden="true"><IconCheck /></span>
			<span><InlineText :text="feature" /></span>
		</li>
	</ul>
</template>

<style scoped>
.site-highlights {
	display: grid;
	gap: 10px;
	margin-block: 16px 24px !important;
	padding: 0 !important;
	list-style: none !important;
}

.site-highlights li {
	display: flex;
	align-items: flex-start;
	gap: 14px;
	margin: 0 !important;
	line-height: 1.6 !important;
}

.site-highlights-mark {
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	margin-block-start: 1px;
	border: 1px solid var(--vp-c-brand-soft);
	border-radius: 999px;
	background: var(--vp-c-brand-soft);
	color: var(--vp-c-brand-1);
	font-size: 15px;
}
</style>
