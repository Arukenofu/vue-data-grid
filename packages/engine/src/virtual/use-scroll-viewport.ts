import { type Ref, type ShallowRef, shallowRef, watch } from 'vue';

import { useMountedElement } from './use-mounted-element';

/** Scroll position and visible size of the grid root, shared by the row and column windows. */
export interface ScrollViewport {
	/** The scroll container once mounted; `null` on the server and before mount. */
	element: Readonly<ShallowRef<HTMLElement | null>>;
	scrollTop: Readonly<ShallowRef<number>>;
	/**
	 * Horizontal scroll from the inline start, px, never negative: in a right-to-left container
	 * `scrollLeft` goes below zero, and this stays the distance from the right edge.
	 */
	scrollInline: Readonly<ShallowRef<number>>;
	/** `clientWidth` and `clientHeight`: the visible area without scrollbars, px. */
	width: Readonly<ShallowRef<number>>;
	height: Readonly<ShallowRef<number>>;
}

/**
 * One passive `scroll` listener and one `ResizeObserver` on the root. Each axis is a separate ref,
 * so vertical scrolling never wakes the column window and horizontal scrolling never wakes the row
 * window; a value that did not change does not trigger at all.
 */
export function useScrollViewport(root: Ref<HTMLElement | null>): ScrollViewport {
	const element = useMountedElement(root);
	const scrollTop = shallowRef(0);
	const scrollInline = shallowRef(0);
	const width = shallowRef(0);
	const height = shallowRef(0);

	watch(element, (next, _previous, onCleanup) => {
		if (!next) {
			return;
		}

		const target = next;

		function readScroll() {
			scrollTop.value = target.scrollTop;
			scrollInline.value = Math.abs(target.scrollLeft);
		}

		function readSize() {
			width.value = target.clientWidth;
			height.value = target.clientHeight;
		}

		readScroll();
		readSize();
		target.addEventListener('scroll', readScroll, { passive: true });

		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(readSize);

		observer?.observe(target);

		onCleanup(() => {
			target.removeEventListener('scroll', readScroll);
			observer?.disconnect();
		});
	}, { immediate: true, flush: 'sync' });

	return { element, scrollTop, scrollInline, width, height };
}
