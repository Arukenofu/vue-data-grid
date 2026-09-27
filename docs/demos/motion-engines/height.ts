import { prefersReducedMotion } from '@vue-stack/table';
import { nextTick, onScopeDispose, type Ref, watch } from 'vue';

export type HeightMotion = (element: HTMLElement, from: number, to: number) => (() => void) | undefined;

export const webHeight: HeightMotion = (element, from, to) => {
	const animation = element.animate(
		[{ height: `${from}px` }, { height: `${to}px` }],
		{ duration: 320, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
	);

	return () => animation.cancel();
};

export const noHeight: HeightMotion = () => undefined;

export function useHeightMotion(element: Readonly<Ref<HTMLElement | null>>, size: () => number, motion: () => HeightMotion) {
	let stop: (() => void) | undefined;

	watch(size, async () => {
		const target = element.value;

		if (!target || prefersReducedMotion()) {
			return;
		}

		const from = target.getBoundingClientRect().height;

		stop?.();
		stop = undefined;
		await nextTick();

		const to = target.getBoundingClientRect().height;

		if (from !== to) {
			stop = motion()(target, from, to);
		}
	}, { flush: 'pre' });

	onScopeDispose(() => stop?.());
}
