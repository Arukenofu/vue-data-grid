# `src/persist`

Saving grid state (column widths, order, sort, ...) between visits. It sits on the bottom layer next
to `shared`, so `columns` can use it. The folder splits cleanly in two: **where** a record lives
(`store.ts`) and **how** a piece of state is kept in sync with it (`use-persisted-state.ts`).

```
persist/
  index.ts               public surface
  store.ts               PersistStore interface + localStorage, sessionStorage, memory stores
  use-persisted-state.ts usePersistedState: restore, write, listen
```

Exports in the root: `PersistStore`, `localStorageStore`, `sessionStorageStore`, `memoryStore`,
`usePersistedState`, `PersistedState`, `PersistedStateOptions`.

---

## `store.ts`

### `PersistStore`

```ts
interface PersistStore {
	read: () => unknown;
	write: (value: unknown) => void;
	subscribe?: (listener: (value: unknown) => void) => () => void;
}
```

One stored record, **already bound to its place**: a key in `localStorage`, a row on your server. The
state that consumes the store never sees keys, formats or locations, so a custom backend only
implements these three functions.

- `read()` returns the stored value, `null` for nothing, or a **promise** for an asynchronous backend.
- `write(value)` stores a JSON-safe value; `null` removes the record.
- `subscribe(listener)` is optional. The listener is called when the record changes elsewhere (another
  grid on the page, another tab); the returned function unsubscribes. A store without `subscribe`
  is simply not synced.

### Private helpers

| Function | Role |
| --- | --- |
| `parse(raw)` | `JSON.parse` that returns `null` for `null`, `undefined` and broken JSON instead of throwing |
| `stringify(value)` | `JSON.stringify`, mapping `null`/`undefined` to `null` ("no record") |
| `getListeners(storage, key)` | lazily builds a `WeakMap<Storage, Map<key, Set<Listener>>>` entry; the registry of in-page subscribers |
| `getLocalStorage()` / `getSessionStorage()` | return the storage or `null`; wrapped in `try` because merely touching `window.localStorage` throws when site data is blocked, and under SSR `window` does not exist |

### `createWebStorageStore(getStorage, key)`

The shared implementation behind `localStorageStore` and `sessionStorageStore`. The storage is
fetched **lazily on each call** (via `getStorage`), not at creation, so creating a store on the
server is safe.

- **read**: `parse(storage?.getItem(key))` inside `try`; any failure reads as "no record".
- **write**:
  1. serialize to `raw`; with no storage, return;
  2. `raw === null` removes the key, otherwise `setItem`; a throw (full quota) is swallowed;
  3. notify the in-page listeners for this storage and key, each receiving **its own fresh
     `parse(raw)`**, so subscribers never share one mutable object.
- **subscribe**: registers the listener in the in-page registry **and** adds a `storage` event
  listener on `window`. The browser fires `storage` only in *other* tabs, which is why step 3 of
  `write` exists: grids in the same tab are told directly. The handler accepts events for this
  storage area where `event.key === key`, or `event.key === null` (the storage was cleared, so the
  value becomes `null`).
- With no storage, `subscribe` returns a no-op unsubscribe.

### `localStorageStore(key)` / `sessionStorageStore(key)`

Thin wrappers over `createWebStorageStore`. Grids that use the same key share the record.
`sessionStorage` lives as long as the tab.

### `memoryStore(initial = null)`

An in-memory record, stored **as a JSON string** just like the web storages, so it has the same
semantics (values are copies, non-JSON values are dropped). Useful for tests and for grids that
should share state without surviving a reload. Every subscriber hears every write, **including the
writer's own**; `usePersistedState` handles that echo.

---

## `use-persisted-state.ts`

### Types

```ts
interface PersistedStateOptions<TValue> {
	parse: (stored: unknown) => TValue | undefined;
	serialize?: (value: TValue) => unknown;
}

interface PersistedState {
	ready: Readonly<Ref<boolean>>;
	forget: () => void;
}
```

- `parse` is mandatory on purpose. A stored record outlives the code that wrote it, so the shape
  must be checked at the boundary. Returning `undefined` rejects the record.
- `serialize` defaults to identity. The result must survive `JSON.stringify`.
- `ready` is `false` until the stored value was read and applied, or found missing. Useful for async
  stores, to avoid flashing defaults.
- `forget()` removes the record without writing the current state back.

### `usePersistedState(state, store, options)`

Keeps a `Ref` in sync with a store: restore once, write every change, apply external writes.

Internal bookkeeping:

| Variable | Meaning |
| --- | --- |
| `synced` | the last value written or applied, as a JSON string. Comparing against it recognizes our own echo and skips redundant writes |
| `settled` | a value was applied or written already, so a late async first read is stale and must be ignored |
| `active` | `false` after the scope is disposed; late callbacks do nothing |
| `unsubscribe` | the store's subscription handle |

Helpers inside:

- `encode(value)`: `serialize` then `JSON.stringify`, returns `{ stored, raw }`.
- `apply(stored)`: parses a stored value and, if it is valid, not a duplicate of `synced` and the
  composable is still active, assigns it to `state`. After assignment `synced` is recomputed from
  `state.value` and not from the incoming value, because the state may merge the value into
  something larger than what was stored; the watcher will see the merged form and must not
  consider it a change.
- `write()`: encodes the state; if it equals `synced`, nothing to do; otherwise remember it and
  call `store.write`, swallowing store errors.
- `readInitial()`: `store.read()` with errors read as `null`.
- `forget()`: sets `synced` to the current state first, so the watcher does not immediately write
  the state back, then writes `null`.

#### `start()`

1. Subscribe to external changes (`store.subscribe?.(apply)`).
2. Read the initial value. If it is thenable, wait for it; apply it only if nothing was settled
   meanwhile, and flip `ready` in both the success and the failure case. Otherwise apply it and
   set `ready` immediately.
3. **Only now** start `watch(state, write, { deep: true })`. Starting the watcher earlier would let
   the initial default state overwrite the stored record before it is read.

#### When `start` runs

- Inside a component that is not yet mounted: in `onMounted`. A restored value would differ from the
  server-rendered markup and break hydration, so restoring is postponed until after the first
  render.
- Anywhere else (outside a component, or already mounted): immediately.

If there is an active effect scope, `onScopeDispose` marks the state inactive and unsubscribes.

#### Failure policy

A store that throws never breaks the grid: reads become `null`, writes are dropped. The state simply
stops being persisted.

#### Echo handling in one example

1. The user resizes a column; the watcher calls `write()`: `raw !== synced`, so `synced = raw`,
   `store.write(stored)`.
2. A `memoryStore` notifies all its subscribers, including this state. `apply` parses the value;
   `encode(value).raw === synced`, so it returns early. No loop.
3. Another grid with the same key receives the same notification, its `synced` differs, so it
   applies the value and updates its own state, and it does not write it back.

Where it is used: `columns/use-grid-columns-state.ts` (see the Columns page once it is written).
