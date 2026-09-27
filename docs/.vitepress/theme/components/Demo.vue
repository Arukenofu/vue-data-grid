<script setup lang="ts">
import { Label, SwitchRoot, SwitchThumb, TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import { shallowRef, useId } from 'vue';

const props = defineProps<{
	/** The folder of the demo in `docs/demos`. */
	name: string;
	/** Its files, `index.vue` first; the demo plugin passes them. */
	files: readonly string[];
}>();

defineSlots<{
	preview: () => unknown;
	[file: `file-${number}`]: () => unknown;
}>();

const id = useId();
const showCode = shallowRef(false);
const file = shallowRef(props.files[0] ?? '');
</script>

<template>
	<div class="site-demo" :data-demo="name" :data-view="showCode ? 'code' : 'preview'">
		<div class="site-demo-bar">
			<Label :for="id" class="site-demo-label">View code</Label>
			<SwitchRoot :id="id" v-model="showCode" class="site-switch">
				<SwitchThumb class="site-switch-thumb" />
			</SwitchRoot>
		</div>

		<div class="site-demo-stage">
			<div class="site-demo-preview site-demo-surface vp-raw" :inert="showCode || undefined" :aria-hidden="showCode || undefined">
				<slot name="preview" />
			</div>

			<TabsRoot v-model="file" class="site-demo-code" :unmount-on-hide="false" :inert="!showCode || undefined" :aria-hidden="!showCode || undefined">
				<TabsList class="site-demo-tabs" aria-label="Files of the demo">
					<TabsIndicator class="site-demo-tab-indicator" />
					<TabsTrigger v-for="item in files" :key="item" :value="item" class="site-demo-tab">
						{{ item }}
					</TabsTrigger>
				</TabsList>
				<TabsContent v-for="(item, index) in files" :key="item" :value="item" class="site-demo-file">
					<slot :name="`file-${index}`" />
				</TabsContent>
			</TabsRoot>
		</div>
	</div>
</template>

<style scoped>
.site-demo {
	margin-block: 24px 32px;
}

.site-demo-bar {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 10px;
	margin-block-end: 12px;
}

.site-demo-label {
	color: var(--vp-c-text-1);
	font-size: 14px;
	font-weight: 500;
	cursor: pointer;
}

/* The preview sets the height of the stage, and the code takes the same box: switching moves nothing. */
.site-demo-stage {
	position: relative;
	display: grid;
}

.site-demo-preview {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 360px;
	padding: 28px 24px;
	border: 1px solid var(--vp-c-divider);
	border-radius: 16px;
	background:
		radial-gradient(55% 75% at 100% 0%, rgb(20 184 166 / 12%), transparent 65%),
		radial-gradient(50% 70% at 0% 100%, rgb(34 197 94 / 11%), transparent 65%),
		radial-gradient(circle at 1px 1px, rgb(120 113 108 / 16%) 1px, transparent 0) 0 0 / 18px 18px,
		var(--vp-c-bg-alt);
	overflow: hidden;
	transition: opacity 0.2s, visibility 0.2s;
}

.site-demo-preview > :deep(*) {
	width: 100%;
	min-width: 0;
}

.site-demo-code {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	border: 1px solid var(--site-code-border);
	border-radius: 16px;
	background: var(--site-code);
	transition: opacity 0.2s, visibility 0.2s;
}

.site-demo[data-view='preview'] .site-demo-code,
.site-demo[data-view='code'] .site-demo-preview {
	visibility: hidden;
	opacity: 0;
}

.site-demo-tabs {
	position: relative;
	display: flex;
	flex: none;
	overflow-x: auto;
	border-block-end: 1px solid var(--site-code-border);
	scrollbar-width: none;
}

.site-demo-tab {
	flex: none;
	padding: 11px 16px;
	color: var(--site-code-tab);
	font-family: var(--vp-font-family-mono);
	font-size: 13px;
	transition: color 0.2s;
}

.site-demo-tab:hover,
.site-demo-tab[data-state='active'] {
	color: #fafaf9;
}

.site-demo-tab-indicator {
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

.site-demo-file {
	flex: 1;
	min-height: 0;
	overflow: auto;
	scrollbar-color: #57534e transparent;
	scrollbar-gutter: stable;
	scrollbar-width: thin;
}

.site-demo-file :deep(div[class*='language-']) {
	margin: 0;
	border: none;
	border-radius: 0;
}

.site-demo-file :deep(div[class*='language-'] > span.lang) {
	display: none;
}

@media (prefers-reduced-motion: reduce) {
	.site-demo-preview,
	.site-demo-code {
		transition: none;
	}
}

@media (max-width: 639px) {
	.site-demo-preview {
		padding: 20px 12px;
		border-radius: 12px;
	}

	.site-demo-code {
		border-radius: 12px;
	}
}
</style>
