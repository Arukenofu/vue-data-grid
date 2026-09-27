import { afterEach, describe, expect, it, vi } from 'vitest';

import { localStorageStore, memoryStore, sessionStorageStore } from '../../src/persist/store';

afterEach(() => {
	vi.restoreAllMocks();
	localStorage.clear();
	sessionStorage.clear();
});

describe('localStorageStore', () => {
	it('writes JSON under the key as given and reads it back as a new object', () => {
		const store = localStorageStore('grid');
		const value = { order: ['a', 'b'] };

		store.write(value);

		expect(localStorage.getItem('grid')).toBe('{"order":["a","b"]}');
		expect(store.read()).toEqual(value);
		expect(store.read()).not.toBe(value);
	});

	it('`null` removes the record, and a missing record reads as `null`', () => {
		const store = localStorageStore('grid');

		store.write({ a: 1 });
		store.write(null);

		expect(localStorage.getItem('grid')).toBeNull();
		expect(store.read()).toBeNull();
	});

	it('a record that is not JSON reads as `null`', () => {
		localStorage.setItem('grid', '{ broken');

		expect(localStorageStore('grid').read()).toBeNull();
	});

	it('stores with one key hear each other on the page, each with its own copy', () => {
		const first = localStorageStore('grid');
		const second = localStorageStore('grid');
		const heard: unknown[] = [];

		const unsubscribe = second.subscribe?.(value => heard.push(value));

		first.write({ a: 1 });
		unsubscribe?.();
		first.write({ a: 2 });

		expect(heard).toEqual([{ a: 1 }]);
	});

	it('another tab is heard through the `storage` event, a cleared storage as `null`', () => {
		const heard: unknown[] = [];
		const unsubscribe = localStorageStore('grid').subscribe?.(value => heard.push(value));

		window.dispatchEvent(new StorageEvent('storage', { key: 'grid', newValue: '{"a":1}', storageArea: localStorage }));
		window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: '{"a":2}', storageArea: localStorage }));
		window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }));
		unsubscribe?.();

		expect(heard).toEqual([{ a: 1 }, null]);
	});

	it('a storage that cannot be reached stores nothing and throws nothing', () => {
		vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
			throw new Error('SecurityError');
		});

		const store = localStorageStore('grid');

		expect(() => store.write({ a: 1 })).not.toThrow();
		expect(store.read()).toBeNull();
		expect(() => store.subscribe?.(() => undefined)()).not.toThrow();
	});
});

describe('sessionStorageStore', () => {
	it('keeps the record in `sessionStorage`', () => {
		sessionStorageStore('grid').write({ a: 1 });

		expect(sessionStorage.getItem('grid')).toBe('{"a":1}');
		expect(localStorage.getItem('grid')).toBeNull();
	});
});

describe('memoryStore', () => {
	it('starts with the initial value and reads copies', () => {
		const initial = { a: 1 };
		const store = memoryStore(initial);

		expect(store.read()).toEqual(initial);
		expect(store.read()).not.toBe(initial);
	});

	it('every subscriber hears every write, its own included', () => {
		const store = memoryStore();
		const heard: unknown[] = [];

		store.subscribe?.(value => heard.push(value));
		store.write({ a: 1 });
		store.write(null);

		expect(heard).toEqual([{ a: 1 }, null]);
		expect(store.read()).toBeNull();
	});
});
