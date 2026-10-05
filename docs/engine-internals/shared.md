# `src/shared`

The bottom layer: three small reactive helpers that every other folder may use. They know nothing
about columns, rows or cells.

```
shared/
  index.ts             public surface of the folder
  stable-computed.ts   computed that can return its previous reference
  use-model-ref.ts     ref over an optional external model (v-model)
  use-row-token.ts     "one row holds a token" with per-row reactivity
```

`index.ts` exports `stableComputed`, `useModelRef`, `useRowToken` and the type `RowToken`. All of them
are re-exported from `internals.ts`, none from the root.

---

## `stable-computed.ts`

### `stableComputed(initial, resolve)`

```ts
function stableComputed<TValue, TInitial = TValue>(
	initial: TInitial,
	resolve: (previous: TValue | TInitial) => TValue,
): ComputedRef<TValue>
```

A normal `computed` rebuilds its value from scratch and returns a new object whenever any dependency
changes. For arrays and objects that are compared by reference downstream (row caches, column
windows, memoized renders), a new object means everything below re-renders even if the content is
identical.

`stableComputed` passes the **previous result** into the resolver, so the resolver can decide "nothing
really changed" and hand back the same reference.

How it works:

1. A closure variable `previous` starts as `initial`.
2. Inside a `computed`, `resolve(previous)` runs and the result replaces `previous`.
3. The computed returns that result.

Vue's own `computed` then skips triggering dependents when the returned value is `===` to the old
one. That is the whole trick: the stability logic lives in `resolve`, the notification suppression
comes from Vue.

Illustrative shape of a resolver (`sameItems` stands for any element-wise comparison):

```ts
const rows = stableComputed<Row[], undefined>(undefined, (previous) => {
	const next = build();

	return previous && sameItems(previous, next) ? previous : next;
});
```

Why two generic parameters: the first call has no previous value, so `initial` has its own type
(`TInitial`) which is often `undefined` or an empty array. After the first run `previous` is always a
`TValue`.

Rules for the resolver: it must be pure apart from reading reactive sources, and it must not keep
its own state; the single piece of state is `previous`.

Where it is used: wherever a derived array or object feeds a reference-compared cache (the columns,
row and window composables; see their pages).

---

## `use-model-ref.ts`

### `useModelRef(model, initial)`

```ts
function useModelRef<TValue>(
	model: Ref<TValue> | undefined,
	initial: TValue,
): WritableComputedRef<TValue>
```

Many engine composables accept an optional external model, usually a `defineModel()` from the
component that owns the state (a `v-model`). When it is absent they keep the state themselves. This
helper gives them one `ref` that behaves the same either way.

The subtlety is why it does not just return `model`:

- `defineModel` only returns a newly written value **after the parent re-renders**. If the composable
  writes twice in the same tick (for example two sort toggles from one handler), the second write
  would read the stale value and lose the first change.
- So reads go to a **local `shallowRef` copy**, and writes go to **both** the copy and the model. The
  second write builds on the first.

Details:

| Concern | Behavior |
| --- | --- |
| No model | a plain ref starting at `initial` |
| Model given | local copy starts from `toRaw(model.value)` |
| Model changed from outside | a `watch` with `flush: 'sync'` copies it into the local ref at once, so reads never lag |
| Writes | `local.value = next`, then `model.value = next` if there is a model |
| Depth | shallow: a model is replaced as a whole, never mutated in place |
| Reactive proxies | the copy stores `toRaw(...)`, so a model held in a deep `ref` returns the very object that was written, not a proxy of it |

Returned as a `WritableComputedRef`, so callers use `.value` as with any ref. Used for example by
`cells/use-cell-ranges.ts` for its `ranges` model.

---

## `use-row-token.ts`

### `RowToken<TToken>`

```ts
interface RowToken<TToken> {
	row: string;     // a row key, or any id of a row
	token: TToken;
}
```

Describes "this row currently holds this token": the focused row with its focused column, the edited
row with its edited column.

### `useRowToken(source)`

```ts
function useRowToken<TToken>(source: () => RowToken<TToken> | null): {
	get: (row: string) => TToken | undefined;
}
```

**Problem it solves.** A grid has thousands of rows, and exactly one of them is focused. If every row
reads one shared `focusedCell` ref, every focus move re-renders every row. The state is global but
each row only cares "is it mine, and which column?"

**Solution.** Keep the token in a `shallowReactive(new Map<row, token>)`. Vue tracks `Map.get(key)`
per key, so a row that calls `get(rowKey)` is subscribed only to its own entry. When the token moves
from row A to row B, only A (entry deleted) and B (entry set) wake up; everyone else is untouched.

How the sync works:

- A `watch(source, ..., { flush: 'sync', immediate: true })` mirrors the source into the map. `sync`
  means rows never observe a half-updated state; `immediate` fills the map for the initial value.
- When the row **changes**, the previous row's entry is deleted and the new one is set.
- When the token moves **within the same row** (arrow key to the next column), the entry is only
  overwritten. A delete followed by a set would trigger that row's readers twice; a plain set
  triggers them once.

`get(row)` returns the token for the holder row and `undefined` for every other row, so a template
can write `focused.get(rowKey) === columnKey` and stay cheap.

Where it is used: `cells/use-cell-focus.ts`, `cells/use-grid-focus.ts` and `cells/use-cell-editing.ts`
(see the Cells page once it is written).
