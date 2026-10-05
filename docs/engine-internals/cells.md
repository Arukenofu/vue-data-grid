# `src/cells`: the composables

The top layer of the engine: the models of cells. This page covers the six `use-*.ts` files of the
folder, the only ones with reactivity. The pure functions they are thin wrappers around (addresses,
moves, ranges, edits, paste, fill, CSV) are described in [Cells: pure functions](./cells-pure.md) and
are only linked from here.

```
cells/
  index.ts              public surface of the folder
  use-grid-focus.ts     where focus is, in a grid of sections (header, body, footer)
  use-cell-focus.ts     the same for a body of cells only, addressed by key and column name
  use-cell-ranges.ts    cell range selection: corners, bounds, rectangles, text for the clipboard
  use-cell-editing.ts   which cell is edited and its draft; every write of values into rows
  use-change-history.ts undo and redo of the commits of an editing
  use-cell-changes.ts   recent changes of cell values, for a flash or an arrow
```

All six composables and every type reachable from their signatures are exported from the **root**
(`@vue-data-grid/engine`). None of them is in `internals`; `internals` takes from this folder only
pure helpers (`applyCellEdits`, `replaceRows`, `validateCell`, ...).

Every composable takes a `GridScope` (see the Engine page) and never touches the DOM: rows, row keys,
shown columns, row offsets and scrolling all come through the scope.

---

## How the pieces relate

```
                 GridScope  (rows, rowKeys, columns, getRowIndex, scrollTo*, keepRendered)
                     │
   ┌─────────────────┼──────────────────────────────┬───────────────────────┐
   ▼                 ▼                              ▼                       ▼
useGridFocus     useCellRanges                useCellEditing         useCellChanges
   ▲  (body only)    │  selectBounds / getText      │  write / writeText    (reads scope.rows,
   │                 │  (consumers: paste, fill)    │  lastCommit           writes nothing)
useCellFocus         └──────────────┬───────────────┤
                                    ▼               ▼
                       paste / fill / clear      useChangeHistory
                       (core: resolvePaste,      (watches lastCommit,
                        resolveFill → write)      replays through write)
```

- **Focus** answers "which cell has the keyboard". It is one cell. `useGridFocus` knows sections
  (header rows, body, footer); `useCellFocus` is the body-only view of the same model.
- **Ranges** answer "which cells are selected". They are independent of focus: the engine does not link
  them. A consumer (`useRangeSelection` in `@vue-data-grid/core`) turns focus moves and pointer
  gestures into `select(...)` calls.
- **Editing** answers "which cell is being typed into, and what happens when values are written". It is
  also where *every* write of values goes through one pipeline, whether it comes from an editor, a
  paste, a fill, a cleared selection or an undo. The source is a label on the commit (`'edit'`,
  `'paste'`, `'fill'`, `'clear'`, `'cut'`, `'undo'`, `'redo'`, or your own string).
- **History** is a consumer of editing. It watches `editing.lastCommit`, stores each commit as a step,
  and undoes or redoes by calling `editing.write` again. It needs only `lastCommit` and `write`.
- **Changes** are unrelated to the user's own edits: they compare the rows the grid receives (a stream,
  a server push) with the previous ones to report which cell changed and in which direction. They
  neither write nor read the other models.

Three conventions run through all of them:

1. **Cells are addressed by row key and column name** (`CellAddress`, see
   [cell-address](./cells-pure.md)), not by index, so state follows its row through sorting and
   streaming. Index addressing (`CellPosition`) is used only where position on screen is the point
   (ranges with `corners: 'index'`, hit-testing).
2. **Reactive per row.** State that exactly one row holds is kept in a `useRowToken`
   (see [Shared](./shared.md)), so a move wakes the two rows involved, not every cell that asks.
3. **No markup.** Roles, `tabindex`, key bindings, `element.focus()` and gestures live in
   `@vue-data-grid/core`.

---

## `use-grid-focus.ts`

### `useGridFocus(scope, options?)`

```ts
function useGridFocus(scope: GridScope, options?: GridFocusOptions): {
	focused: ComputedRef<FocusedGridCell | null>;
	focus: (position: GridPosition | null, request?: GridFocusRequest) => boolean;
	move: (to: CellMove, step?: number) => boolean;
	isFocused: (position: GridPosition) => boolean;
}
```

**Problem it solves.** Focus in a grid is not just "a cell of the body". The header and the footer
have focusable cells too, rows get sorted, replaced and virtualized under the focused cell, and a
1000-row grid must not re-render every row when focus moves. This model keeps focus as data, with no
DOM, and solves four things: sections, following a row by key, keeping the focused cell rendered, and
per-row reactivity.

#### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `sections` | one body section built from the scope | `MaybeRefOrGetter<readonly GridSection[]>` from the top: header rows, the body, a footer. The shape is that of `resolveGridMove` (see [grid-move](./cells-pure.md)). |
| `body` | `'body'` | name of the section whose rows are `scope.rows`; cells there are held by row key |
| `onFocus` | none | called after each move, once scrolling is requested; set DOM focus here |

Without `sections`, a computed `defaultSections` builds one section named `body`: `rows` is
`scope.rows.value.length` and `cells` is **every shown column of `scope.columns`**, service columns
included (`getCellColumns(columns, () => true)`), each as `{ key: column.name }`. The array is read
lazily, so the computed re-evaluates only when `rows.length` or the columns change.

#### Types

- `GridPosition` (from `grid-move`): `{ section, row, cell }`, with `row` an index in the section and
  `cell` a cell key (a column name in the body).
- `FocusedGridCell extends GridPosition`: adds `key?`, the row key of a body cell (`undefined` in other
  sections).
- `GridFocusRequest`: `{ reveal?: boolean }`. `reveal: false` records where focus is and does nothing
  else: no scrolling, no `onFocus`. `true` by default.
