<script setup lang="ts">
import IconAccessibility from '~icons/lucide/accessibility';
import IconBlocks from '~icons/lucide/blocks';
import IconBraces from '~icons/lucide/braces';
import IconPalette from '~icons/lucide/palette';
import IconSparkles from '~icons/lucide/sparkles';
import IconZap from '~icons/lucide/zap';
import type { Component } from 'vue';

interface Feature {
	icon: Component;
	title: string;
	text: string;
	link: string;
}

const FEATURES: readonly Feature[] = [
	{
		icon: IconPalette,
		title: 'Headless',
		text: 'Every part renders one element with data attributes, and no look of its own. Your CSS, your design system, your markup.',
		link: '/overview/styling',
	},
	{
		icon: IconAccessibility,
		title: 'Accessible',
		text: 'The WAI-ARIA grid and treegrid patterns, full keyboard navigation, live announcements and respect for reduced motion.',
		link: '/overview/accessibility',
	},
	{
		icon: IconZap,
		title: 'Fast',
		text: 'Row and column windows, one component per row rather than per cell, and widths that change without a render.',
		link: '/overview/performance',
	},
	{
		icon: IconBlocks,
		title: 'Composable',
		text: 'Features are functions and parts are components. Use what you need; what you do not never reaches your bundle.',
		link: '/overview/concepts',
	},
	{
		icon: IconSparkles,
		title: 'Animated',
		text: 'Sorts, drags and expanding rows move into place. Web Animations by default, or bring GSAP, Motion or your own.',
		link: '/guides/animation',
	},
	{
		icon: IconBraces,
		title: 'Typed',
		text: 'The type of your rows flows from the data into columns, cells and callbacks, with no generics to write by hand.',
		link: '/guides/columns',
	},
];
</script>

<template>
	<section class="home-section">
		<p class="home-eyebrow" data-reveal>Why it exists</p>
		<h2 class="home-heading" data-reveal>A grid you own, with the hard parts done.</h2>
		<p class="home-subheading" data-reveal>
			Finished grids are hard to make yours; pure logic leaves you rebuilding focus, keys and ARIA.
			This sits in between.
		</p>
		<div class="home-features">
			<a v-for="feature in FEATURES" :key="feature.title" :href="feature.link" class="home-feature" data-feature>
				<span class="home-feature-icon" aria-hidden="true">
					<component :is="feature.icon" />
				</span>
				<span class="home-feature-title">{{ feature.title }}</span>
				<span class="home-feature-text">{{ feature.text }}</span>
			</a>
		</div>
	</section>
</template>

<style scoped>
.home-features {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 16px;
	margin-block-start: 40px;
}

.home-feature {
	display: flex;
	text-align: start;
	flex-direction: column;
	gap: 8px;
	padding: 24px;
	border: 1px solid var(--vp-c-divider);
	border-radius: 16px;
	background: var(--vp-c-bg-alt);
	color: inherit;
	transition: border-color 0.2s, translate 0.2s, box-shadow 0.2s;
}

.home-feature:hover {
	border-color: rgb(22 163 74 / 40%);
	box-shadow: var(--site-shadow);
	translate: 0 -2px;
}

.home-feature-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	margin-block-end: 8px;
	border: 1px solid var(--vp-c-brand-soft);
	border-radius: 12px;
	background: var(--vp-c-brand-soft);
	color: var(--vp-c-brand-1);
	font-size: 20px;
}

.home-feature-title {
	font-size: 16px;
	font-weight: 700;
}

.home-feature-text {
	color: var(--vp-c-text-2);
	font-size: 14px;
	line-height: 1.65;
}

@media (max-width: 959px) {
	.home-features {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@media (max-width: 639px) {
	.home-features {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
