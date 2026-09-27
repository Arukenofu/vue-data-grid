import { vi } from 'vitest';

const boxes = new Map<Element, { left: number; top: number }>();

/** Puts an element at `left`, `top`: happy-dom has no layout. */
export function place(element: Element, left: number, top: number) {
	boxes.set(element, { left, top });
}

export function stubLayout() {
	boxes.clear();
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: Element) {
		const { left, top } = boxes.get(this) ?? { left: 0, top: 0 };

		return { left, top, right: left + 100, bottom: top + 30, x: left, y: top, width: 100, height: 30, toJSON: () => ({}) } as DOMRect;
	});
}

export function createElements(count: number) {
	return Array.from({ length: count }, (_, index) => {
		const element = document.createElement('div');

		document.body.append(element);
		place(element, 0, index * 30);

		return element;
	});
}

export interface PlayedAnimation {
	element: Element;
	keyframes: Keyframe[];
	options: KeyframeAnimationOptions;
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