- Private `FocusTarget extends FocusedGridCell`: adds `cellIndex`, the position of the cell among the
  cells of its section, kept so a move can recover when its column is gone (see below).

#### Returned members

- **`focused`**: the focused cell, `null` without focus and while its row or cell is gone. A
  `stableComputed`: when the recomputed value has the same `section`, `row`, `cell` and `key`, the
  previous object is returned, so dependents wake only on real moves.
- **`focus(position, request?)`**: focuses a cell, or clears focus with `null` (returns `true`).
  Returns `false`, changing nothing, when the section, the row or the cell does not exist.
- **`move(to, step = 1)`**: moves through the sections. Returns `false` for an empty grid.
- **`isFocused(position)`**: whether this cell has focus. Reactive per row.

#### How it works

State is two things: a `shallowRef` **`target`** (where focus was put) and a plain variable **`last`**
(the last cell focus was ever put on, never cleared).

`focus(position, request)`:

1. `null` clears `target` (but not `last`) and returns `true`.
2. Looks the section up and checks the cell exists with `hasCell`: `0 <= row < section.rows` and a
   cell with that key. If not, returns `false`.
3. For the body section, resolves the **row key**: `scope.rowKeys.value[position.row]`. Other sections
   have no key, because header and footer rows are not data.
4. Builds the `FocusTarget` (with `cellIndex`) and writes it to `target` only if something differs, so
   focusing the cell that already has focus triggers nothing.
5. Stores it in `last` unconditionally.
6. With `reveal: false` it stops. Otherwise, for the body section it calls `scope.scrollToRow(row,
   'auto')`, then always `scope.scrollToColumn(cell, 'auto')`, then `options.onFocus` with the
   resulting cell. The DOM may not contain the cell yet (it may be outside the window); that is why
   scrolling is requested *before* `onFocus` and why `keepRendered` below exists.

`focused` resolves the target on every read. A body target has a `key`, so its row is
`scope.getRowIndex(key)` — the **current** index, not the one stored. This is how focus follows a row
through sorting and streaming. Then `hasCell` is checked against the *current* sections; if the row was
removed (`-1`) or the column hidden, the result is `null`. Note that `target` itself is **not cleared**:
if the row comes back (a filter is lifted), focus reappears on it.

**Per-row reactivity.** `isFocused` is built on `useRowToken`: `focusedRows` mirrors the focused cell
into a `Map<rowId, cell>`, and `isFocused(position)` reads only its own row's entry. The row id is
`${row}:${section}`, so it is by **index**, not by key; the token holder moves when focus moves or
when the focused row's index changes. A move wakes only the row it leaves and the row it enters
(and a move within a row only overwrites the entry; see [Shared](./shared.md)).

**Keeping the focused cell rendered.** Row and column windows unmount what is off screen, and an
unmounted focused cell loses DOM focus. On creation the composable registers
`scope.keepRendered({ rows, columns })` with two `stableComputed` lists:

- `keepRows` is `[cell.row]` when the focused cell is in the body section, else an empty list;
- `keepColumns` is `[cell.cell]` for any section, else an empty list.

Both return the previous array when the content is the same (and a shared constant for
the empty case), so the windows do not recompute when focus moves inside the same row or column. The
registration returns a release function that this composable does not call: `keepRendered` releases
itself on `onScopeDispose` when created inside a scope.

**Moving.** `move(to, step)`:

1. `getOrigin(sections)`: if something is focused, that is the origin. If not, it takes `last` and
   *repairs* it: the section must still exist and have cells; the row is `scope.getRowIndex(last.key)`
   (falling back to the old `last.row` index when the key is gone, so the next row at that place
   takes over); and the column is `last.cell` if it still exists, else the cell at the same
   `cellIndex`, clamped to the last cell. So after a focused row is deleted or a focused column is
   hidden, the arrow key continues from where focus was rather than restarting.
2. With an origin, `resolveGridMove(sections, origin, to, step)` computes the target (pure; see
   [grid-move](./cells-pure.md)). With no origin at all (nothing was ever focused), it takes
   `getFirstCell`: the first section with rows whose first cell is not `skip`ped.
3. The result is passed to `focus(next)` with the default request, so a move always reveals.

`step` is "how many rows `up` and `down` go"; PageUp and PageDown pass
`scope.getPageStep(row, direction)`.

#### Invariants and edge cases

- Body focus is kept by **key**; header and footer focus by index. `FocusTarget.key` is the switch.
- `focus` validates against the sections as they are *now*; `focused` re-validates on every read. A
  stale target never produces a stale `focused`.
- `last` survives `focus(null)` on purpose, so `Escape`-then-arrow resumes near the old place.
- `defaultSections` includes service columns, unlike `useCellRanges`, which excludes them by default:
  checkbox and expander cells are focusable, but not selectable as data.
- The composable does not own DOM focus, `tabindex` or key bindings.

#### Reference stability

`focused`, `keepRows` and `keepColumns` return the previous reference when nothing changed.

#### Where it is used

Checked with Grep:

- `packages/engine/src/cells/use-cell-focus.ts`: `useCellFocus` is built on it.
- `packages/core/src/navigation/use-cell-navigation.ts`: `useCellNavigation` creates it with the grid's
  `sections` and `body`, and binds the keys, `tabindex` and `element.focus()` around it.
- `packages/engine/tests/cells/use-grid-focus.spec.ts` (and the core navigation tests through the
  navigation).

---

## `use-cell-focus.ts`

### `useCellFocus(scope, options?)`

```ts
function useCellFocus(scope: GridScope, options?: CellFocusOptions): {
	focused: ComputedRef<FocusedCell | null>;
	isFocused: (cell: CellAddress) => boolean;
	getFocusedColumn: (key: string) => string | undefined;
	focus: (target: CellAddress | null, request?: CellFocusRequest) => boolean;
	move: (to: CellMove, step?: number) => boolean;
}
```

