import { computed, effectScope, nextTick, ref, shallowRef, watch, watchEffect } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { stableComputed } from '../../src/shared/stable-computed';

describe('stableComputed — folding', () => {
	it('the first evaluation gets the initial value', () => {
		const resolve = vi.fn(() => 'next');
		const value = stableComputed('initial', resolve);

		expect(value.value).toBe('next');
		expect(resolve).toHaveBeenCalledWith('initial');
	});

	it('the next evaluation gets the previous result', () => {
		const source = ref(1);
		const seen: unknown[] = [];

		const value = stableComputed<string>('', (previous) => {
			seen.push(previous);

			return `v${source.value}`;
		});

		expect(value.value).toBe('v1');

		source.value = 2;

		expect(value.value).toBe('v2');
		expect(seen).toEqual(['', 'v1']);
	});

	it('a kept reference survives a recompute', () => {
		const source = ref(1);
		const value = stableComputed<{ n: number }>({ n: 0 }, previous =>
			(previous.n === source.value ? previous : { n: source.value }));

		const first = value.value;

		source.value = 1;

		expect(value.value).toBe(first);

		source.value = 2;

		expect(value.value).not.toBe(first);
	});

	it('the initial value may have a different type than the result', () => {
		const value = stableComputed<{ n: number }, null>(null, previous => ({ n: (previous?.n ?? 0) + 1 }));

		expect(value.value).toEqual({ n: 1 });
	});
});

describe('stableComputed — like computed', () => {
	it('caches: without a dependency change `resolve` is not called again', () => {
		const source = ref(1);
		const resolve = vi.fn(() => source.value);
		const value = stableComputed(0, resolve);

		for (let read = 0; read < 3; read += 1) {
			expect(value.value).toBe(1);
		}

		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('recomputes lazily: without a read `resolve` is not called at all', () => {
		const source = ref(1);
		const resolve = vi.fn(() => source.value);

		stableComputed(0, resolve);
		source.value = 2;

		expect(resolve).not.toHaveBeenCalled();
	});

	it('wakes dependent effects when the value changes', async () => {
		const source = ref(1);
		const value = stableComputed(0, () => source.value);
		const seen: number[] = [];

		watchEffect(() => seen.push(value.value));
		source.value = 2;
		await nextTick();

		expect(seen).toEqual([1, 2]);
	});

	it('a kept reference does not wake `watch`: it compares by reference', async () => {
		const source = ref(1);
		const value = stableComputed<{ n: number }>({ n: 0 }, previous =>
			(previous.n === source.value ? previous : { n: source.value }));
		const seen: unknown[] = [];

		watch(value, next => seen.push(next), { immediate: true });

		source.value = 1;
		await nextTick();

		expect(seen).toHaveLength(1);

		source.value = 2;
		await nextTick();

		expect(seen).toHaveLength(2);
	});

	it('works as a dependency of another computed', () => {
		const source = ref(2);
		const doubled = stableComputed(0, () => source.value * 2);
		const label = computed(() => `= ${doubled.value}`);

		expect(label.value).toBe('= 4');

		source.value = 3;

		expect(label.value).toBe('= 6');
	});
});

describe('stableComputed — memory between evaluations', () => {
	it('the previous result cannot be read outside `resolve`', () => {
		const value = stableComputed<string>('initial', previous => previous);

		expect(Object.keys(value)).not.toContain('previous');
	});

	it('the memory belongs to its instance, not to the module', () => {
		const first = stableComputed<number>(0, previous => previous + 1);
		const second = stableComputed<number>(100, previous => previous + 1);

		expect(first.value).toBe(1);
		expect(second.value).toBe(101);
	});

	it('a skipped read does not lose the fold: it starts from the last returned value', () => {
		const source = shallowRef(1);
		const seen: number[] = [];

		const value = stableComputed<number>(0, (previous) => {
			seen.push(previous);

			return source.value;
		});

		expect(value.value).toBe(1);

		source.value = 2;
		source.value = 3;

		expect(value.value).toBe(3);
		expect(seen).toEqual([0, 1]);
	});

	it('survives stopping its scope: a read still recomputes', () => {
		const source = ref(1);
		const scope = effectScope();
		const value = scope.run(() => stableComputed<string>('', previous => `${previous}${source.value}`));

		expect(value?.value).toBe('1');

		scope.stop();
		source.value = 2;

		expect(value?.value).toBe('12');
	});

	it('holds no state outside the fold: there is nothing to clean up', () => {
		const scope = effectScope();

		scope.run(() => stableComputed<number>(0, previous => previous + 1));

		expect(() => scope.stop()).not.toThrow();
	});
});
