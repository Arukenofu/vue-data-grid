import { computed, shallowRef, watch } from 'vue';

import { resolveAnchorShift } from './anchor';
import { type ItemMetrics, resolveVisibleRange } from './item-metrics';
import type { ScrollViewport } from './use-scroll-viewport';

/** What `useAnchoredScroll` reads: the viewport, the rows and the heights around them. */
export interface AnchoredScrollOptions {
	viewport: ScrollViewport;
	metrics: () => ItemMetrics;
	getItemKey: (index: number) => string;
	/** The index of the row with a key; `-1` for none. */
	getItemIndex: (key: string) => number;
	/** Height of what stands between the sticky top and the body and scrolls away, px. */
	bodyOffset: () => number;
	/** Height of the part of the viewport rows are seen in, between the sticky top and bottom, px. */
	pageHeight: () => number;
	/** Whether rows are kept in place also at the very top, where what comes in above shows otherwise. */
	atTop: () => boolean;
}

/** What was in view at the last read: the element, the rows by key, and where the list and the view stood. */
interface Anchor {
	element: HTMLElement;
	metrics: ItemMetrics;
	bodyOffset: number;
	scrollTop: number;
	start: number;
	keys: readonly string[];
}

/**
 * The scroll position the rows are placed and windowed at: the viewport's, or, right after rows came
 * in or went above the ones in view or the body offset changed, the position that keeps the rows in
 * view where they were on the screen. It runs ahead of the viewport for one render, so that everything
 * read in that render, the row window and the rows in view, already sees the rows in place; the
 * element is scrolled there after the render, once the body is as tall as the new rows.
 *
 * At the very top nothing is kept in place unless `atTop` says so: there what comes in above shows, as
 * browsers do. Code that scrolls the element goes through `scrollTo` and `scrollBy`, so that a shift
 * not yet applied is dropped or kept on purpose rather than written over.
 */
export function useAnchoredScroll(options: AnchoredScrollOptions) {
	const { viewport } = options;
	// Bumped once the element is scrolled from here, so the position is read again.
	const revision = shallowRef(0);
	let anchor: Anchor | null = null;
	// How far the position runs ahead of the element, px: the rows moved and the element is not there yet.
	let shift = 0;

	// The keys of the rows in view are read again only when other rows come into view or the rows
	// change, not on every scroll frame.
	function readAnchor(element: HTMLElement, metrics: ItemMetrics, bodyOffset: number, scrollTop: number): Anchor {
		const { start, end } = resolveVisibleRange(metrics, scrollTop - bodyOffset, options.pageHeight());
		let keys = anchor?.keys;

		if (!keys || anchor?.metrics !== metrics || anchor.start !== start || keys.length !== end - start) {
			const read: string[] = [];

			for (let index = start; index < end; index += 1) {
				read.push(options.getItemKey(index));
			}

			keys = read;
		}

		return { element, metrics, bodyOffset, scrollTop, start, keys };
	}

	function resolveShift(previous: Anchor, metrics: ItemMetrics, bodyOffset: number) {
		let result = bodyOffset - previous.bodyOffset;

		if (metrics !== previous.metrics) {
			result += resolveAnchorShift(
				{ metrics: previous.metrics, getKey: index => previous.keys[index - previous.start] },
				{ metrics, getKey: options.getItemKey, getIndex: options.getItemIndex },
				previous.scrollTop - previous.bodyOffset,
				options.pageHeight(),
			);
		}

		return result;
	}

	// Remembers what is in view as it goes: the rows compared next time are the ones of the last read,
	// before the rows changed.
	const scrollTop = computed(() => {
		void revision.value;

		const element = viewport.element.value;
		const metrics = options.metrics();
		const bodyOffset = options.bodyOffset();
		const current = viewport.scrollTop.value;

		// A new element starts from its own position: rows measured in the old one say nothing of it.
		if (!anchor || anchor.element !== element) {
			shift = 0;
		} else if (anchor.scrollTop > 0 || options.atTop()) {
			shift += resolveShift(anchor, metrics, bodyOffset);
		}

		const result = Math.max(current + shift, 0);

		// A shift clamped at the top, or cancelled by a scroll in the same flush, leaves nothing to scroll.
		shift = result - current;
		anchor = element ? readAnchor(element, metrics, bodyOffset, result) : null;

		return result;
	});

	function apply(position: number) {
		const root = viewport.element.value;

		if (!root) {
			return;
		}

		shift = 0;
		root.scrollTop = position;
		viewport.sync();
		revision.value += 1;
	}

	// Watches how far the position runs ahead, not the position: a scroll and a shift that meet in one
	// flush leave the position as it was, and the element must still be scrolled.
	watch(() => (viewport.element.value ? scrollTop.value - viewport.scrollTop.value : 0), (ahead) => {
		if (ahead !== 0) {
			apply(scrollTop.value);
		}
	}, { flush: 'post' });

	/** Scrolls the element to a position worked out from the rows as they are now: a pending shift is dropped. */
	function scrollTo(position: number) {
		anchor = null;
		apply(position);
	}

	/** Scrolls the element by `delta`, px, such as for rows above that changed height; a pending shift stays. */
	function scrollBy(delta: number) {
		const root = viewport.element.value;

		if (root) {
			root.scrollTop += delta;
			viewport.sync();
		}
	}

	return { scrollTop, scrollTo, scrollBy };
}
