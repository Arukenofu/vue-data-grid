import {
	getCurrentInstance,
	getCurrentScope,
	onMounted,
	onScopeDispose,
	type Ref,
	shallowRef,
	watch,
} from 'vue';

import type { PersistStore } from './store';

export interface PersistedStateOptions<TValue> {
	/**
	 * Turns a stored value back into state; `undefined` ignores it. A stored record outlives the code
	 * that wrote it, so check its shape here instead of trusting it.
	 */
	parse: (stored: unknown) => TValue | undefined;
	/** What to store for a state value; the value itself by default. Must survive `JSON.stringify`. */
	serialize?: (value: TValue) => unknown;
}

export interface PersistedState {
	/** `false` until the stored value is read and applied, or found missing. */
	ready: Readonly<Ref<boolean>>;
	/** Removes the stored record. The current state is not written back until it changes. */
	forget: () => void;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
	return typeof (value as PromiseLike<unknown> | null | undefined)?.then === 'function';
}

/**
 * Keeps `state` in `store`: restores it once, writes every change, and applies writes made elsewhere.
 * Inside a component the record is read in `onMounted`, since a restored value would not match the
 * server markup during hydration; elsewhere it is read at once. A store that throws stores nothing
 * and breaks nothing.
 */
export function usePersistedState<TValue>(
	state: Ref<TValue>,
	store: PersistStore,
	options: PersistedStateOptions<TValue>,
): PersistedState {
	const ready = shallowRef(false);
	const serialize = options.serialize ?? ((value: TValue): unknown => value);

	// The last value written or applied, as JSON: an equal value coming back is our own echo.
	let synced: string | undefined;
	// A value was applied or written, so an asynchronous first read that arrives later is stale.
	let settled = false;
	let active = true;
	let unsubscribe: (() => void) | undefined;

	function encode(value: TValue) {
		const stored = serialize(value);

		return { stored, raw: JSON.stringify(stored) ?? '' };
	}

	function apply(stored: unknown) {
		const value = stored === null || stored === undefined ? undefined : options.parse(stored);

		if (!active || value === undefined || encode(value).raw === synced) {
			return;
		}

		settled = true;
		state.value = value;
		// Compare with what the watcher will see: the state may merge the value into more than it holds.
		synced = encode(state.value).raw;
	}

	function write() {
		const { stored, raw } = encode(state.value);

		if (raw === synced) {
			return;
		}

		synced = raw;
		settled = true;

		try {
			store.write(stored);
		} catch {
			return;
		}
	}

	function readInitial(): unknown {
		try {
			return store.read();
		} catch {
			return null;
		}
	}

	function start() {
		if (!active) {
			return;
		}

		unsubscribe = store.subscribe?.(apply);

		const initial = readInitial();

		if (isThenable(initial)) {
			initial.then((value) => {
				if (!settled) {
					apply(value);
				}

				ready.value = true;
			}, () => {
				ready.value = true;
			});
		} else {
			apply(initial);
			ready.value = true;
		}

		// Watch after reading, or the state of the first render would overwrite the stored one.
		watch(state, write, { deep: true });
	}

	if (getCurrentScope()) {
		onScopeDispose(() => {
			active = false;
			unsubscribe?.();
		});
	}

	const instance = getCurrentInstance();

	if (instance && !instance.isMounted) {
		onMounted(start);
	} else {
		start();
	}

	function forget() {
		// Mark the current state as stored, or the watcher would write the removed record back.
		synced = encode(state.value).raw;
		settled = true;

		try {
			store.write(null);
		} catch {
			return;
		}
	}

	return { ready, forget };
}