**Problem it solves.** A grid that has only body cells (no header or footer navigation) wants the
simplest address: row key and column name. `useGridFocus` speaks in sections and row indexes.
`useCellFocus` is a **thin adapter** over `useGridFocus`: one default body section, no `sections`
option, and `CellAddress` in and out.

#### Options

- `onFocus(cell: FocusedCell)`: after each move, with the cell as `{ key, column, index }`. It is called
  only for a cell with a `key`; the adapter filters anything else out.

#### Types

- `FocusedCell extends CellAddress, CellPosition`: `{ key, column, index }`: both addresses of the
  focused body cell, the key of its row and its index in `rows`.
- `CellFocusRequest` is an alias of `GridFocusRequest` (`{ reveal? }`).
- `CellFocus` is `ReturnType<typeof useCellFocus>`.

#### Returned members

- **`focused`**: `computed` mapping the underlying focused cell to `FocusedCell` (`row` becomes `index`,
  `cell` becomes `column`); `null` while the row is removed or the column hidden.
- **`isFocused(cell)`** and **`getFocusedColumn(key)`**: reactive per row. `getFocusedColumn` returns the
  focused column of the row with this key and `undefined` for every other row; it is meant as a **memo
  token** of the row (a changed token re-renders the row).
- **`focus(target, request?)`**: `null` clears. Otherwise resolves `scope.getRowIndex(key)` and delegates
  to `grid.focus({ section: 'body', row, cell: column }, request)`. `false` when the row is missing or
  the column is not shown.
- **`move(to, step?)`**: delegates to `grid.move`. Without focus the first move lands on the first cell.

#### How it works

1. It creates `useGridFocus(scope, { onFocus })` with default sections and body.
2. `focused` recomputes only when the underlying stable `focused` changes. Since that one is
   reference-stable, this computed is too, in effect: it produces a fresh object only on a real change.
3. It makes **its own** `useRowToken` keyed by the **row key** (the underlying grid one is keyed by
   index). That is what makes `isFocused({ key, column })` cheap and key-based.

#### Invariants and edge cases

- `isFocused` and `getFocusedColumn` take a key, so they are right when the focused row is re-sorted.
- Everything about windows, `keepRendered`, repairing the origin after a removed row and `reveal` is
  inherited from `useGridFocus`.
- Cells come from `scope.columns`, so, as in `useGridFocus`, service columns are focusable.

#### Where it is used

Checked with Grep: `useCellFocus` is exported and documented (`docs/content/composables/core.md`), and
used in tests (`packages/core/tests/ranges/use-range-selection.spec.ts`,
`packages/core/tests/clipboard/use-clipboard.spec.ts`, `packages/engine/tests/cells/use-cell-focus.spec.ts`).
In the source of `@vue-data-grid/core` it is only mentioned in doc comments
(`navigation/body-cell-focus.ts`, `ranges/use-range-selection.ts`) as the alternative to the
navigation's `cells`; no runtime code there creates it. A grid built with `useDataGrid` navigates
through `useCellNavigation`, which uses `useGridFocus` directly.

---

## `use-cell-ranges.ts`

### `useCellRanges(scope, options?)`

```ts
function useCellRanges(scope: GridScope, options?: CellRangesOptions): {
	selectedRanges: ComputedRef<readonly CellRange[]>;
	columns: ComputedRef<RuntimeColumn[]>;
	grid: ComputedRef<CellGrid>;
	bounds: ComputedRef<readonly RangeBounds[]>;
	rects: ComputedRef<readonly RangeRect[]>;
	toRect: (bounds: RangeBounds) => RangeRect | null;
	edgeAt: (cell: CellPosition) => RangeEdge;
	resolveEdge: (edge: RangeEdge) => CellPosition | null;
	select: (edge: RangeEdge, mode?: RangeSelectMode) => void;
	selectBounds: (bounds: RangeBounds) => void;
	selectAll: () => void;
	clear: () => void;
	isSelected: (cell: CellAddress | CellPosition) => boolean;
	getSelectedColumns: (index: number) => ReadonlySet<string>;
	getCells: (items?: readonly RangeBounds[]) => CellAddress[];
	getText: (text?: RangeTextOptions) => string;
}
```

**Problem it solves.** Spreadsheet-style selection has several hard parts: a range must survive
sorting and streaming (or must not, by choice); several ranges at once with Ctrl; Ctrl-drag that adds
or *cuts out* cells; the overlay must follow column resize, pinning and measured row heights without
re-rendering cells; and 5000 cells inside a range must not each subscribe to the whole selection.
This model separates **what the user selected** (`CellRange`, with corners) from **what that currently
covers** (`RangeBounds`, indexes), derives the rest, and keeps every derivation reference-stable.

Gestures (pointer, keyboard), the overlay markup and the clipboard write are not here;
`useRangeSelection` in `@vue-data-grid/core` calls `select`, `selectBounds` and friends.

#### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `ranges` | internal | an external `Ref<readonly CellRange[]>` for `v-model` |
| `canSelectColumn` | data columns | `(column) => boolean`: which shown columns ranges span, so service columns are left out by default |
| `corners` | `'key'` | what `edgeAt`, and so every corner the composable creates, is addressed by: `'key'` keeps a range on its rows through sorting and streaming; `'index'` keeps it in its place on screen. Read **once**. |

#### Types

- `RangeSelectMode`: `'replace' | 'extend' | 'add' | 'subtract'`.
- `RangeCorners`: `'key' | 'index'`.
- `RangeTextOptions`: `{ headers?: boolean }`.
- `RangeRect`: `{ bounds, top, height, cells }`; the range as a block to position. `top` and `height` are
  px; `cells` is a row across the grid from `scope.getColumnSpan`, where the cells with `inside` are the
  range (one per pin side it crosses) and the others hold the place of the columns around it.
