/**
 * One stored record, already bound to its place: a key in `localStorage`, a row on your server. The
 * state that uses it knows nothing about keys, formats or where the record lives.
 */
export interface PersistStore {
	/** The stored value, `null` without one, or a promise of it for an asynchronous backend. */
	read: () => unknown;
	/** Stores a value that survives `JSON.stringify`; `null` removes the record. */
	write: (value: unknown) => void;
	/**
	 * Calls `listener` with the new value when the record changes elsewhere: another table on the page,
	 * another tab. Returns the function that unsubscribes. A store without it is not synced.
	 */
	subscribe?: (listener: (value: unknown) => void) => () => void;
}

type Listener = (value: unknown) => void;

const listeners = new WeakMap<Storage, Map<string, Set<Listener>>>();

function parse(raw: string | null | undefined): unknown {
	if (raw === null || raw === undefined) {
		return null;
	}

	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
}

function stringify(value: unknown) {
	return value === null || value === undefined ? null : JSON.stringify(value) ?? null;
}

function getListeners(storage: Storage, key: string) {
	const byKey = listeners.get(storage) ?? new Map<string, Set<Listener>>();
	const keyListeners = byKey.get(key) ?? new Set<Listener>();

	listeners.set(storage, byKey);
	byKey.set(key, keyListeners);

	return keyListeners;
}

function createWebStorageStore(getStorage: () => Storage | null, key: string): PersistStore {
	return {
		read: () => {
			const storage = getStorage();

			try {
				return parse(storage?.getItem(key));
			} catch {
				return null;
			}
		},
		write: (value) => {
			const storage = getStorage();
			const raw = stringify(value);

			if (!storage) {
				return;
			}

			try {
				if (raw === null) {
					storage.removeItem(key);
				} else {
					storage.setItem(key, raw);
				}
			} catch {
				return;
			}

			// The `storage` event reaches only other tabs: tables in this one are told here, each with its
			// own copy of the value.
			for (const listener of listeners.get(storage)?.get(key) ?? []) {
				listener(parse(raw));
			}
		},
		subscribe: (listener) => {
			const storage = getStorage();

			if (!storage) {
				return () => undefined;
			}

			const keyListeners = getListeners(storage, key);

			function handleStorage(event: StorageEvent) {
				if (event.storageArea === storage && (event.key === key || event.key === null)) {
					listener(event.key === null ? null : parse(event.newValue));
				}
			}

			keyListeners.add(listener);
			window.addEventListener('storage', handleStorage);

			return () => {
				keyListeners.delete(listener);
				window.removeEventListener('storage', handleStorage);
			};
		},
	};
}

function getLocalStorage() {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

function getSessionStorage() {
	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
}

/**
 * A record in `localStorage` under `key`, as JSON. Tables with the same key share it: a table on the
 * same page hears about a write at once, another tab through the `storage` event. A storage that
 * throws (a full quota, blocked site data) stores nothing and breaks nothing.
 */
export function localStorageStore(key: string): PersistStore {
	return createWebStorageStore(getLocalStorage, key);
}

/** The same as `localStorageStore`, in `sessionStorage`: the record lives as long as the tab. */
export function sessionStorageStore(key: string): PersistStore {
	return createWebStorageStore(getSessionStorage, key);
}

/**
 * A record in memory, as JSON, like the web storages: for tests, and for tables that share state
 * without keeping it between visits. Every subscriber hears every write, its own included.
 */
export function memoryStore(initial: unknown = null): PersistStore {
	const subscribers = new Set<Listener>();
	let raw = stringify(initial);

	return {
		read: () => parse(raw),
		write: (value) => {
			raw = stringify(value);

			for (const listener of subscribers) {
				listener(parse(raw));
			}
		},
		subscribe: (listener) => {
			subscribers.add(listener);

			return () => {
				subscribers.delete(listener);
			};
		},
	};
}
