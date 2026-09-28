<script setup lang="ts">
import IconArrowRight from '~icons/lucide/arrow-right';

import CopyButton from '../components/CopyButton.vue';

const INSTALL = 'pnpm add @vue-data-grid/core';
</script>

<template>
	<section class="home-hero">
		<div class="home-hero-glow" aria-hidden="true">
			<span class="home-hero-blob" data-blob />
			<span class="home-hero-blob" data-blob />
		</div>

		<a href="/overview/introduction" class="home-pill" data-reveal>
			<span class="home-pill-dot" aria-hidden="true" />
			Headless grids for Vue 3
			<IconArrowRight aria-hidden="true" />
		</a>

		<h1 class="home-title">
			<span class="home-title-line" data-reveal>Accessible Vue grids,</span>
			<span class="home-title-line home-title-accent" data-reveal>assembled from parts.</span>
		</h1>

		<p class="home-lead" data-reveal>
			Unstyled building blocks for data grids: sorting, selection, trees, virtualization, editing,
			drag and drop and motion. Each is one line to add, and yours to restyle or replace.
		</p>

		<div class="home-actions" data-reveal>
			<a href="/overview/getting-started" class="home-button" data-variant="primary">
				Get started
				<IconArrowRight aria-hidden="true" />
			</a>
			<a href="/examples/" class="home-button">Browse examples</a>
		</div>

		<div class="home-install" data-reveal>
			<code><span class="home-install-prompt" aria-hidden="true">$</span>{{ INSTALL }}</code>
			<CopyButton :text="INSTALL" />
		</div>
	</section>
</template>

<style scoped>
.home-hero {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 72px 24px 56px;
	text-align: center;
}

.home-hero-glow {
	position: absolute;
	inset: -120px 0 0;
	z-index: -1;
	overflow: hidden;
	pointer-events: none;
}

.home-hero-blob {
	position: absolute;
	top: 0;
	left: 50%;
	width: 520px;
	height: 420px;
	border-radius: 999px;
	background: radial-gradient(closest-side, rgb(16 185 129 / 28%), transparent);
	filter: blur(20px);
	translate: -85% 0;
}

.home-hero-blob + .home-hero-blob {
	background: radial-gradient(closest-side, rgb(20 184 166 / 22%), transparent);
	translate: -10% 40px;
}

.home-pill {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 6px 12px 6px 10px;
	border: 1px solid var(--vp-c-divider);
	border-radius: 999px;
	background: var(--vp-c-bg-alt);
	color: var(--vp-c-text-1);
	font-size: 13px;
	font-weight: 550;
	transition: border-color 0.2s, background-color 0.2s;
}

.home-pill:hover {
	border-color: var(--vp-c-brand-1);
}

.home-pill svg {
	color: var(--vp-c-text-2);
}

.home-pill-dot {
	width: 8px;
	height: 8px;
	border-radius: 999px;
	background: var(--vp-c-brand-1);
	box-shadow: 0 0 0 4px var(--vp-c-brand-soft);
}

.home-title {
	display: flex;
	flex-direction: column;
	margin-block: 28px 0;
	font-size: clamp(2.5rem, 6vw, 4.5rem);
	font-weight: 800;
	line-height: 1.05;
	letter-spacing: -0.04em;
}

.home-title-accent {
	padding-block-end: 0.08em;
	background: linear-gradient(95deg, #12a594 10%, #30a46c 55%, #86efac);
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
}

.home-lead {
	max-width: 640px;
	margin-block: 24px 0;
	color: var(--vp-c-text-2);
	font-size: 1.15rem;
	line-height: 1.7;
}

.home-actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 12px;
	margin-block-start: 36px;
}

.home-button {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	height: 44px;
	padding-inline: 20px;
	border: 1px solid var(--vp-c-divider);
	border-radius: 12px;
	background: var(--vp-c-bg);
	color: var(--vp-c-text-1);
	font-size: 15px;
	font-weight: 600;
	transition: background-color 0.2s, border-color 0.2s, translate 0.2s;
}

.home-button:hover {
	border-color: var(--vp-c-text-3);
	translate: 0 -1px;
}

.home-button[data-variant='primary'] {
	border-color: transparent;
	background: var(--site-green-1);
	color: #fff;
	box-shadow: 0 8px 24px -8px rgb(22 163 74 / 60%);
}

.home-button[data-variant='primary']:hover {
	background: var(--site-green-2);
}

.home-install {
	display: inline-flex;
	align-items: center;
	gap: 16px;
	margin-block-start: 20px;
	padding: 6px 6px 6px 18px;
	border: 1px solid var(--site-code-border);
	border-radius: 12px;
	background: var(--site-code);
}

.home-install code {
	color: #e7e5e4;
	font-size: 14px;
}

.home-install-prompt {
	margin-inline-end: 10px;
	color: #34d399;
	user-select: none;
}
</style>
