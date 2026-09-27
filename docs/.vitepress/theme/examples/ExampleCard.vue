<script setup lang="ts">
import IconArrowUpRight from '~icons/lucide/arrow-up-right';

import type { Example } from './examples';

defineProps<{ example: Example }>();

const BARS = [72, 48, 86, 60];
</script>

<template>
	<a :href="example.link" class="example-card">
		<span class="example-thumb" :style="{ '--from': example.colors[0], '--to': example.colors[1] }" aria-hidden="true">
			<span class="example-sheet">
				<span class="example-sheet-head" />
				<span v-for="(width, index) in BARS" :key="index" class="example-sheet-row">
					<span class="example-sheet-dot" />
					<span class="example-sheet-bar" :style="{ width: `${width}%` }" />
				</span>
			</span>
			<span class="example-icon">
				<component :is="example.icon" />
			</span>
		</span>
		<span class="example-body">
			<span class="example-title">
				{{ example.title }}
				<IconArrowUpRight class="example-arrow" aria-hidden="true" />
			</span>
			<span class="example-text">{{ example.text }}</span>
			<span class="example-tags">
				<span v-for="tag in example.tags" :key="tag" class="example-tag">{{ tag }}</span>
			</span>
		</span>
	</a>
</template>

<style scoped>
.example-card {
	display: flex;
	text-align: start;
	flex-direction: column;
	overflow: hidden;
	border: 1px solid var(--vp-c-divider);
	border-radius: 16px;
	background: var(--vp-c-bg-alt);
	color: inherit !important;
	text-decoration: none !important;
	transition: border-color 0.2s, box-shadow 0.2s, translate 0.2s;
}

.example-card:hover {
	border-color: color-mix(in srgb, var(--vp-c-brand-1) 40%, transparent);
	box-shadow: var(--site-shadow);
	translate: 0 -2px;
}

.example-thumb {
	position: relative;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	height: 150px;
	padding-inline: 28px;
	overflow: hidden;
	background:
		radial-gradient(circle at 1px 1px, rgb(255 255 255 / 22%) 1px, transparent 0) 0 0 / 14px 14px,
		linear-gradient(135deg, var(--from), var(--to));
}

.example-sheet {
	display: flex;
	flex-direction: column;
	gap: 9px;
	width: 100%;
	max-width: 260px;
	padding: 14px 14px 20px;
	border-radius: 12px 12px 0 0;
	background: rgb(255 255 255 / 92%);
	box-shadow: 0 -8px 30px rgb(0 0 0 / 18%);
	translate: 0 8px;
	transition: translate 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.example-card:hover .example-sheet {
	translate: 0 2px;
}

.example-sheet-head {
	height: 8px;
	width: 40%;
	border-radius: 4px;
	background: color-mix(in srgb, var(--from) 45%, #d6d3d1);
}

.example-sheet-row {
	display: flex;
	align-items: center;
	gap: 8px;
}

.example-sheet-dot {
	width: 10px;
	height: 10px;
	border-radius: 999px;
	background: color-mix(in srgb, var(--to) 55%, #fff);
}

.example-sheet-bar {
	height: 6px;
	border-radius: 3px;
	background: #e7e5e4;
}

.example-icon {
	position: absolute;
	top: 14px;
	right: 14px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 38px;
	height: 38px;
	border: 1px solid rgb(255 255 255 / 35%);
	border-radius: 12px;
	background: rgb(255 255 255 / 18%);
	color: #fff;
	font-size: 19px;
	-webkit-backdrop-filter: blur(6px);
	backdrop-filter: blur(6px);
}

.example-body {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 18px 20px 20px;
}

.example-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 16px;
	font-weight: 700;
}

.example-arrow {
	color: var(--vp-c-text-3);
	transition: color 0.2s, translate 0.2s;
}

.example-card:hover .example-arrow {
	color: var(--vp-c-brand-1);
	translate: 2px -2px;
}

.example-text {
	color: var(--vp-c-text-2);
	font-size: 14px;
	line-height: 1.6;
}

.example-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-block-start: 4px;
}

.example-tag {
	padding: 2px 8px;
	border-radius: 999px;
	background: var(--vp-c-bg-soft);
	color: var(--vp-c-text-2);
	font-size: 12px;
	font-weight: 500;
}
</style>
