<script setup lang="ts">
import InlineText from './InlineText.vue';

export interface FlowStep {
	title: string;
	text: string;
}

defineProps<{ steps: readonly FlowStep[] }>();
</script>

<template>
	<ol class="site-flow">
		<li v-for="(step, index) in steps" :key="step.title" class="site-flow-step">
			<span class="site-flow-marker" aria-hidden="true">{{ index + 1 }}</span>
			<span class="site-flow-body">
				<span class="site-flow-title">{{ step.title }}</span>
				<span class="site-flow-text"><InlineText :text="step.text" /></span>
			</span>
		</li>
	</ol>
</template>

<style scoped>
.site-flow {
	margin: 24px 0 32px !important;
	padding: 0 !important;
	list-style: none !important;
}

.site-flow-step {
	position: relative;
	display: flex;
	gap: 16px;
	margin: 0 !important;
	padding-block-end: 20px;
}

.site-flow-step:last-child {
	padding-block-end: 0;
}

/* The line that joins a marker to the next one. */
.site-flow-step:not(:last-child)::before {
	position: absolute;
	inset-block: 32px 4px;
	left: 15px;
	width: 2px;
	border-radius: 2px;
	background: linear-gradient(var(--vp-c-brand-soft), var(--vp-c-divider));
	content: '';
}

.site-flow-marker {
	position: relative;
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 30%, transparent);
	border-radius: 999px;
	background: var(--vp-c-bg);
	box-shadow: 0 0 0 4px var(--vp-c-bg);
	color: var(--vp-c-brand-1);
	font-size: 13px;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
}

.site-flow-body {
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding-block-start: 5px;
}

.site-flow-title {
	color: var(--vp-c-text-1);
	font-size: 15px;
	font-weight: 650;
	line-height: 1.4;
}

.site-flow-text {
	color: var(--vp-c-text-2);
	font-size: 14px;
	line-height: 1.6;
}
</style>
