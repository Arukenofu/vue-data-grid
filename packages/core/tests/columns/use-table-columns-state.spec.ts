import { customRef, defineComponent, nextTick, type Ref, ref, shallowRef, watch } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defineColumns } from '../../src/columns/define-columns';
import type { TableLayout } from '../../src/columns/layout';
import type { TableSort } from '../../src/columns/sort';
import {
	type RememberField,
	type TableColumnsState,
	type TableColumnsStateOptions,
	useTableColumnsState,
} from '../../src/columns/use-table-columns-state';
import { localStorageStore, memoryStore, type PersistStore } from '../../src/persist/store';

const STORAGE_KEY = 'demo';

const value = () => 0;

const ALL: readonly RememberField[] = ['order', 'hidden', 'widths', 'pinned', 'sort'];

interface Mounted {
	state: TableColumnsState;
	unmount: () => void;
}

/** The state reads storage in `onMounted`, so a real mounted component creates it. */
function mountState(options: TableColumnsStateOptions = {}): Mounted {
	let state: TableColumnsState | null = null;

	const wrapper = mount(defineComponent({
		setup() {
			state = useTableColumnsState(options);

			return () => null;
		},
	}));

	return { state: state as unknown as TableColumnsState, unmount: () => wrapper.unmount() };
}

const read = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

const write = (record: unknown) => localStorage.setItem(STORAGE_KEY, JSON.stringify(record));

let mounted: Mounted | null = null;

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	mounted?.unmount();
	mounted = null;
	localStorage.clear();
});

describe('useTableColumnsState — models', () => {
	const asc = (name: string): TableSort => ({ name, direction: 'asc' });

	it('a sort ref is the model: the state writes to it and follows it', () => {
		const sort = ref<TableSort[]>([asc('a')]);
		const state = useTableColumnsState({ sort });

		expect(state.sort.value).toEqual([asc('a')]);

		state.sort.value = [asc('b')];
		expect(sort.value).toEqual([asc('b')]);

		sort.value = [asc('c')];
		expect(state.sort.value).toEqual([asc('c')]);
	});

	it('a layout ref is the model too, and `reset` returns to the value it had first', () => {
		const initial: TableLayout = { order: ['a'], hidden: [], widths: {}, pinned: {} };
		const layout = shallowRef<TableLayout | null>(initial);
		const state = useTableColumnsState({ layout });

		state.layout.value = { ...initial, hidden: ['a'] };
		expect(layout.value?.hidden).toEqual(['a']);

		state.reset();
		expect(state.layout.value).toEqual(initial);
		expect(layout.value).toEqual(initial);
	});

	it('a second change in one tick builds on the first while a `v-model` write has not come back', () => {
		const parent = shallowRef<TableSort[]>([]);
		const written: TableSort[][] = [];
		const sort = customRef<TableSort[]>(() => ({
			get: () => parent.value,
			set: (next) => {
				written.push(next);
			},
		}));
		const state = useTableColumnsState({ sort });

		state.sort.value = [asc('a')];
		state.sort.value = [...state.sort.value, asc('b')];

		expect(written.at(-1)).toEqual([asc('a'), asc('b')]);
	});

	it('a `multiSort` ref is used as it is', () => {
		const multiSort: Ref<boolean> = ref(false);
		const state = useTableColumnsState({ multiSort });

		expect(state.multiSort).toBe(multiSort);
	});

	it('an array `sort` stays the initial value, copied', () => {
		const initial = [asc('a')];
		const state = useTableColumnsState({ sort: initial });

		state.sort.value = [asc('b')];
		state.reset();

		expect(state.sort.value).toEqual([asc('a')]);
		expect(initial).toEqual([asc('a')]);
	});
});

