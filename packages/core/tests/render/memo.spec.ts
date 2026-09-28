import { defineComponent, h, nextTick, ref, type VNode } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { isSameTokens, keepMounted } from '../../src/render/memo';

describe('isSameTokens', () => {
	it('equal lists match', () => {
		expect(isSameTokens([1, 'a', true], [1, 'a', true])).toBe(true);
	});

	it('different lengths do not match', () => {
		expect(isSameTokens([1, 2], [1, 2, 3])).toBe(false);
		expect(isSameTokens([1, 2, 3], [1, 2])).toBe(false);
	});

	it('empty lists match', () => {
		expect(isSameTokens([], [])).toBe(true);
	});

	it('comparison is element by element and by reference, not deep', () => {
		expect(isSameTokens([{ a: 1 }], [{ a: 1 }])).toBe(false);
	});

	it('the same object in both lists matches', () => {
		const token = { a: 1 };

		expect(isSameTokens([token], [token])).toBe(true);
	});

	it('`NaN` matches itself: comparison uses `Object.is`', () => {
		expect(isSameTokens([Number.NaN], [Number.NaN])).toBe(true);
	});

	it('zeros of different signs differ: comparison uses `Object.is`', () => {
		expect(isSameTokens([0], [-0])).toBe(false);
	});

	it('order matters', () => {
		expect(isSameTokens([1, 2], [2, 1])).toBe(false);
	});

	it('`undefined` and a missing item differ by length, not by value', () => {
		expect(isSameTokens([undefined], [undefined])).toBe(true);
		expect(isSameTokens([undefined], [])).toBe(false);
	});
});

describe('keepMounted — marker', () => {
	it('returns the same vnode, not a copy', () => {
		const vnode = h('div');

		expect(keepMounted(vnode)).toBe(vnode);
	});

	it('sets `memo`', () => {
		const vnode = keepMounted(h('div')) as VNode & { memo?: unknown[] };

		expect(vnode.memo).toBeDefined();
	});

	it('every marked vnode shares one marker', () => {
		const first = keepMounted(h('div')) as VNode & { memo?: unknown[] };
		const second = keepMounted(h('span')) as VNode & { memo?: unknown[] };

		expect(first.memo).toBe(second.memo);
	});

	it('tokens are not put into the marker: token comparison lives in render caches', () => {
		const vnode = keepMounted(h('div')) as VNode & { memo?: unknown[] };

		expect(vnode.memo).toEqual([]);
	});

	it('does not overwrite a foreign marker', () => {
		const own: unknown[] = ['token'];
		const vnode = h('div') as VNode & { memo?: unknown[] };

		vnode.memo = own;

		expect((keepMounted(vnode) as VNode & { memo?: unknown[] }).memo).toBe(own);
	});

	it('marking again changes nothing', () => {
		const vnode = keepMounted(h('div')) as VNode & { memo?: unknown[] };
		const { memo } = vnode;

		keepMounted(vnode);

		expect(vnode.memo).toBe(memo);
	});
});

/**
 * Relies on an internal Vue field: `cloneIfMounted` returns the vnode as is for any truthy `memo`,
 * and `patch` then stops at `n1 === n2`. The field belongs to `v-memo` and is not public API: if
 * that branch changes, grids will not crash but silently stop updating. This block fails at once.
 */
describe('keepMounted — memo survives a patch', () => {
	function render() {
		const tick = ref(0);
		const patched = { memoized: 0, plain: 0 };

		let memoized: VNode | null = null;
		let plain: VNode | null = null;

		const component = defineComponent({
			setup() {
				return () => {
					memoized ??= keepMounted(h('i', {
						class: 'memoized',
						onVnodeUpdated: () => {
							patched.memoized += 1;
						},
					}, `tick ${tick.value}`));

					plain ??= h('i', {
						class: 'plain',
						onVnodeUpdated: () => {
							patched.plain += 1;
						},
					}, `tick ${tick.value}`);

					return h('div', [memoized, plain, h('b', `tick ${tick.value}`)]);
				};
			},
		});

		return { tick, patched, wrapper: mount(component) };
	}

	it('a marked vnode is not patched, an unmarked one is', async () => {
		const { tick, patched, wrapper } = render();

		expect(patched).toEqual({ memoized: 0, plain: 0 });

		tick.value = 1;
		await nextTick();

		expect(patched.memoized).toBe(0);
		expect(patched.plain).toBeGreaterThan(0);

		wrapper.unmount();
	});

	it('a marked vnode does not rebuild its subtree, while its render sibling updates', async () => {
		const { tick, wrapper } = render();

		tick.value = 1;
		await nextTick();

		expect(wrapper.get('.memoized').text()).toBe('tick 0');
		expect(wrapper.get('b').text()).toBe('tick 1');

		wrapper.unmount();
	});

	it('a marked vnode holds through several re-renders in a row', async () => {
		const { tick, patched, wrapper } = render();

		for (let step = 1; step <= 5; step += 1) {
			tick.value = step;

			await nextTick();
		}

		expect(patched.memoized).toBe(0);
		expect(wrapper.get('.memoized').text()).toBe('tick 0');
		expect(wrapper.get('b').text()).toBe('tick 5');

		wrapper.unmount();
	});

	it('removing the marker restores normal behaviour: the vnode is patched again', async () => {
		const tick = ref(0);
		let patched = 0;
		let cached: VNode | null = null;

		const component = defineComponent({
			setup() {
				return () => {
					cached ??= h('i', { onVnodeUpdated: () => {
						patched += 1;
					} }, `tick ${tick.value}`);

					return h('div', [cached, h('b', `tick ${tick.value}`)]);
				};
			},
		});

		const wrapper = mount(component);

		tick.value = 1;
		await nextTick();

		expect(patched).toBeGreaterThan(0);

		wrapper.unmount();
	});

	it('the patch does not descend into the subtree: nested vnodes are not visited', async () => {
		const tick = ref(0);
		const visited = { memoized: 0, plain: 0 };

		const leaf = (name: 'memoized' | 'plain') =>
			h('em', { onVnodeUpdated: () => {
				visited[name] += 1;
			} }, [h('u', 'leaf')]);

		let memoized: VNode | null = null;
		let plain: VNode | null = null;

		const component = defineComponent({
			setup() {
				return () => {
					memoized ??= keepMounted(h('i', [leaf('memoized')]));
					plain ??= h('i', [leaf('plain')]);

					return h('div', [memoized, plain, h('b', `tick ${tick.value}`)]);
				};
			},
		});

		const wrapper = mount(component);

		tick.value = 1;
		await nextTick();

		expect(visited.memoized).toBe(0);
		expect(visited.plain).toBeGreaterThan(0);

		wrapper.unmount();
	});

	it('the DOM node under the marker stays the same element instead of being recreated', async () => {
		const { tick, wrapper } = render();
		const { element } = wrapper.get('.memoized');

		tick.value = 1;
		await nextTick();

		expect(wrapper.get('.memoized').element).toBe(element);

		wrapper.unmount();
	});
});
