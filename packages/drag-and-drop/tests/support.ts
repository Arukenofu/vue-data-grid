import { vi } from 'vitest';

import type { DragPoint, DragRect } from '../src/model';

export interface Frames {
	pending: () => number;
	run: () => void;
}

/** `requestAnimationFrame` driven by hand: callbacks wait until `run`, each run 16 ms after the last. */
export function stubFrames(): Frames {
	const queue = new Map<number, FrameRequestCallback>();
	let id = 0;
	let now = 0;

	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		id += 1;
		queue.set(id, callback);

		return id;
	});

	vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
		queue.delete(handle);
	});

	return {
		pending: () => queue.size,
		run: () => {
			const callbacks = [...queue.values()];

			now += 16;
			queue.clear();
			callbacks.forEach(callback => callback(now));
		},
	};
}

const rects = new Map<Element, DragRect>();

/** Gives an element a box; hit testing returns the last placed element under a point. */
export function place(element: Element, rect: DragRect) {
	rects.delete(element);
	rects.set(element, rect);
}

function contains(rect: DragRect, point: DragPoint) {
	return point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom;
}

/** The inline `translate` of an element, which moves where it is drawn as in a browser. */
export function readShift(element: Element): DragPoint {
	const value = element instanceof HTMLElement ? element.style.getPropertyValue('translate') : '';
	const [x = '0', y = '0'] = value ? value.split(' ') : [];

	return { x: Number.parseFloat(x) || 0, y: Number.parseFloat(y) || 0 };
}

/** The box an element is drawn in: its placed box moved by its `translate`. */
function drawn(element: Element): DragRect {
	const rect = rects.get(element) ?? { left: 0, top: 0, right: 0, bottom: 0 };
	const { x, y } = readShift(element);

	return { left: rect.left + x, top: rect.top + y, right: rect.right + x, bottom: rect.bottom + y };
}

function hitAll(point: DragPoint) {
	return [...rects.keys()].filter(element => element.isConnected && contains(drawn(element), point)).reverse();
}

/** happy-dom has no layout: boxes come from `place`, and the viewport is 1000 × 800. */
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

	Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => 1000 });
	Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => 800 });
	document.elementFromPoint = (x: number, y: number) => hitAll({ x, y })[0] ?? null;
	document.elementsFromPoint = (x: number, y: number) => hitAll({ x, y });
}

export interface PointerInit {
	pointerType?: string;
	pointerId?: number;
	button?: number;
}

export function pointer(type: string, target: EventTarget, point: DragPoint, init: PointerInit = {}) {
	const event = new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		clientX: point.x,
		clientY: point.y,
		pointerId: init.pointerId ?? 1,
		pointerType: init.pointerType ?? 'mouse',
		isPrimary: true,
		button: init.button ?? 0,
	});

	target.dispatchEvent(event);

	return event;
}

export function key(target: EventTarget, name: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });

	target.dispatchEvent(event);

	return event;
}

/** A column of items 30 px tall inside a 300 × 300 container, at the origin or `left` px right of it. */
export function createList(keys: readonly string[], attach = true, left = 0) {
	const container = document.createElement('div');
	const items = new Map<string, HTMLElement>();

	place(container, { left, top: 0, right: left + 300, bottom: 300 });

	keys.forEach((name, index) => {
		const item = document.createElement('div');

		item.textContent = name;
		item.tabIndex = 0;
		container.append(item);
		place(item, { left, top: index * 30, right: left + 300, bottom: index * 30 + 30 });
		items.set(name, item);
	});

	if (attach) {
		document.body.append(container);
	}

	return { container, items, get: (name: string) => items.get(name) as HTMLElement };
}

/** The middle of an item's placed box, shifted along it by `ratio` of its height. */
export function at(element: Element, ratio = 0.5): DragPoint {
	const rect = rects.get(element) as DragRect;

	return { x: (rect.left + rect.right) / 2, y: rect.top + (rect.bottom - rect.top) * ratio };
}

export interface PlayedAnimation {
	element: Element;
	keyframes: Keyframe[];
	options: KeyframeAnimationOptions;
	/** Ends the animation as the browser would when its time is up. */
	finish: () => void;
	cancelled: boolean;
}

/** `Element.animate` that records what is played; animations end only through `finish`. */
export function stubAnimations() {
	const played: PlayedAnimation[] = [];

	vi.spyOn(Element.prototype, 'animate').mockImplementation(function animate(
		this: Element,
		keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
		options?: number | KeyframeAnimationOptions,
	) {
		let settle: { resolve: () => void; reject: (reason: unknown) => void } = { resolve: () => undefined, reject: () => undefined };
		const animation = {
			finished: new Promise<void>((resolve, reject) => {
				settle = { resolve, reject };
			}),
			cancel: () => {
				record.cancelled = true;
				settle.reject(new DOMException('The animation was canceled.', 'AbortError'));
			},
		};
		const record: PlayedAnimation = {
			element: this,
			keyframes: keyframes as Keyframe[],
			options: options as KeyframeAnimationOptions,
			finish: () => settle.resolve(),
			cancelled: false,
		};

		animation.finished.catch(() => undefined);

		played.push(record);

		return animation as unknown as Animation;
	});

	return played;
}
