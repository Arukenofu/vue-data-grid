<script setup lang="ts">
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import IconArrowRight from '~icons/lucide/arrow-right';
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';

import Showcase from '@/demos/showcase/index.vue';

import ExampleGallery from '../examples/ExampleGallery.vue';
import HomeFeatures from './HomeFeatures.vue';
import HomeHero from './HomeHero.vue';
import HomeParts from './HomeParts.vue';

defineSlots<{ anatomy: () => unknown }>();

const EXAMPLES_ON_HOME = 6;

const root = useTemplateRef<HTMLElement>('root');
let media: gsap.MatchMedia | null = null;

/** The hero comes in at once; everything below rises into place as it scrolls into view. */
function animate(element: HTMLElement) {
	const hero = element.querySelectorAll('.home-hero [data-reveal]');
	const below = gsap.utils.toArray<HTMLElement>('[data-reveal]:not(.home-hero *), [data-feature], [data-example]', element);

	gsap.to(hero, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 });
	gsap.to('[data-blob]', { x: '+=48', y: '+=28', duration: 7, ease: 'sine.inOut', repeat: -1, yoyo: true, stagger: 2 });
	gsap.fromTo('[data-showcase]', { autoAlpha: 0, y: 48, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.1, ease: 'power3.out', delay: 0.35 });

	gsap.set(below, { autoAlpha: 0, y: 28 });
	ScrollTrigger.batch(below, {
		start: 'top 88%',
		once: true,
		onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07 }),
	});
}

onMounted(() => {
	const element = root.value;

	if (!element) {
		return;
	}

	gsap.registerPlugin(ScrollTrigger);
	media = gsap.matchMedia();
	media.add('(prefers-reduced-motion: no-preference)', () => animate(element), element);
});

onBeforeUnmount(() => media?.revert());
</script>

<template>
	<div ref="root" class="home">
		<HomeHero />

		<section class="home-showcase-section">
			<div class="home-showcase" data-showcase>
				<div class="home-showcase-card site-demo-surface vp-raw">
					<Showcase />
				</div>
			</div>
			<p class="home-caption">
				A live grid, not a picture: search it, sort by several columns with <kbd>Shift</kbd>, select
				rows, resize and move through the cells with the arrow keys.
			</p>
		</section>

		<HomeFeatures />

		<HomeParts>
			<slot name="anatomy" />
		</HomeParts>

		<section class="home-section">
			<p class="home-eyebrow" data-reveal>Examples</p>
			<h2 class="home-heading" data-reveal>Real grids to take apart.</h2>
			<p class="home-subheading" data-reveal>
				Each example is a complete component with its source one switch away. Copy what you need.
			</p>
			<ExampleGallery :limit="EXAMPLES_ON_HOME" />
		</section>

		<section class="home-cta" data-reveal>
			<h2 class="home-cta-title">Ready to build yours?</h2>
			<p class="home-cta-text">Four small steps from an empty component to a sortable, accessible grid.</p>
			<a href="/overview/getting-started" class="home-cta-button">
				Get started
				<IconArrowRight aria-hidden="true" />
			</a>
		</section>
	</div>
</template>

<style scoped>
.home {
	max-width: 1200px;
	margin-inline: auto;
	padding-block-end: 96px;
}

.home-showcase-section {
	padding-inline: 24px;
}

.home-showcase {
	padding: clamp(12px, 3vw, 40px);
	border-radius: 24px;
	background:
		radial-gradient(circle at 1px 1px, rgb(255 255 255 / 20%) 1px, transparent 0) 0 0 / 16px 16px,
		linear-gradient(135deg, #12a594, #30a46c 60%, #65a30d);
	box-shadow: 0 30px 80px -30px rgb(18 165 148 / 55%);
}

.home-showcase-card {
	padding: clamp(12px, 2vw, 20px);
	border-radius: 16px;
	background: var(--vp-c-bg);
	box-shadow: 0 20px 50px -20px rgb(0 0 0 / 45%);
}

.home-caption {
	margin: 18px auto 0;
	max-width: 620px;
	color: var(--vp-c-text-2);
	font-size: 14px;
	line-height: 1.6;
	text-align: center;
}

.home-cta {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin: 96px 24px 0;
	padding: 56px 24px;
	border: 1px solid var(--vp-c-divider);
	border-radius: 24px;
	background:
		radial-gradient(60% 120% at 50% 0%, var(--site-glow-1), transparent 70%),
		var(--vp-c-bg-alt);
	text-align: center;
}

.home-cta-title {
	margin: 0;
	font-size: clamp(1.8rem, 4vw, 2.6rem);
	font-weight: 800;
	letter-spacing: -0.03em;
}

.home-cta-text {
	margin: 12px 0 28px;
	color: var(--vp-c-text-2);
	font-size: 1.05rem;
}

.home-cta-button {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	height: 46px;
	padding-inline: 22px;
	border-radius: 12px;
	background: var(--site-green-1);
	color: #fff;
	font-weight: 600;
	box-shadow: 0 8px 24px -8px rgb(22 163 74 / 60%);
	transition: background-color 0.2s, translate 0.2s;
}

.home-cta-button:hover {
	background: var(--site-green-2);
	translate: 0 -1px;
}
</style>
