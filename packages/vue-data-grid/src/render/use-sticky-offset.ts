import { type Ref, shallowRef, watch } from 'vue';

/**
 * Height of a sticky block: the top (header, pinned rows) for `scrollMargin`, or the bottom (footer,
 * rows pinned there) for `scrollMarginEnd`. Tracked with a `ResizeObserver` rather than read on every
 * frame, which would force a layout during scrolling.
 */
export function useStickyOffset(element: Ref<HTMLElement | null>) {
	const offset = shallowRef(0);

	watch(element, (next, _previous, onCleanup) => {
		// Read once up front, or the first frame would render with zero before the observer reports.
		offset.value = next?.offsetHeight ?? 0;

		if (!next || typeof ResizeObserver === 'undefined') {
			return;
		}

		const observer = new ResizeObserver(([entry]) => {
			offset.value = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
		});

		observer.observe(next);
		onCleanup(() => observer.disconnect());
	}, { immediate: true });

	return offset;
}