describe('useTableColumnsState — shape', () => {
	it('stores nothing without `persist`', async () => {
		mounted = mountState({ remember: ALL });
		mounted.state.layout.value = { order: ['a'], hidden: [], widths: {}, pinned: {} };
		await nextTick();

		expect(localStorage.length).toBe(0);
	});

	it('without `remember` everything is stored', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY) });
		mounted.state.layout.value = { order: ['a'], hidden: [], widths: {}, pinned: {}, collapsed: { g: true } };
		mounted.state.sort.value = [{ name: 'a', direction: 'asc' }];
		await nextTick();

		expect(read()).toEqual({
			version: 1,
			layout: { order: ['a'], hidden: [], widths: {}, pinned: {}, collapsed: { g: true } },
			sort: [{ name: 'a', direction: 'asc' }],
		});
	});

	it('the key is used as given, without a prefix', async () => {
		mounted = mountState({ persist: localStorageStore('screener') });
		mounted.state.sort.value = [{ name: 'a', direction: 'asc' }];
		await nextTick();

		expect(localStorage.key(0)).toBe('screener');
	});

	it('is ready at once without `persist`', () => {
		mounted = mountState();

		expect(mounted.state.ready.value).toBe(true);
	});

	it('the initial sort is copied, not taken by reference', () => {
		const sort = [{ name: 'price', direction: 'asc' as const }];

		mounted = mountState({ sort });
		mounted.state.sort.value = [...mounted.state.sort.value, { name: 'cap', direction: 'desc' }];

		expect(sort).toHaveLength(1);
	});

	it('`multiSort` is returned as is', () => {
		mounted = mountState({ multiSort: true });

		expect(mounted.state.multiSort.value).toBe(true);
	});

	it('`multiSort` is off by default', () => {
		mounted = mountState();

		expect(mounted.state.multiSort.value).toBe(false);
	});
});

describe('useTableColumnsState — writing', () => {
	it('the layout goes to storage with a version number', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });
		mounted.state.layout.value = { order: ['b', 'a'], hidden: ['a'], widths: { b: 200 }, pinned: { b: 'start' } };
		await nextTick();

		expect(read()).toEqual({
			version: 1,
			layout: { order: ['b', 'a'], hidden: ['a'], widths: { b: 200 }, pinned: { b: 'start' } },
			sort: [],
		});
	});

	it('only what `remember` lists is stored', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ['widths'] });
		mounted.state.layout.value = { order: ['b', 'a'], hidden: ['a'], widths: { b: 200 }, pinned: { b: 'start' } };
		await nextTick();

		expect(read().layout).toEqual({ widths: { b: 200 } });
		expect(read().sort).toBeUndefined();
	});

	it('the sort is written as its own field', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ['sort'] });
		mounted.state.sort.value = [{ name: 'price', direction: 'desc' }];
		await nextTick();

		expect(read()).toEqual({ version: 1, sort: [{ name: 'price', direction: 'desc' }] });
	});
});

describe('useTableColumnsState — reading', () => {
	it('a stored layout is applied on mount', () => {
		const layout = { order: ['b', 'a'], hidden: ['a'], widths: { b: 200 }, pinned: {} };

		write({ version: 1, layout });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.layout.value).toEqual(layout);
	});

	it('a stored sort is applied', () => {
		write({ version: 1, sort: [{ name: 'price', direction: 'desc' }] });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.sort.value).toEqual([{ name: 'price', direction: 'desc' }]);
	});

	it('the sort is not applied when it is not remembered', () => {
		write({ version: 1, sort: [{ name: 'price', direction: 'desc' }] });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ['widths'] });

		expect(mounted.state.sort.value).toEqual([]);
	});

	it('empty storage is fine: the layout stays unset', () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.layout.value).toBeNull();
	});
});

describe('useTableColumnsState — invalid records', () => {
	let logged: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	it('non-JSON neither breaks nor logs on every read', () => {
		localStorage.setItem(STORAGE_KEY, '{ not json');
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.layout.value).toBeNull();
		expect(logged).not.toHaveBeenCalled();
	});

	it('a record of another schema version is ignored', () => {
		write({ version: 99, layout: { order: ['b', 'a'], hidden: [], widths: {}, pinned: {} } });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.layout.value).toBeNull();
	});

	it('a record without a version is ignored', () => {
		write({ layout: { order: ['b', 'a'], hidden: [], widths: {}, pinned: {} } });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.layout.value).toBeNull();
	});

	it('`order` that is not an array is dropped, the rest applies', () => {
		write({ version: 1, layout: { order: 'broken', hidden: ['a'], widths: {}, pinned: {} } });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.layout.value?.order).toEqual([]);
		expect(mounted.state.layout.value?.hidden).toEqual(['a']);
	});

	it('non-numeric and negative widths are dropped', () => {
		write({ version: 1, layout: { widths: { a: 'wide', b: -5, c: 0, d: 200 } } });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.layout.value?.widths).toEqual({ d: 200 });
	});

	it('an unknown pin side is dropped', () => {
		write({ version: 1, layout: { pinned: { a: 'middle', b: 'start' } } });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.layout.value?.pinned).toEqual({ b: 'start' });
	});

	it('names that are not strings are dropped', () => {
		write({ version: 1, layout: { order: ['a', 7, null, 'b'] } });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.layout.value?.order).toEqual(['a', 'b']);
	});

	it('a broken sort record is dropped item by item', () => {
		write({ version: 1, sort: [{ name: 'a', direction: 'up' }, { name: 'b', direction: 'desc' }, 'junk'] });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		expect(mounted.state.sort.value).toEqual([{ name: 'b', direction: 'desc' }]);
	});
});

