import type { DragPoint, DragRect } from './model';

/** The `translate` an element is drawn with right now, a running animation of it included. */
export function readTranslate(element: Element): DragPoint {
	const value = getComputedStyle(element).translate;

	if (!value || value === 'none') {
		return { x: 0, y: 0 };
	}

	const [x = '0', y = '0'] = value.split(' ');

	return { x: Number.parseFloat(x) || 0, y: Number.parseFloat(y) || 0 };
}

export function formatTranslate({ x, y }: DragPoint) {
	return `${x}px ${y}px`;
}

/**
 * Where an element is laid out, without the `translate` it is drawn with: the gap and the movement of
 * the default engine, which hit testing must not see, or the place would run from the pointer.
 */
export function measureLayout(element: Element): DragRect {
	const rect = element.getBoundingClientRect();
	const { x, y } = readTranslate(element);

	return { left: rect.left - x, top: rect.top - y, right: rect.right - x, bottom: rect.bottom - y };
}
