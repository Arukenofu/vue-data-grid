<script setup lang="ts">
import IconCode from '~icons/lucide/code-xml';
import IconComponent from '~icons/lucide/component';
import IconWorkflow from '~icons/lucide/workflow';

import InlineText from '../components/InlineText.vue';

defineSlots<{ default: () => unknown }>();

const LEVELS = [
	{
		icon: IconComponent,
		title: 'Components',
		text: 'Small parts in the manner of Reka UI, with `as` and `asChild`. Put them together like a form.',
	},
	{
		icon: IconWorkflow,
		title: 'Composables',
		text: 'The behaviour under the parts: navigation, resizing, ranges, editing, dragging. Use them with any markup.',
	},
	{
		icon: IconCode,
		title: 'Utilities',
		text: 'Prop-getters for roles, indexes and states, for grids you write from scratch.',
	},
];
</script>

<template>
	<section class="home-section home-parts">
		<div class="home-parts-text">
			<p class="home-eyebrow" data-reveal>Built from parts</p>
			<h2 class="home-heading" data-reveal>Compose it like a form. Replace any piece.</h2>
			<p class="home-subheading" data-reveal>
				A grid is a tree of small parts. Each takes what it needs from the one around it, so you
				add a resize handle by writing one, and swap a part for your own without forking anything.
			</p>
			<ul class="home-levels">
				<li v-for="level in LEVELS" :key="level.title" data-reveal>
					<span class="home-level-icon" aria-hidden="true"><component :is="level.icon" /></span>
					<span>
						<strong>{{ level.title }}</strong>
						<span class="home-level-text"><InlineText :text="level.text" /></span>
					</span>
				</li>
			</ul>
		</div>
		<div class="home-parts-code" data-reveal>
			<slot />
		</div>
	</section>
</template>

<style scoped>
.home-parts {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
	align-items: center;
	gap: 56px;
	text-align: start;
}

.home-parts .home-heading,
.home-parts .home-subheading,
.home-parts .home-eyebrow {
	margin-inline: 0;
	text-align: start;
}

.home-levels {
	display: grid;
	gap: 18px;
	margin: 32px 0 0;
	padding: 0;
	list-style: none;
}

.home-levels li {
	display: flex;
	gap: 14px;
}

.home-level-icon {
	display: inline-flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: 10px;
	background: var(--vp-c-brand-soft);
	color: var(--vp-c-brand-1);
	font-size: 18px;
}

.home-levels strong {
	display: block;
	font-size: 15px;
}

.home-level-text {
	display: block;
	margin-block-start: 2px;
	color: var(--vp-c-text-2);
	font-size: 14px;
	line-height: 1.6;
}

.home-parts-code {
	min-width: 0;
}

.home-parts-code :deep(div[class*='language-']) {
	position: relative;
	margin: 0;
	overflow: hidden;
	border: 1px solid var(--site-code-border);
	border-radius: 16px;
	background: var(--site-code);
	box-shadow: var(--site-shadow);
}

.home-parts-code :deep(pre) {
	margin: 0;
	padding: 24px;
	overflow-x: auto;
	font-size: 13.5px;
	line-height: 1.7;
}

.home-parts-code :deep(.lang),
.home-parts-code :deep(.copy) {
	display: none;
}

@media (max-width: 959px) {
	.home-parts {
		grid-template-columns: minmax(0, 1fr);
		gap: 32px;
	}
}
</style>