/**
 * Echo is dropped by comparing strings that `project` builds on both sides. Comparing the stored
 * record as is would rely on the parser and the projection listing fields in the same order; if they
 * diverged, tabs would silently keep rewriting the record of each other.
 */
describe('useTableColumnsState — echo between tabs', () => {
	function fireStorage(record: unknown) {
		const raw = JSON.stringify(record);

		localStorage.setItem(STORAGE_KEY, raw);
		window.dispatchEvent(new StorageEvent('storage', {
			key: STORAGE_KEY,
			newValue: raw,
			storageArea: localStorage,
		}));
	}

	async function settle() {
		await nextTick();
		await nextTick();
		await nextTick();
	}

	it('our own change does not come back as an echo: the layout stays the same object', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		let replaced = 0;

		watch(mounted.state.layout, () => {
			replaced += 1;
		}, { flush: 'sync' });

		mounted.state.layout.value = { order: ['b', 'a'], hidden: [], widths: {}, pinned: {} };

		const own = mounted.state.layout.value;

		await settle();

		expect(replaced).toBe(1);
		expect(mounted.state.layout.value).toBe(own);
	});

	it('our own sort change does not come back as an echo either', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		let replaced = 0;

		watch(mounted.state.sort, () => {
			replaced += 1;
		}, { flush: 'sync' });

		mounted.state.sort.value = [{ name: 'price', direction: 'desc' }];

		const own = mounted.state.sort.value;

		await settle();

		expect(replaced).toBe(1);
		expect(mounted.state.sort.value).toBe(own);
	});

	it('our own change is not written to storage twice', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });
		mounted.state.layout.value = { order: ['b', 'a'], hidden: [], widths: {}, pinned: {} };
		await nextTick();

		const stored = localStorage.getItem(STORAGE_KEY);

		await settle();

		expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
	});

	it('a write from another tab with a different field order is applied and not written back', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		fireStorage({
			sort: [],
			layout: { pinned: {}, widths: { a: 300 }, hidden: ['b'], order: ['b', 'a'] },
			version: 1,
		});
		await nextTick();

		expect(mounted.state.layout.value?.order).toEqual(['b', 'a']);
		expect(mounted.state.layout.value?.widths).toEqual({ a: 300 });

		const stored = localStorage.getItem(STORAGE_KEY);

		await nextTick();
		await nextTick();

		expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
	});

	it('the same write again does not recreate the layout, or the whole grid would re-render', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		const record = { version: 1, layout: { order: ['b', 'a'], hidden: [], widths: {}, pinned: {} }, sort: [] };

		fireStorage(record);
		await nextTick();

		const applied = mounted.state.layout.value;

		fireStorage(record);
		await nextTick();

		expect(mounted.state.layout.value).toBe(applied);
	});
});

describe('useTableColumnsState — reset', () => {
	it('resets the layout and the sort to their initial values', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL, sort: [{ name: 'price', direction: 'asc' }] });
		mounted.state.layout.value = { order: ['b', 'a'], hidden: [], widths: {}, pinned: {} };
		mounted.state.sort.value = [{ name: 'cap', direction: 'desc' }];
		await nextTick();

		mounted.state.reset();

		expect(mounted.state.layout.value).toBeNull();
		expect(mounted.state.sort.value).toEqual([{ name: 'price', direction: 'asc' }]);
	});

	it('removes the record, and the writing watcher does not bring it back', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });
		mounted.state.layout.value = { order: ['b', 'a'], hidden: [], widths: {}, pinned: {} };
		await nextTick();

		expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

		mounted.state.reset();
		await nextTick();
		await nextTick();

		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	it('works without storage too', () => {
		mounted = mountState();
		mounted.state.layout.value = { order: ['a'], hidden: [], widths: {}, pinned: {} };

		expect(() => mounted?.state.reset()).not.toThrow();
		expect(mounted.state.layout.value).toBeNull();
	});
});

