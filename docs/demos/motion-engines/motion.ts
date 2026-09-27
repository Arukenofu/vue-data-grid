import { defineMotionEngine } from '@vue-stack/table';
import { animate } from 'motion';

import type { HeightMotion } from './height';

export const motionEngine = defineMotionEngine({
	move: ({ element, x, y }, index) => animate(
		element,
		{ x: [x, 0], y: [y, 0] },
		{ type: 'spring', stiffness: 420, damping: 30, delay: index * 0.02 },
	),
	enter: element => animate(element, { opacity: [0, 1], scale: [0.94, 1] }, { duration: 0.35, delay: 0.1 }),
	leave: element => animate(element, { opacity: 0, scale: 0.94 }, { duration: 0.25 }),
	stop: animation => animation.complete(),
});

export const motionHeight: HeightMotion = (element, from, to) => {
	const animation = animate(element, { height: [from, to] }, { type: 'spring', stiffness: 320, damping: 32 });

	void animation.finished.then(() => element.style.removeProperty('height'));

	return () => animation.complete();
};
