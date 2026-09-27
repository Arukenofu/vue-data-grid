import { vi } from 'vitest';

export interface Scroller extends HTMLElement {
	/** Sets the scroll position and fires `scroll`, as the browser does after a user scroll. */
	scrollToPosition: (position: { top?: number; left?: number }) => void;
	resize: (size: { width?: number; height?: number }) => void;
}

/** A scroll container with a fixed viewport: happy-dom has no layout, so sizes are given. */
export function createScroller(size: { width?: number; height?: number; scrollHeight?: number } = {}): Scroller {
	const element = document.createElement('div') as unknown as Scroller;
	let width = size.width ?? 0;
	let height = size.height ?? 0;
	let top = 0;
	let left = 0;

	Object.defineProperties(element, {
		clientWidth: { get: () => width },
		clientHeight: { get: () => height },
		scrollHeight: { get: () => size.scrollHeight ?? 1_000_000 },
		scrollWidth: { get: () => 1_000_000 },
		scrollTop: {
			get: () => top,
			set: (value: number) => {
				top = value;
			},
		},
		scrollLeft: {
			get: () => left,
			set: (value: number) => {
				left = value;
			},
		},
	});

	element.scrollToPosition = (position) => {
		top = position.top ?? top;
		left = position.left ?? left;
		element.dispatchEvent(new Event('scroll'));
	};

	element.resize = (next) => {
		width = next.width ?? width;
		height = next.height ?? height;
	};

	return element;
}

type ResizeCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

/** A `ResizeObserver` the test drives by hand: nothing is observed until `notify` is called. */
export class FakeResizeObserver {
	static instances: FakeResizeObserver[] = [];

	readonly observed = new Set<Element>();

	private readonly callback: ResizeCallback;

	constructor(callback: ResizeCallback) {
		this.callback = callback;
		FakeResizeObserver.instances.push(this);
	}

	observe(target: Element) {
		this.observed.add(target);
	}

	unobserve(target: Element) {
		this.observed.delete(target);
	}

	disconnect() {
		this.observed.clear();
	}

	/** Delivers entries for the given elements with their border-box heights. */
	notify(sizes: readonly (readonly [Element, number])[]) {
		const entries = sizes.map(([target, blockSize]) => ({
			target,
			borderBoxSize: [{ blockSize, inlineSize: 0 }],
		})) as unknown as ResizeObserverEntry[];

		this.callback(entries, this as unknown as ResizeObserver);
	}

	/** Delivers an entry to every observer: the size change of the scroll root. */
	static notifyAll() {
		for (const instance of FakeResizeObserver.instances) {
			instance.notify([...instance.observed].map(target => [target, 0] as const));
		}
	}
}

export function stubResizeObserver() {
	FakeResizeObserver.instances = [];
	vi.stubGlobal('ResizeObserver', FakeResizeObserver);
}

export interface Frames {
	pending: () => number;
	run: () => void;
	cancelled: () => number;
}

/** `requestAnimationFrame` driven by hand: callbacks wait until `run`. Undo with `vi.unstubAllGlobals`. */
export function stubAnimationFrames(): Frames {
	const queue = new Map<number, FrameRequestCallback>();
	let id = 0;
	let cancelled = 0;

	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		id += 1;
		queue.set(id, callback);

		return id;
	});

	vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
		cancelled += queue.delete(handle) ? 1 : 0;
	});

	return {
		pending: () => queue.size,
		cancelled: () => cancelled,
		run: () => {
			const callbacks = [...queue.values()];

			queue.clear();
			callbacks.forEach(callback => callback(0));
		},
	};
}
