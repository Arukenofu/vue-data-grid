export type ScrollAlign = 'start' | 'center' | 'end' | 'auto';

export interface ScrollTarget {
	/** Edges of the target in scroll-content coordinates along the axis, px. */
	start: number;
	end: number;
	/** How much of each edge sticky content covers (pinned columns, insets, the header), px. */
	insetStart: number;
	insetEnd: number;
	viewport: number;
	scroll: number;
	/** The largest scroll position: content size minus viewport size. */
	max: number;
	align: ScrollAlign;
}

function clamp(value: number, max: number) {
	return Math.round(Math.min(Math.max(value, 0), Math.max(max, 0)));
}

/**
 * The scroll position that puts the target at `align` within the uncovered part of the viewport,
 * between the sticky edges; `null` when no scrolling is needed. `'auto'` scrolls just enough to show
 * the target, and aligns a target larger than the uncovered part to the start.
 */
export function resolveScrollPosition(target: ScrollTarget) {
	const { start, end, insetStart, insetEnd, viewport, scroll, max } = target;
	const toStart = start - insetStart;
	const toEnd = end - viewport + insetEnd;
	let next = scroll;

	if (target.align === 'start') {
		next = toStart;
	} else if (target.align === 'end') {
		next = toEnd;
	} else if (target.align === 'center') {
		next = (toStart + toEnd) / 2;
	} else if (start < scroll + insetStart || end - start > viewport - insetStart - insetEnd) {
		next = toStart;
	} else if (end > scroll + viewport - insetEnd) {
		next = toEnd;
	}

	const position = clamp(next, max);

	return position === Math.round(scroll) ? null : position;
}
