import { vi } from 'vitest';

interface Rect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

interface Point {
	x: number;
	y: number;
}

const rects = new Map<Element, Rect>();

/** Gives an element a box; hit testing returns the last placed element under a point. */
export function place(element: Element, rect: Rect) {
	rects.delete(element);
	rects.set(element, rect);
}

function contains(rect: Rect, point: Point) {
	return point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom;
}

function hitAll(point: Point) {
	return [...rects.entries()]
		.filter(([element, rect]) => element.isConnected && contains(rect, point))
		.map(([element]) => element)
		.reverse();
}

/** The box an element is drawn in, as in a browser: its placed box moved by its inline `translate`. */
function drawn(element: Element): Rect {
	const rect = rects.get(element) ?? { left: 0, top: 0, right: 0, bottom: 0 };
	const value = element instanceof HTMLElement ? element.style.getPropertyValue('translate') : '';
	const [x = 0, y = 0] = value ? value.split(' ').map(part => Number.parseFloat(part) || 0) : [];

	return { left: rect.left + x, top: rect.top + y, right: rect.right + x, bottom: rect.bottom + y };
}

/** happy-dom has no layout: boxes come from `place`, and the viewport is 1600 × 800. */
export function stubLayout() {
	rects.clear();

	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: Element) {
		const rect = drawn(this);

		return {
			...rect,
			x: rect.left,
			y: rect.top,
			width: rect.right - rect.left,
			height: rect.bottom - rect.top,
			toJSON: () => rect,
		} as DOMRect;
	});

	Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => 1600 });
	Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => 800 });
	document.elementFromPoint = (x: number, y: number) => hitAll({ x, y })[0] ?? null;
	document.elementsFromPoint = (x: number, y: number) => hitAll({ x, y });
}

/** `requestAnimationFrame` driven by hand: callbacks wait until `run`, each run 16 ms after the last. */
export function stubFrames() {
	const queue = new Map<number, FrameRequestCallback>();
	let id = 0;
	let now = 0;

	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		id += 1;
		queue.set(id, callback);

		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', (handle: number) => queue.delete(handle));

	return {
		run: () => {
			const callbacks = [...queue.values()];

			now += 16;
			queue.clear();
			callbacks.forEach(callback => callback(now));
		},
	};
}

/** The middle of an element's placed box, shifted along it by `ratio` of its height. */
export function at(element: Element, ratio = 0.5): Point {
	const rect = rects.get(element) as Rect;

	return { x: (rect.left + rect.right) / 2, y: rect.top + (rect.bottom - rect.top) * ratio };
}

export function pointer(type: string, target: EventTarget, point: Point) {
	const event = new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		clientX: point.x,
		clientY: point.y,
		pointerId: 1,
		pointerType: 'mouse',
		isPrimary: true,
		button: 0,
	});

	target.dispatchEvent(event);

	return event;
}

export function key(target: EventTarget, name: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });

	target.dispatchEvent(event);

	return event;
}

/**
 * Places the rows of a table's body one under another, 30 px each, and its column header cells and
 * the cells of each row side by side, 100 px each, `left` px from the origin.
 */
export function placeTable(root: Element, left = 0) {
	const rows = [...root.querySelectorAll('[data-tc-part="body"] > [data-tc-part="row"]')];
	const headers = [...root.querySelectorAll('[data-tc-part="head"] [role="columnheader"][data-tc-column]')];

	place(root, { left, top: 0, right: left + 600, bottom: 600 });

	const head = root.querySelector('[data-tc-part="head"]');
	const body = root.querySelector('[data-tc-part="body"]');

	if (head) {
		place(head, { left, top: 0, right: left + 600, bottom: 30 });
	}

	if (body) {
		place(body, { left, top: 30, right: left + 600, bottom: 600 });
	}

	headers.forEach((cell, index) => place(cell, { left: left + index * 100, top: 0, right: left + index * 100 + 100, bottom: 30 }));
	rows.forEach((row, index) => {
		const top = 30 + index * 30;

		place(row, { left, top, right: left + 600, bottom: top + 30 });
		[...row.querySelectorAll(':scope > [data-tc-column]')].forEach((cell, column) => {
			place(cell, { left: left + column * 100, top, right: left + column * 100 + 100, bottom: top + 30 });
		});
	});
}