- `CellRange`, `RangeBounds`, `RangeEdge`: see [cell-range](./cells-pure.md).
- `CellRanges` is `ReturnType<typeof useCellRanges>`.

#### Core derivations (in order)

1. **`ranges`**: `useModelRef(options.ranges, NO_RANGES)` (see [Shared](./shared.md)). This is why an
   external `defineModel` can be given: writes go to a local copy and to the model, so two writes in
   one tick build on each other.
2. **`columns`**: `getCellColumns(scope.columns.value, canSelectColumn)`. These are the columns ranges
   span, in display order. `scope.columns` is the *shown* columns before the column window, so a range
   stays whole while columns scroll out of the window.
3. **`grid`** (`CellGrid`): `{ keys: scope.rowKeys.value, columns: names }`, a `stableComputed` that
   keeps the previous object while `keys` is the same array and the column names are equal. The
   indexes of every `RangeBounds` are indexes into this grid.
4. **`bounds`**: `ranges.flatMap(range => getRangeBounds(range, grid.columns, rows.length, getRowIndex) ?? [])`.
   Each range becomes bounds in the current indexes; a range whose corner is gone (row removed, column
   hidden) yields `null` and is skipped. A `stableComputed` returns the previous array while all
   bounds cover the same cells. **This is the key stability step**: a new row of data under the same
   selection, or an unrelated cell change, changes nothing downstream.
5. **`rects`**: for each bounds, `toRect` gives `{ bounds, top, height, cells }` using
   `scope.getRowOffset` and `scope.getColumnSpan` with the first and the last column. `top = getRowOffset(rowStart)`
   and `height = getRowOffset(rowEnd) - top`, so measured row heights are respected. A `stableComputed`
   reuses the previous *rect object* when `isSameRect` (same bounds, `top`, `height` and the same
   `cells` array); the list itself is reused when every item is. Drawing ranges from `rects` as a single
   overlay re-renders no cell.
   `toRect` is also public, for rectangles that are not ranges (the target of a fill). It returns
   `null` when a column is gone.

#### Per-row reactivity

`getSelectedColumns(index)` returns the names of the cells in any range in the row at `index`, as a
`ReadonlySet`. For each asked row a `stableComputed<ReadonlySet<string>>` is cached in
`rowColumns: Map<index, ComputedRef>` and returns the **same set** while its content holds
(`isSameSet`), so it is a memo token of the row and a computed dependency that changes only when a
cell of that row enters or leaves a range. `collectColumns` walks `bounds` and unions column names of
every bounds whose rows include the index; with no match it returns the shared `NO_COLUMNS`.

