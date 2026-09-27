import { effectScope, nextTick, shallowRef } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useStickyOffset } from '../../src/render/use-sticky-offset';

type Callback = (entries: ResizeObserverEntry[]) => void;

let observers: { callback: Callback; observed: Set<Element> }[] = [];

class FakeResizeObserver {
	readonly observed = new Set<Element>();

	readonly callback: Callback;

	constructor(callback: Callback) {
		this.callback = callback;
		observers.push(this);
	}

	observe(target: Element) {
		this.observed.add(target);
	}

	disconnect() {
		this.observed.clear();
	}
}

function element(height: number) {
	const node = document.createElement('div');

	Object.defineProperty(node, 'offsetHeight', { value: height });

	return node;
}

afterEach(() => {
	observers = [];
	vi.unstubAllGlobals();
});

describe('useStickyOffset', () => {
	it('reads the height at once, then follows the observer', async () => {
		vi.stubGlobal('ResizeObserver', FakeResizeObserver);

		const target = shallowRef<HTMLElement | null>(null);
		const scope = effectScope();
		const offset = scope.run(() => useStickyOffset(target));

		expect(offset?.value).toBe(0);

		target.value = element(40);
		await nextTick();

		expect(offset?.value).toBe(40);

		const [observer] = observers;

		observer.callback([{ borderBoxSize: [{ blockSize: 64 }] } as unknown as ResizeObserverEntry]);

		expect(offset?.value).toBe(64);

		scope.stop();

		expect(observer.observed.size).toBe(0);
	});

	it('without a ResizeObserver keeps the height read at once', async () => {
		vi.stubGlobal('ResizeObserver', undefined);

		const target = shallowRef<HTMLElement | null>(element(32));
		const scope = effectScope();
		const offset = scope.run(() => useStickyOffset(target));

		await nextTick();

		expect(offset?.value).toBe(32);
		scope.stop();
	});
});