describe('useTableColumnsState — other stores', () => {
	it('reads and writes go to the given store, not to `localStorage`', async () => {
		const storage = memoryStore({ version: 1, layout: { order: ['b', 'a'] } });

		mounted = mountState({ persist: storage, remember: ALL });

		expect(mounted.state.layout.value?.order).toEqual(['b', 'a']);

		mounted.state.layout.value = { order: ['a', 'b'], hidden: [], widths: {}, pinned: {} };
		await nextTick();

		expect((storage.read() as { layout: { order: string[] } }).layout.order).toEqual(['a', 'b']);
		expect(localStorage.length).toBe(0);
	});

	it('an asynchronous store is applied when it answers, and `ready` follows', async () => {
		const answer = Promise.resolve({ version: 1, layout: { order: ['b', 'a'] } });

		mounted = mountState({ persist: { read: () => answer, write: () => undefined }, remember: ALL });

		expect(mounted.state.ready.value).toBe(false);
		expect(mounted.state.layout.value).toBeNull();

		await answer;
		await nextTick();

		expect(mounted.state.ready.value).toBe(true);
		expect(mounted.state.layout.value?.order).toEqual(['b', 'a']);
	});

	it('a late answer does not overwrite what the user changed meanwhile', async () => {
		let answer: (value: unknown) => void = () => undefined;
		const pending = new Promise((resolve) => {
			answer = resolve;
		});

		mounted = mountState({ persist: { read: () => pending, write: () => undefined }, remember: ALL });
		mounted.state.sort.value = [{ name: 'cap', direction: 'asc' }];
		await nextTick();

		answer({ version: 1, sort: [{ name: 'price', direction: 'desc' }] });
		await pending;
		await nextTick();

		expect(mounted.state.sort.value).toEqual([{ name: 'cap', direction: 'asc' }]);
	});

	it('two tables with one key on a page see the changes of each other', async () => {
		const first = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });
		const second = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });

		first.state.layout.value = { order: ['b', 'a'], hidden: [], widths: {}, pinned: {} };
		await nextTick();

		expect(second.state.layout.value?.order).toEqual(['b', 'a']);

		first.unmount();
		second.unmount();
	});

	it('after unmount, writes from elsewhere leave the table alone', async () => {
		const first = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });
		const second = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ALL });
		const { state } = second;

		second.unmount();
		first.state.layout.value = { order: ['b', 'a'], hidden: [], widths: {}, pinned: {} };
		await nextTick();

		expect(state.layout.value).toBeNull();

		first.unmount();
	});

	it('a store that throws does not break the table', async () => {
		const storage: PersistStore = {
			read: () => {
				throw new Error('SecurityError');
			},
			write: () => {
				throw new Error('QuotaExceededError');
			},
		};

		mounted = mountState({ persist: storage, remember: ALL });
		mounted.state.layout.value = { order: ['a'], hidden: [], widths: {}, pinned: {} };
		await nextTick();

		expect(mounted.state.layout.value?.order).toEqual(['a']);
		expect(() => mounted?.state.reset()).not.toThrow();
	});
});

describe('useTableColumnsState — columns', () => {
	const columns = defineColumns({ price: { value }, cap: { value } });

	it('type the names in `sort`', () => {
		const state = useTableColumnsState({ columns, sort: [{ name: 'price', direction: 'desc' }] });

		// @ts-expect-error: `volume` is not a column
		useTableColumnsState({ columns, sort: [{ name: 'volume', direction: 'desc' }] });

		expect(state.sort.value).toEqual([{ name: 'price', direction: 'desc' }]);
	});

	it('a restored sort drops columns that are not declared', () => {
		write({ version: 1, sort: [{ name: 'gone', direction: 'asc' }, { name: 'cap', direction: 'desc' }] });
		mounted = mountState({ columns, persist: localStorageStore(STORAGE_KEY) });

		expect(mounted.state.sort.value).toEqual([{ name: 'cap', direction: 'desc' }]);
	});

	it('works outside a component: storage is read at once', () => {
		write({ version: 1, sort: [{ name: 'cap', direction: 'desc' }] });

		const state = useTableColumnsState({ persist: localStorageStore(STORAGE_KEY) });

		expect(state.sort.value).toEqual([{ name: 'cap', direction: 'desc' }]);
		expect(state.ready.value).toBe(true);
	});
});

describe('useTableColumnsState — collapsed groups', () => {
	it('is written when remembered', async () => {
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ['collapsed'] });
		mounted.state.layout.value = { order: [], hidden: [], widths: {}, pinned: {}, collapsed: { quote: true } };
		await nextTick();

		expect(read().layout).toEqual({ collapsed: { quote: true } });
	});

	it('is read field by field: values that are not flags are dropped', () => {
		write({ version: 1, layout: { collapsed: { quote: true, book: 'yes', cap: false } } });
		mounted = mountState({ persist: localStorageStore(STORAGE_KEY), remember: ['collapsed'] });

		expect(mounted.state.layout.value?.collapsed).toEqual({ quote: true, cap: false });
	});
});
