import { defineMotionEngine } from '@vue-stack/table';
import { gsap } from 'gsap';

import type { HeightMotion } from './height';

export const gsapEngine = defineMotionEngine({
	move: ({ element, x, y }, index) => gsap.from(element, {
		x,
		y,
		duration: 0.6,
		delay: index * 0.025,
		ease: 'power3.out',
		clearProps: 'transform',
	}),
	enter: element => gsap.from(element, {
		autoAlpha: 0,
		x: -24,
		duration: 0.45,
		delay: 0.15,
		ease: 'back.out(1.6)',
		clearProps: 'opacity,visibility,transform',
	}),
	leave: element => gsap.to(element, { autoAlpha: 0, x: 48, duration: 0.3, ease: 'power2.in' }),
	stop: tween => tween.progress(1).kill(),
});

export const gsapHeight: HeightMotion = (element, from, to) => {
	const tween = gsap.fromTo(element, { height: from }, { height: to, duration: 0.5, ease: 'power3.out', clearProps: 'height' });

	return () => tween.progress(1).kill();
};
