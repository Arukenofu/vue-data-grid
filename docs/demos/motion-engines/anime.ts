import { defineMotionEngine } from '@vue-data-grid/core';
import { animate, type JSAnimation } from 'animejs';

import type { HeightMotion } from './height';

function clear(animation: JSAnimation) {
	animation.revert();
}

export const animeEngine = defineMotionEngine({
	move: ({ element, x, y }, index) => animate(element, {
		x: { from: x, to: 0 },
		y: { from: y, to: 0 },
		duration: 700,
		delay: index * 20,
		ease: 'outElastic(1, .75)',
		onComplete: clear,
	}),
	enter: element => animate(element, {
		opacity: { from: 0, to: 1 },
		duration: 400,
		delay: 120,
		ease: 'outQuad',
		onComplete: clear,
	}),
	leave: element => animate(element, { opacity: 0, x: 40, duration: 280, ease: 'inQuad' }),
	stop: animation => animation.complete(),
});

export const animeHeight: HeightMotion = (element, from, to) => {
	const animation = animate(element, {
		height: { from, to },
		duration: 520,
		ease: 'outQuart',
		onComplete: clear,
	});

	return () => animation.revert();
};
