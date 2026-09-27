import { captureLayout, type MotionEngine, stopMotion } from '@vue-data-grid/flip';

import {
	type DragAxis,
	type DragPoint,
	type DragRect,
	DROP_INDICATOR_ATTRIBUTE,
	DROP_LEVEL_PROPERTY,
	type DropPosition,
} from './model';

export interface DropIndicator {
	/**
	 * Puts the indicator over `box`, in viewport coordinates: an edge of an item for `'before'` and
	 * `'after'`, the item's box for `'inside'`.
	 */
	show: (box: DragRect, position: DropPosition, level: number) => void;
	hide: () => void;
	destroy: () => void;
}

/** Where `left: 0; top: 0` of an absolutely positioned element is, in viewport coordinates. */
function getOrigin(element: HTMLElement): DragPoint {
	const parent = element.offsetParent;

	if (!(parent instanceof HTMLElement) || (parent === document.body && getComputedStyle(parent).position === 'static')) {
		return { x: -window.scrollX, y: -window.scrollY };
	}

	const rect = parent.getBoundingClientRect();

	return { x: rect.left + parent.clientLeft - parent.scrollLeft, y: rect.top + parent.clientTop - parent.scrollTop };
}

/**
 * One element that moves from place to place, with the engine as an `'indicator'`, where each item's
 * own mark would only jump. It lives in the list's container, so it scrolls with the items, and only
 * for the length of a gesture. The package places it by `translate` and sizes it: along the edge of
 * the place, and the whole box for `'inside'`. Its thickness, colour and indent (from `--drop-level`)
 * are for the markup's CSS.
 */
export function createDropIndicator(container: HTMLElement, axis: DragAxis, engine: MotionEngine | null): DropIndicator {
	const element = document.createElement('div');

	element.setAttribute('aria-hidden', 'true');
	Object.assign(element.style, {
		position: 'absolute',
		top: '0',
		left: '0',
		boxSizing: 'border-box',
		pointerEvents: 'none',
	});

	function show(box: DragRect, position: DropPosition, level: number) {
		const appearing = element.parentElement !== container || element.style.display === 'none';

		if (element.parentElement !== container) {
			container.append(element);
		}

		// Appearing, it goes to the place at once rather than moving in from where it was last seen.
		const capture = appearing || !engine ? null : captureLayout([element]);

		element.setAttribute(DROP_INDICATOR_ATTRIBUTE, position);
		element.style.setProperty(DROP_LEVEL_PROPERTY, String(level));
		element.style.display = '';

		const origin = getOrigin(element);
		const whole = position === 'inside';

		element.style.translate = `${box.left - origin.x}px ${box.top - origin.y}px`;
		element.style.width = whole || axis === 'vertical' ? `${box.right - box.left}px` : '';
		element.style.height = whole || axis === 'horizontal' ? `${box.bottom - box.top}px` : '';
		capture?.animate([element], engine, { kind: 'indicator' });
	}

	function hide() {
		stopMotion([element]);
		element.style.display = 'none';
	}

	function destroy() {
		stopMotion([element]);
		element.remove();
	}

	return { show, hide, destroy };
}