The cache is bounded: when it reaches `ROW_CACHE_LIMIT` (512, "rows asked about at once are the
rendered ones") it is cleared whole. Clearing costs a recomputation and nothing else, because the
computeds only exist to share work among the cells of one row.

`isSelected(cell)` takes either address: for a `CellAddress` it resolves the row with
`scope.getRowIndex(key)`, for a `CellPosition` it uses `index`; `-1` means "not selected". Then
`getSelectedColumns(index).has(column)`.

#### Corners

- **`edgeAt(cell)`**: builds a corner for a cell on screen. With `corners: 'key'` and a row key at that
  index it returns `{ key, column }`; otherwise `{ index, column }`.
- **`resolveEdge(edge)`**: the cell a corner stands on now, as `CellPosition`, or `null` when its row
  or column is gone. An index past the last row is clamped to the last row
  (`Math.min(getEdgeRow(...), rows.length - 1)`); a negative result (row key gone, or no rows) gives
  `null`.
- **`toRange(bounds)`** (private): a range over bounds, with corners made by `edgeAt`: the top-left
  and bottom-right cells.

#### Selecting

`select(edge, mode = 'replace')`:

| Mode | Result |
| --- | --- |
| `replace` | `[ { anchor: edge, focus: edge } ]` |
| `extend` | drags the last range to `edge` (see below) |
| `add` | `addRange(current, {edge, edge})`: appends the new range and drops ranges the new one fully covers (`containsRangeBounds`) |
| `subtract` | `subtractRange(current, {edge, edge})`: cuts every range it meets into the rectangles left around it (`subtractRangeBounds`, then `toRange`); a range the cut does not touch is kept as the same object |

`extend` with no ranges at all falls back to a plain `replace`. `extend` on a last range whose anchor
corner is gone (`resolveEdge(last.anchor)` is `null`) starts over: the anchor becomes `edge`.

**The gesture.** Ctrl-click then drag is a *gesture*: `add` or `subtract` followed by `extend`
calls that must grow or shrink the *same* addition or cut. A private `gesture` records the mode, the
ranges `base` it started from, its first corner `anchor`, and `written`, the exact array it wrote.
On the next `select`:

1. `pending = gesture?.written === current ? gesture : null`. The identity check means the gesture
   continues only if nobody replaced `ranges` since (including from outside through the model).
2. `gesture` is reset to `null`.
3. `extend` with a `pending` gesture re-applies the stored mode on the stored base with the new
   corner, so a range the addition grows over drops out, a cut grows, and both come back as the
   drag shrinks.
4. Any other call starts afresh.

`selectBounds(bounds)` replaces the ranges with one over given bounds (for example the cells a paste
wrote) and resets the gesture. `selectAll()` replaces with one range from `{ index: 0, first column }`
to `{ index: PAST_LAST_ROW, last column }` (`Number.MAX_SAFE_INTEGER`): corners **by index**, past the
last row, which is clipped to the last row, so "all" keeps meaning "all rows" through sorting and
rows that arrive later. It does nothing without rows or columns. `clear()` writes `NO_RANGES` only
when there is something to clear, so an empty selection stays the same reference.

#### Reading cells and text

- **`getCells(items = bounds.value)`**: the cells of the bounds, each once, as `CellAddress[]` by row key
  (`getRangeCells`; see [cell-range](./cells-pure.md)).
- **`getText({ headers })`**: the **last range** as tab-separated text, through `toCsv` (see
  [csv](./cells-pure.md)) with `delimiter: '\t'`, the range's own columns and rows, `includeService: true`
  (the columns are already the ones ranges span), `headers` false by default and
  `escapeFormulas: false`. Values go through `format` as they are shown. `''` without a selection.
  Only the last range is copied, because a spreadsheet cannot paste several at once.

#### Invariants and edge cases

- Corner kinds can be mixed in the `ranges` model (a model may be set from outside). Every function
  resolves corners through `getEdgeRow`.
- `corners` is read once at creation; it does not react.
- A range in the model is data, not bounds: sorting changes `bounds` (for `'key'`) but not `ranges`.
  A range with a missing corner stays in `ranges` and is skipped in `bounds`; if the row returns, the
  range returns.
- The model is replaced as a whole, never mutated.
- Writes by `useModelRef` store `toRaw` values, so a model in a deep `ref` returns the written object.

#### Reference stability

`grid`, `bounds`, `rects`, each row's `getSelectedColumns` and `rects` items are `stableComputed`.
`selectedRanges` is `computed(() => ranges.value)`, the model's own array.

#### Where it is used

Checked with Grep:

- `packages/core/src/data-grid/features.ts`: `useGridRanges` creates it and wraps it with
  `useRangeSelection` (gestures).
- `packages/core/src/ranges/use-range-selection.ts`: `select`, `selectBounds`, `selectAll`,
  `edgeAt`, `resolveEdge`, `isSelected`, `bounds`, `grid`.
- `packages/core/src/ranges/use-grid-fill.ts`: `grid`, `selectBounds`, `bounds`, `toRect` (the fill preview).
- `packages/core/src/clipboard/use-clipboard.ts`: `getText`.
- `packages/core/src/components/grid-body.ts`: `getSelectedColumns` per row.
- `packages/core/tests/support/browser-grid.ts`, and the engine tests.

---

## `use-cell-editing.ts`

### `useCellEditing(scope, options)`

```ts
function useCellEditing<TRow = unknown>(
	scope: GridScope<TRow>,
	options: CellEditingOptions<TRow>,
): {
	cell: ComputedRef<EditingCell<TRow> | null>;
	lastCommit: Readonly<Ref<CellCommit<TRow> | null>>;
	canEdit: (cell: CellAddress) => boolean;
	isEditing: (cell: CellAddress) => boolean;
	getEditingColumn: (key: string) => string | undefined;
	start: (address: CellAddress, init?: CellEditStart) => boolean;
	setDraft: (value: unknown) => void;
	setText: (text: string, draft?: unknown) => void;
	commit: () => boolean;
	cancel: () => void;
	write: (writes: readonly CellWrite[], source: CellEditSource) => CellWriteResult<TRow>;
	writeText: (cells: readonly CellTextWrite[], source: CellEditSource) => CellWriteResult<TRow>;
	findEditable: (from: CellAddress, step: 1 | -1, grid?: CellGrid) => CellAddress | null;
}
```

**Problem it solves.** Two jobs that look different but share rules. (1) *A session*: one cell is open
in an editor with a draft, an error and a commit or cancel. (2) *Writes*: values land in rows from the
editor, a paste, a fill, a cleared selection or an undo. Both must respect the same column rules
(`editable`, `setValue`, `validate`, `parse`, `equals`), must not mutate the user's rows, and must
give the application one place to apply and save changes. The rows stay the application's: the
composable computes **new row objects** and hands them to `onCommit`.

A cell can be edited when its column is shown, `editable` for the row and has `setValue`
(`canEditCell`, see [cell-edit](./cells-pure.md)).

#### Options

| Option | Meaning |
| --- | --- |
| `onCommit(commit)` | **required**. Writes a commit into your rows (for example `rows.value = commit.apply(rows.value)`) and saves it. |
| `onBeforeCommit(request)` | called before every commit with `{ edits, source }`. Return edits to commit instead (values corrected, some left out), or `false` to commit none. Returned edits are checked like written ones. |
| `onWrite(result)` | called after every write with what it did, skipped and invalid included (such as to tell the person a paste left read-only cells alone). |
| `invalid` | `'block'` (default) keeps a cell with an invalid draft in editing with its error on commit; `'revert'` ends editing and keeps the old value. |

#### Types

- `CellEdit<TRow>` (from `cell-edit`): `{ key, column, row, before, after }`, a cell a commit changes with
  its row before the commit.
- `CellCommit<TRow>`: `{ edits, source, rows, apply }`. `rows` is the new object of each changed row
  by row key (through the columns' `setValue`); `apply(list)` returns `list` with each changed row
  replaced by its new object, or the same array when none is in it. `apply` is declared as a method on
  purpose, so its parameter stays bivariant and a commit of any rows fits `CellCommit`.
- `CellWriteResult<TRow>`: `{ source, commit, skipped, invalid }`. `commit` is `null` when nothing
  changed or `onBeforeCommit` refused it. `skipped` lists writes left out because the cell cannot be
  edited, its row or column is gone, or it no longer holds `expected`. `invalid` lists
  `InvalidCellWrite` (`{ write, error }`) refused by `validate`.
- `CellCommitRequest<TRow>`: `{ edits, source }`.
- `CellEditStart`: `{ text?, draft? }`; what editing starts with.
- `EditingCell<TRow> extends CellAddress`: `{ index, row, value, draft, text?, error }`. `value` is what
  the cell holds, `draft` what a commit writes, `text` the text as typed (when the draft comes from
  text), `error` what `validate` says of the draft or `null`.
- `CellEditing<TRow>` is `ReturnType<typeof useCellEditing<TRow>>`.
- `CellEditSource`, `CellWrite` (`{ key, column, value, expected? }`) and `CellTextWrite`
  (`{ key, column, text }`) are in [cell-edit](./cells-pure.md).

#### State

- `target`: `shallowRef<EditTarget | null>` with `{ key, column, draft, text? }`: only what the user
  changes. Everything else is derived.
- `lastCommit`: `shallowRef<CellCommit | null>`, exposed through `shallowReadonly`.
- `editingRows`: `useRowToken` of `{ row: key, token: column }`, for `isEditing` and
  `getEditingColumn`.

#### The editing session

**`cell`** is a `stableComputed` over `target` and the live rows and columns. It returns `null` when
there is no target, or when the row (`findRow`) or the column (`getColumn`) is gone; otherwise
`{ key, column, index, row, value, draft, text, error }`, where `index` and `row` are the
**current** row, `value` is `column.value(row)` and `error` is `validateCell(column, draft, row)`.
`isSameEditingCell` compares every field (`Object.is` on `value` and `draft`) so the object is stable
until something in it really changes. Because it depends on the row, a streaming update to the
edited row refreshes `value` and `row` but keeps the draft.

**It closes itself.** `watch(cell, next => !next && close(), { flush: 'sync' })`: when the edited row
disappears or its column is hidden, `target` is cleared immediately. Without this, editing would
resurrect when the row came back. (Contrast with focus, which deliberately keeps its target.)

**`canEdit(address)`**: row found, column found and `canEditCell`.

**`getColumn(name)`** takes `scope.getColumn(name)?.column`, so only shown columns exist for editing;
in development it warns once per column when `editable` has no `setValue`.

**`start(address, init = {})`**:

1. If the cell cannot be edited, `false`.
2. If a cell is being edited it is committed first: `commit()`. If that fails *and* editing is still
   open (an invalid draft under `'block'`), returns `false` and the old cell stays. Under
   `'revert'` the old cell ends and the new one starts.
3. The row and column are looked up **again**, because the commit may have changed the row (`onCommit`
   runs synchronously) and the new cell starts from the row as the commit leaves it.
4. The draft (`getStartDraft`): `init.draft` if the key `draft` is present (so `draft: undefined` is a
   valid explicit draft); else `column.parse(init.text, row)` if `text` is given (the key typed on a
   cell); else `column.value(row)`. `text` is stored too.

**`setDraft(value)`** sets the draft of a value (a choice in a list) and clears `text`.
**`setText(text, draft?)`** sets the draft from text through `column.parse` or from `draft` when given
and keeps the text as typed (a text editor shows `1.` even if the number parses to `1`). Passing
`undefined` as `draft` means "parse the text". Both are no-ops without a session.

**`commit()`**:

1. No cell: closes, returns `true`.
2. Error: under `'revert'` closes; returns `false` (under `'block'` the cell stays open).
3. Otherwise **closes first**, then `write([{ key, column, value: draft }], 'edit')`, returns `true`.
   Closing first means the new rows from `onCommit` do not meet a live session. `true` does not mean
   a commit happened: the write may find nothing to change, or be refused by `onBeforeCommit`.

**`cancel`** is `close`. **`isEditing(address)`** and **`getEditingColumn(key)`** are per-row reactive
reads of `editingRows`; `getEditingColumn` is a memo token.

#### Writes

`write(writes, source)` is the single pipeline. Steps:

1. **One write per cell** (`toSingleWrites`): the last write of a cell wins, at the place of its first.
   This is why a commit never has two edits of one cell, which also makes undo order-free.
2. **`toEdits`**: for each write, `toEdit` finds the row and column (a per-call `createColumnLookup`
   caches the column lookup, with its dev warning, once per name), and returns:
   - `null` → pushed to `skipped`: the cell cannot be edited, the row or column is gone, or
     `'expected' in write` and the cell no longer holds `expected` (by the column's `equals`);
   - `undefined` → dropped silently: the cell already holds the value (`isSameCellValue`);
   - a `CellEdit` `{ key, column, row, before, after }` otherwise.
3. **`onBeforeCommit`**, only when there are edits. `false` ends the write with `commit: null`. A
   returned list is turned back into writes (`value: edit.after`) and run through `toEdits` again
   (so cells that cannot be edited are skipped, and edits with an unchanged value fall out). `void`
   keeps the edits.
4. **Validation**: each edit's `after` through `validateCell`; refused ones go to `invalid` with the
   error, and the rest stay as `valid`. Validation runs *after* `onBeforeCommit`, so corrected values
   are validated.
5. **`applyCellEdits(valid, lookup)`** (pure, see [cell-edit](./cells-pure.md)) builds the new rows map by
   key; edits of one row build on each other.
6. **`settleEdits`**: re-reads `after` from the *new* rows via `column.value`, because `setValue` may
   trim, round or clamp. Edits that changed nothing in the new row are dropped. `after` in the commit
   is therefore what the cell really holds. If nothing is left, `commit: null`.
7. **`createCommit`**: `rows` keeps the new row per key, and `apply` is `replaceRows` over an
   `old row → new row` map.
8. `onCommit(commit)`, then `lastCommit.value = commit`, then `onWrite(result)`; the result is returned.

`onWrite` is called for every write, with a `commit` or without. `onCommit` runs only for a real
commit.

`writeText(cells, source)` maps each `{ key, column, text }` to a value through
`parseText(column, text, row)` and calls `write`. `parseText` uses `column.parse(text, row)`, or
returns the text as is. In development, a column without `parse` whose current value is not text
(`string`, `null`, `undefined`) warns once: pasted or cleared text would be stored as text next to
non-text values.

#### `findEditable(from, step, grid?)`

The next editable cell after `from`, or the previous with `step: -1`, moving along the rows as Tab
does (end of a row goes to the next row). It scans at most the rest of the current row and the whole
next one (`seen < count * 2`) and returns `null` when none is found. `grid` defaults to
`{ keys: scope.rowKeys.value, columns: shown data column names }`. It returns `null` immediately when
`from` is not in the grid. The scan is bounded to O(columns) `canEdit` checks; the one linear
operation is `keys.indexOf(from.key)`, once per call.

#### Invariants and edge cases

- Rows are never mutated. `setValue` (applied by `applyCellEdits`) returns new objects.
- `cell` is `null` the moment its row or column disappears, and the session ends with it.
- `commit()` always ends the session when it returns `true`, even if the write changed nothing.
- `expected` is how undo avoids overwriting newer data; see below.
- The module-level `warned` is a `Set` of `problem + column name` keys, dev-only and shared by
  grids (a warning says it all once); it is the one allowed form of module state.
- `__DEV__` guards both warnings.

#### Reference stability

`cell` is a `stableComputed`. `lastCommit` is a new object per commit, which is what a watcher needs.
A commit's `edits`, `rows` and `apply` are created once per commit.

#### Where it is used

Checked with Grep:

- `packages/core/src/editing/use-grid-editing.ts`: creates it; uses `cell`, `start`, `commit`,
  `cancel`, `write`, `writeText` (paste and clear), `findEditable` (Tab), `canEdit`, `setDraft`,
  `setText`; the grid's `isEditing`/`getEditingColumn` come from it (`data-grid/use-data-grid.ts`,
  `components/grid-body.ts`).
- `packages/core/src/editing/use-grid-history.ts`: passes the grid's editing to `useChangeHistory`.
- `packages/core/src/ranges/use-grid-fill.ts`: `write(writes, 'fill')`.
- `packages/core/src/clipboard/use-clipboard.ts`: through the grid's editing, for paste.

---

## `use-change-history.ts`

### `useChangeHistory(editing, options?)`

```ts
function useChangeHistory<TRow = unknown>(
	editing: Pick<CellEditing<TRow>, 'lastCommit' | 'write'>,
	options?: ChangeHistoryOptions,
): {
	canUndo: ComputedRef<boolean>;
	canRedo: ComputedRef<boolean>;
	steps: ComputedRef<readonly ChangeStep[]>;
	undo: () => CellWriteResult<TRow> | null;
	redo: () => CellWriteResult<TRow> | null;
	clear: () => void;
}
```

**Problem it solves.** Undo for a grid whose rows belong to the application and may change under it
(streams, servers). Snapshots of rows would restore stale data; this history stores **values by
address** and writes them back only where nothing has changed since.

#### Options and types

- `limit`: `MaybeRefOrGetter<number>`, how many steps undo keeps; `100` by default, `0` keeps none.
- `ChangeStep`: `{ source, edits }`, one commit.
- `ChangeStepEdit extends CellAddress`: `{ key, column, before, after }`.
- `ChangeHistory<TRow>` is `ReturnType<typeof useChangeHistory<TRow>>`.

The first parameter is `Pick<CellEditing, 'lastCommit' | 'write'>`: any object with those two members
works, not only the one `useCellEditing` returns.

#### How it works

State: two `shallowRef` arrays, `done` and `undone` (the redo stack), both replaced rather than
mutated.

**Recording.** `watch(editing.lastCommit, ..., { flush: 'sync' })`:

1. Ignores `null` and commits whose `source` is `'undo'` or `'redo'`, so replays are not steps.
2. Turns the commit into a `ChangeStep`: only `key`, `column`, `before` and `after` of each edit. It does
   **not** keep `row`, so rows are not held in memory.
3. `done = [...done, step].slice(-limit)` (`limit` is `Math.max(toValue(limit) ?? 100, 0)`, read at
   commit time; `0` gives `[]`), and `undone` is cleared: a new edit ends the redo branch.

`flush: 'sync'` means the step is recorded inside the write, before the caller sees the result, and a
second commit in the same tick is never lost to batching. A whole paste or fill is one commit and so
one step.

**Replaying.** `replay(step, 'undo' | 'redo')` calls `editing.write` with one write per edit:

| | `value` | `expected` |
| --- | --- | --- |
| undo | `edit.before` | `edit.after` |
| redo | `edit.after` | `edit.before` |

`expected` is the guard: the write goes through only if the cell still holds what the step left
there (by the column's `equals`). A cell changed since (a stream, the server, another edit) or a row
that is gone is reported in the result's `skipped` instead of being overwritten with an old value. The
source is `'undo'` or `'redo'`.

**`undo()`** pops the last step from `done`, pushes it to `undone` and replays. **`redo()`** is the
mirror. Both return the `CellWriteResult` of the write, or `null` with nothing to undo/redo.

**`clear()`** empties both stacks (such as after loading another data set).

#### Invariants and edge cases

- The step is **moved before the write**: even if every cell is skipped, or `onBeforeCommit` refuses the
  replay, the step has left the stack. The result's `skipped` is where the caller sees it.
- The replay's own commit comes back through `lastCommit` with a source of `'undo'`/`'redo'` and is
  ignored. That is why the sources are reserved (see `CellEditSource`).
- Only commits made *after* the history is created are recorded.
- A commit has at most one edit per cell (see `toSingleWrites`), so replay order inside a step does not
  matter.
- Lowering `limit` does not trim existing steps until the next commit; the redo stack is not trimmed.

#### Reference stability

`steps` is `computed(() => done.value)`: the stack's own array, replaced on each change, so it is a
cheap dependency. The edits of a step are fresh objects but never change afterwards.

#### Where it is used

Checked with Grep:

- `packages/core/src/editing/use-grid-history.ts`: `useChangeHistory(grid.editing, historyOptions)`,
  with key bindings calling `undo` and `redo`.
- `packages/engine/tests/cells/use-change-history.spec.ts` (with `useCellEditing`).

---

## `use-cell-changes.ts`

### `useCellChanges(scope, options?)`

```ts
function useCellChanges(scope: GridScope, options?: CellChangesOptions): {
	getChanges: (key: string) => Readonly<Record<string, CellChange>> | undefined;
	getChange: (key: string, column: string) => CellChange | undefined;
	clear: () => void;
}
```

**Problem it solves.** Live data: a price ticks, a cell should flash green or red and then rest. The
grid needs to know *which* cell changed, in *which direction*, and for how long, without every row
re-rendering for every tick, and without keeping a copy of the whole data set.

#### Options and types

| Option | Default | Meaning |
| --- | --- | --- |
| `duration` | `1000` | `MaybeRefOrGetter<number>`, ms a change is kept |
| `columns` | shown data columns | `MaybeRefOrGetter<readonly string[] | undefined>`, names of columns to watch |

- `CellChangeDirection`: `'up' | 'down'`.
- `CellChange`: `{ direction, at }`. `direction` is by the column's `compare`, else `compareValues`,
  comparing the **new** value to the old; `null` when the old or new value is empty
  (`isEmptyValue`) or they compare equal. `at` is `Date.now()` at arrival: a key that restarts a CSS
  animation when the cell changes again.

#### How it works

State: `changes`, a `shallowReactive(Map<rowKey, frozen Record<columnName, CellChange>>)`, plus two
plain variables: `seen`, a `Map<rowKey, row>` of the last row object seen for each key, and `timer`.

**Detecting** (`record`, run by `watch(scope.rows, record, { immediate: true })`):

1. `keys = scope.rowKeys.value`, columns from `getColumns()`, `now = Date.now()`.
2. For each row at `index`, `key = keys[index]`, `previous = seen.get(key)`.
3. **Same object as before → skip.** This is the cost model: a row that stays the same object is O(1).
   It pairs with `useRowStream` and immutable updates, where only changed rows arrive as new objects.
4. Otherwise `seen.set(key, row)`. **No previous → new row, not a change**; nothing is recorded. This is
   also how the immediate first run just seeds `seen`.
5. For each watched column: `before = column.value(previous)`, `after = column.value(row)`; equal by the
   column's `equals` (else `Object.is`) → skip. Otherwise the row's entry is created (`{ ...changes.get(key) }`,
   so unexpired changes of **other** columns in that row are kept) and the column gets
   `{ direction: getDirection(...), at: now }`. A second change of the same column overwrites the first.
6. A row with changes gets a new `Object.freeze`d entry via `changes.set(key, entry)`.
7. **Forgetting removed rows.** If `seen.size > rows.length` (some key is stale), `seen` is rebuilt
   from the current `keys` and `rows`. Without it, keys of removed rows would pile up under a stream
   of new ones.
8. If anything changed and no timer is pending, a timer is armed with `duration`.

`getColumns()`: without `options.columns` it is `getCellColumns(scope.columns.value)`, the shown data
columns; with names, `scope.orderedColumns` filtered by those names and converted with
`toRuntimeColumn`. Note the second form searches *all* declared columns, so a hidden column can be
watched. The columns are resolved at each `record`, not reactively; the watcher is on the rows only.

The `watch` has the default flush, so several updates to `scope.rows` within one tick are compared
once against the last row seen, not one by one.

**Expiring** (`expire`, one timer, not one per cell):

1. For every entry, keep the columns where `now - at < duration` and note the soonest future expiry.
2. An entry with removed columns and some left is replaced by a new frozen object; with none left it is
   deleted; an untouched entry is left alone (same reference, no notification).
3. If any change remains, re-arm the timer for `soonest - now`. Otherwise `timer` stays `null`, and the
   next recorded change arms it.

A change arriving while the timer is pending does not re-arm it; `expire` finds it through `next`.
`duration` is read when a timer is armed and when it fires, not continuously.

**`clear()`** empties the map and cancels the timer. It does not touch `seen`, so the next update to a row
compares against the data it knew. `onScopeDispose` cancels the timer.

#### Returned members

- **`getChanges(key)`**: the row's changes by column name, or `undefined` without any. One frozen object
  while they hold, so it is a **memo token** of the row.
- **`getChange(key, column)`**: one cell's change.
- **`clear()`**.

#### Reactivity and stability

`changes` is a `shallowReactive` map, and `Map.get(key)` is tracked per key: reading
`getChanges(key)` subscribes a row only to its own entry. A change in another row does not wake it.
An entry object is replaced only when it gains or loses a column; an untouched row keeps the same
reference.

#### Invariants and edge cases

- New rows (no entry in `seen`) and rows that return after being removed are not changes.
- If a row key is reused for different data, it is treated as an update of the same row.
- Time is `Date.now()`, so it is not suitable for a fake clock unless the test fakes `Date` as well as
  timers.
- It renders nothing: a flash or an arrow is up to the markup, reading `getChange`.
- No timer is created until the first change, so creating it on the server does nothing.

#### Where it is used

Checked with Grep: the documentation demos `docs/demos/live-data/index.vue`,
`docs/demos/example-screener/index.vue` and `docs/demos/render-count/index.vue` (imported from
`@vue-data-grid/core`, which re-exports the engine), and the guides that describe them
(`docs/content/guides/live-data.md`, `docs/content/composables/core.md`). No runtime code in
`packages/core/src` creates it; it is opt-in for the application.
