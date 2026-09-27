<script setup lang="ts">
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import { computed, shallowRef } from 'vue';

import CopyButton from './CopyButton.vue';

const props = withDefaults(defineProps<{
	/** The packages to add, separated by spaces. */
	packages?: string;
}>(), { packages: 'vue-data-grid' });

const managers = computed(() => [
	{ name: 'pnpm', command: `pnpm add ${props.packages}` },
	{ name: 'npm', command: `npm install ${props.packages}` },
	{ name: 'yarn', command: `yarn add ${props.packages}` },
	{ name: 'bun', command: `bun add ${props.packages}` },
]);

const manager = shallowRef('pnpm');
</script>

<template>
	<TabsRoot v-model="manager" class="site-install">
		<TabsList class="site-install-tabs" aria-label="Package manager">
			<TabsIndicator class="site-install-indicator" />
			<TabsTrigger v-for="item in managers" :key="item.name" :value="item.name" class="site-install-tab">
				{{ item.name }}
			</TabsTrigger>
		</TabsList>
		<TabsContent v-for="item in managers" :key="item.name" :value="item.name" class="site-install-command">
			<code><span class="site-install-prompt" aria-hidden="true">$</span>{{ item.command }}</code>
			<CopyButton :text="item.command" />
		</TabsContent>
	</TabsRoot>
</template>

<style scoped>
.site-install {
	margin-block: 16px 24px;
	overflow: hidden;
	border: 1px solid var(--site-code-border);
	border-radius: 12px;
	background: var(--site-code);
}

.site-install-tabs {
	position: relative;
	display: flex;
	border-block-end: 1px solid var(--site-code-border);
}

.site-install-tab {
	padding: 9px 16px;
	color: var(--site-code-tab);
	font-size: 13px;
	font-weight: 500;
	transition: color 0.2s;
}

.site-install-tab:hover,
.site-install-tab[data-state='active'] {
	color: #fafaf9;
}

.site-install-indicator {
	position: absolute;
	inset-block-end: -1px;
	left: 0;
	width: var(--reka-tabs-indicator-size);
	height: 2px;
	border-radius: 2px;
	background: #34d399;
	translate: var(--reka-tabs-indicator-position) 0;
	transition: width 0.25s, translate 0.25s;
}

.site-install-command {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 14px 12px 14px 20px;
}

.site-install-command code {
	padding: 0 !important;
	background: none !important;
	color: #e7e5e4;
	font-size: 14px !important;
}

.site-install-prompt {
	margin-inline-end: 10px;
	color: #34d399;
	user-select: none;
}
</style>
