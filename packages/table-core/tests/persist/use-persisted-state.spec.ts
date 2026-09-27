import { defineComponent, effectScope, nextTick, type Ref, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { memoryStore, type PersistStore } from '../../src/persist/store';
import { type PersistedStateOptions, usePersistedState } from '../../src/persist/use-persisted-state';

const parseKeys: PersistedStateOptions<string[]> = {
	parse: stored => (Array.isArray(stored) ? stored.filter(item => typeof item === 'string') : undefined),
};

function mountPersisted(state: Ref<string[]>, store: PersistStore, options = parseKeys) {
	let persisted: ReturnType<typeof usePersistedState> | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			persisted = usePersistedState(state, store, options);

			return () => null;
		},
	}));

	return { persisted: persisted as unknown as ReturnType<typeof usePersistedState>, unmount: () => wrapper.unmount() };
}

describe('usePersistedState', () => {
	it('restores the stored value on mount, through `parse`', () => {
		const state = ref<string[]>([]);
		const { persisted, unmount } = mountPersisted(state, memoryStore(['a', 7, 'b']));

		expect(state.value).toEqual(['a', 'b']);
		expect(persisted.ready.value).toBe(true);
		unmount();
	});

	it('a value `parse` rejects leaves the state alone', () => {
		const state = ref(['x']);
		const { unmount } = mountPersisted(state, memoryStore({ not: 'a list' }));

		expect(state.value).toEqual(['x']);
		unmount();
	});

	it('writes changes, deep ones included, through `serialize`', async () => {
		const state = ref<string[]>([]);
		const store = memoryStore();
		const { unmount } = mountPersisted(state, store, { ...parseKeys, serialize: value => [...value].sort() });

		state.value.push('b', 'a');
		await nextTick();

		expect(store.read()).toEqual(['a', 'b']);
		unmount();
	});

	it('applies writes made elsewhere, and does not write them back', async () => {
		const state = ref<string[]>([]);
		const store = memoryStore();
		let writes = 0;
		const counted: PersistStore = {
			...store,
			write: (value) => {
				writes += 1;
				store.write(value);
			},
		};
		const { unmount } = mountPersisted(state, counted);

		store.write(['remote']);
		await nextTick();

		expect(state.value).toEqual(['remote']);
		expect(writes).toBe(0);
		unmount();
	});

	it('`forget` removes the record and the current state is not written back', async () => {
		const state = ref(['a']);
		const store = memoryStore(['a']);
		const { persisted, unmount } = mountPersisted(state, store);

		persisted.forget();
		await nextTick();

		expect(store.read()).toBeNull();

		state.value = ['b'];
		await nextTick();

		expect(store.read()).toEqual(['b']);
		unmount();
	});

	it('stops listening once the component unmounts', async () => {
		const state = ref<string[]>([]);
		const store = memoryStore();
		const { unmount } = mountPersisted(state, store);

		unmount();
		store.write(['late']);
		await nextTick();

		expect(state.value).toEqual([]);
	});

	it('outside a component reads at once and stops with its effect scope', () => {
		const state = ref<string[]>([]);
		const store = memoryStore(['a']);
		const scope = effectScope();

		scope.run(() => usePersistedState(state, store, parseKeys));

		expect(state.value).toEqual(['a']);

		scope.stop();
		store.write(['b']);

		expect(state.value).toEqual(['a']);
	});
});
