# `src/engine`

The composition layer. Everything below it is a separate piece: column models (`columns`), render
helpers and geometry (`render`), row keys (`rows`), column groups, row and column windows
(`virtual`). This folder wires them into one object, `GridScope`, which is all the markup needs to
draw a grid. Only `cells` sits above it.

```
engine/
  index.ts                  public surface of the folder
  fit-columns.ts            fitColumnWidths: share a width among columns within their limits
  scope.ts                  GridScope, KeepRendered, RowRange, GRID_SCOPE
  use-grid-columns.ts       useGridColumns: layout -> shown columns, widths, geometry, layout actions
  use-grid-engine.ts        useGridEngine: the assembly of the whole engine
  use-grid-scope-context.ts createGridScopeContext / useGridScopeContext (provide / inject)
```

Exports in the root (`src/index.ts`): `useGridEngine`, `createGridScopeContext`,
`useGridScopeContext`, `GRID_SCOPE`, and the types `GridScope`, `GridEngineOptions`,
`VirtualOptions`, `KeepRendered`, `RowRange`, `ColumnsInsets`. In `internals.ts`: `useGridColumns`,
`fitColumnWidths` and the type `FitColumn`. Nothing is exported twice (`tests/entries.spec.ts`).

The reading order that works best: `scope.ts` (what comes out), `use-grid-columns.ts` (the biggest
piece), `use-grid-engine.ts` (how everything is put together).

---

## `fit-columns.ts`

A pure function with no Vue; it backs `scope.fitColumns`.

### `FitColumn`

```ts
interface FitColumn {
	name: string;
	width: number;      // current width, px
	minWidth: number;
	maxWidth?: number;
}
```

### `fitColumnWidths(columns, available)`

```ts
function fitColumnWidths(columns: readonly FitColumn[], available: number): Record<string, number>
```

**Problem it solves.** "Make the columns fill the viewport": stretch or shrink them in proportion to
their current widths, without breaking `minWidth` / `maxWidth`, and end with whole pixels that add up
to the available space. Proportional scaling alone breaks as soon as one column hits a limit: the
pixels it cannot take have to go to the others.

How it works (a loop over `pending`, which starts as all columns, with `space = available`):

1. `total` is the sum of the pending widths; `scale = space / total` (`0` when `total` is `0`).
2. `clampToBounds(column, column.width * scale)` is the private helper that returns the limit
   (`minWidth` or `maxWidth`) when the scaled width is outside the bounds, and `null` when it is
   inside. Columns that return a limit are the `bounded` ones.
3. **No bounded columns**: everyone fits. Each width is `Math.floor(width * scale)`; the pixels
   lost to flooring (`Math.round(space)` minus the sum) are handed out one by one, in column order, to
   columns that are below their `maxWidth`. Write the results and stop.
4. **Some bounded columns**: each of them gets its limit, `space` shrinks by that width, they leave
   `pending`, and the loop shares what is left among the rest again with a new `scale`.

Non-obvious points:

- All columns that violate a limit at the current `scale` are fixed in one round, not one at a time.
  Every round removes at least one column or ends the loop, so it terminates.
- A column exactly at its limit is not bounded (`<` / `>` are strict); it just takes the share.
- The result is whole numbers that add up to `available` only while no limit gets in the way (the
  JSDoc says so). When a limit holds, the sum differs by design.
- Zero total width gives `scale = 0`, so columns with `minWidth > 0` go to their minimum.
- Empty input returns `{}`. The input array is not mutated (`pending` is a copy).
- Not reactive and not reference-stable: it returns a new object each call; the caller passes it to
  `setWidths`, which writes the layout.

Where it is used: `fitColumns` in `use-grid-engine.ts` only (checked with Grep; the root index does
not export it).

---

## `scope.ts`

Types and one key. No runtime logic.

### `RowRange`

```ts
interface RowRange { start: number; end: number }
```

A half-open range `[start, end)` of indexes in `rows`.

### `KeepRendered`

```ts
interface KeepRendered {
	rows?: () => readonly number[];     // row indexes in `rows`
	columns?: () => readonly string[];  // column names
}
```

"What the markup needs rendered whatever the windows say": a row under focus or drag, a column under a
drag. The members are **getters**, not arrays: the engine reads them inside its own `computed`s, so
the source stays reactive without the caller creating refs.

### `GridScope<TRow>`

Everything the markup renders the grid from. It is a plain object, built by `useGridEngine` once per
grid; its members are refs, computeds and functions that are stable for the life of the grid.

Notes on the type:

- `getRowKey(row: TRow)` is declared **as a method**, not as a property. Method parameters are
  bivariant in TypeScript, so a `GridScope<MyRow>` is assignable to the default `GridScope`
  (`GridScope<unknown>`). The code comment says exactly this. `createGridScopeContext` relies on it.
- JSDoc on the type: commands that take a column name warn once in development about a name that is
  not a declared column; queries answer quietly.

What the scope contains, by group:

| Group | Members | Comes from |
| --- | --- | --- |
| Container | `root` | the `root` option, as is |
| Rows | `rows`, `rowKeys`, `getRowKey`, `getRowIndex` | the engine itself (`rowKey` resolver, key index) |
| Row window | `rowRange`, `visibleRowRange`, `getPageStep`, `getRowOffset`, `scrollToRow` | `useVirtualRows` |
| Columns | `columns`, `orderedColumns`, `offsets`, `getColumn`, `getPin`, `isColumnHidden`, `getWidth` | `useGridColumns` |
| Column window | `renderedColumns`, `visibleColumnRange`, `scrollingColumnRange` | `useVirtualColumns` + `resolveColumnWindow` |
| Groups | `headerGroups`, `isGroupCollapsed`, `toggleGroup` | `useColumnGroups` + group helpers |
| Column commands | `toggleColumn`, `pinColumn`, `moveColumnTo`, `moveColumnBefore`, `moveColumnBy`, `canMoveColumnTo`, `canMoveColumnBy`, `batch` | `useGridColumns`, some wrapped with warnings |
| Sort | `sort`, `getSortDirection`, `getSortIndex`, `multiSort`, `toggleSort` | the columns state + the engine |
| Widths | `resize`, `commitResize`, `previewWidths`, `setWidths`, `fitColumns` | `useGridColumns` + the engine |
| Spans | `getColumnSpan` | `resolveColumnSpan` + a cache |
| Scrolling | `scrollToRow`, `scrollToColumn` | row window / the engine |
| Rendering hook | `keepRendered` | the engine |

Semantics worth knowing (all from the JSDoc and the code):

- `rowRange` is the **rendered** rows (with overscan and kept rows); `visibleRowRange` is the rows
  actually in view between the sticky top and bottom, without overscan. Both keep their object while
  the bounds hold.
- `columns` is the shown columns; `renderedColumns` is `columns` after the column window, with spacers
  in place of the skipped ones. `visibleColumnRange` / `scrollingColumnRange` are **indexes in
  `columns`**; pinned columns are not counted in the visible range.
- `orderedColumns` includes hidden columns (what a settings panel lists); `columns` does not.
- `offsets` are prefix sums of shown widths: the first item is `insets.start`, `insets.end` is not
  included, so `offsets[index]` is the start edge of `columns[index]`.
- `sort` has the columns that are not declared filtered out.
- `getSortIndex` is 1-based and only exists from the second sorted column (see below).
- `toggleSort` is a header gesture: a column that is not `sortable` is left alone. Sorting from code
  goes through the state's `sort`.
- `resize` returns the width the column gets (so a gesture can continue from it); `setWidths` returns
  `false` when nothing was set; `fitColumns` returns `false` when it did nothing.
- `getColumnSpan(start, end)` returns cells for a row across the grid that spans shown columns
  `[start, end)`; used by overlays such as cell ranges.

### `GRID_SCOPE`

```ts
const GRID_SCOPE: InjectionKey<GridScope>
```

The symbol used by provide/inject, with the description `'@vue-data-grid/engine'`. It is typed with
the default row type; `use-grid-scope-context.ts` handles the cast.

Where `GridScope` is used (Grep): the cells composables (`use-cell-changes`, `use-cell-editing`,
`use-cell-focus`, `use-cell-ranges`, `use-grid-focus`) and many modules of `@vue-data-grid/core`
(clipboard, autosize, column resize, header cell, navigation, editing, loading edge, drag, props,
`use-data-grid`, `grid-header`).

---

## `use-grid-scope-context.ts`

### `createGridScopeContext(scope)`

```ts
function createGridScopeContext<TRow>(scope: GridScope<TRow>): GridScope<TRow>
```

`provide(GRID_SCOPE, scope as GridScope)` and returns the scope it got. The `as` is the single
widening cast from `GridScope<TRow>` to `GridScope<unknown>`; it is safe for reading, and the method
declaration of `getRowKey` is what keeps the types honest.

`useGridEngine` does **not** provide the scope itself (a test checks that): the owner of the component
tree decides where it is provided. In `@vue-data-grid/core`, `createDataGridContext` in
`components/context.ts` calls it with `grid.scope`; `GridRoot` calls that.

### `useGridScopeContext(fallback?)`

```ts
function useGridScopeContext<TRow = unknown>(): GridScope<TRow>;
function useGridScopeContext<TRow = unknown, TFallback = null>(fallback: TFallback): GridScope<TRow> | TFallback;
```

`inject(GRID_SCOPE, null)`.

- A scope found: return it. `TRow` is **not checked** against what was provided, as with any
  `inject`; the caller names the row type of the engine that provided it.
- No scope and no argument: throw `useGridScopeContext() must be called inside a component below
  createGridScopeContext()` (fail fast, names the API and the fix).
- No scope and an argument: return the fallback, such as `null`, for code that works both inside and
  outside a grid.

The distinction is made by `fallback.length > 0`, not by the value, so `useGridScopeContext(undefined)`
is also a fallback. The nearest provider wins, so a nested grid shadows the outer one (a test covers
it).

---

## `use-grid-columns.ts`

The most intricate file of the folder: it turns the declared columns plus a stored layout into the
shown columns, widths, pins, CSS variables and the actions that change the layout. It is a composable
without any knowledge of rows, groups or windows; the engine hands it callbacks for groups
(`getCollapsedColumns`, `keepsGroups`).

### Types and constants

| Name | Role |
| --- | --- |
| `ColumnsInsets` | `{ start, end }`: widths of the service columns at each edge of the row, px. Root API |
| `ColumnsOptions` | private; the options below |
| `ResolvedWidths` | `{ sizes: Map<name, px>, manual: Set<name> }` |
| `ColumnCache` | `{ key, cellProps, headerProps }`: the cached props of one column |
| `ColumnsFrame` | `{ cache, columns }`: the previous result, used for reuse |
| `PIN_RANK` | `start: 0, none: 1, end: 2`: the sort rank of pins |
| `NO_LAYERS`, `NO_WIDTHS`, `NO_NAMES`, `EMPTY_FRAME` | shared constants, so "nothing" is always the same reference |

`ColumnsOptions`:

| Option | Meaning |
| --- | --- |
| `columns: Ref<readonly AnyColumn[]>` | declared columns (the engine passes its reconciled list) |
| `layout: Ref<GridLayout \| null>` | the stored layout (`order`, `hidden`, `widths`, `pinned`, optional `collapsed`) |
| `insets: Ref<ColumnsInsets>` | |
| `cellStyles: GridCellStyles` | how geometry becomes a style string |
| `getCollapsedColumns?(layout)` | columns hidden by collapsed groups under this layout |
| `keepsGroups?(before, after)` | whether a move keeps `keepTogether` groups together |

### Private pure helpers

| Function | What it does |
| --- | --- |
| `resolvePins(columns, layout)` | `Map<name, side>`. A `pinnable` column takes its side from `layout.pinned`; a non-pinnable one from its own `pinned` declaration |
| `orderColumns(columns, layout, pins)` | a copy sorted by pin rank first (`start`, none, `end`), then by position in `layout.order`; a column unknown to the order goes after the known ones |
| `filterVisible(ordered, hidden)` | drops hidden names |
| `isSameSet(a, b)` | set equality |
| `isSameRenderedColumn(a, b)` | compares `column`, `key`, `index`, `pin`, `rowHeader`, `cellProps`, `headerProps` by `===` |
| `toNames(columns)` | names |

### `useGridColumns(options)`

The pipeline, each step a `computed` that depends only on the one before it:

```
options.columns + options.layout
  resolved   = resolveLayout(columns, layout)          // stored layout laid over the declarations
  hidden     = Set(resolved.hidden)                    // hidden by the user
  concealed  = hidden + getCollapsedColumns(resolved)  // hidden by the user or by a collapsed group
  pins       = resolvePins(...)
  ordered    = orderColumns(...)                       // includes hidden columns
  visible    = ordered without concealed
  pinOffsets = getPinOffsets(visible, getPin)          // by DECLARED widths
  frame      = stableComputed(...)                     // RenderedColumn[] with cached props
  columns    = frame.columns
```

`hidden` is the user's part only (it backs `isColumnHidden`); `concealed` adds collapsed groups and is
what the engine exposes as `hiddenColumns`.

#### The `frame`: rendered columns and their props

`stableComputed<ColumnsFrame>(EMPTY_FRAME, previous => ...)` builds the list of `RenderedColumn`
(`column`, `key`, `index`, `pin`, `rowHeader`, `cellProps`, `headerProps`).

Per column:

1. `getColumnEntry` computes `getGeometryKey(column, pin, offset)`: width, min, max, flex, align,
   resizable, pin and offset joined into a string. If the previous cache entry has the same key, it
   is reused as is.
2. Otherwise it calls the `cellStyles.cell(column, pin, offset)` compiler **once** (and
   `cellStyles.header` when given, otherwise the header uses the same style string) and creates two
   **frozen** props objects: `key`, `data-dg-column`, `data-dg-pinned`, `data-dg-align`, `style`.
   `data-dg-align` is set only when `align` is not `'left'` (the default).
3. A `RenderedColumn` is built with `toRuntimeColumn(column)` and `rowHeaders.has(name)` from
   `resolveRowHeaders(visible)`. If the previous frame has an equal object at the same index
   (`isSameRenderedColumn`), the previous object is returned.
4. If **every** column was reused and the length is unchanged, the whole previous frame is returned.

Why it is shaped this way:

- The key contains only what the style depends on, so changing a handler, a right or a `format`
  rewrites nothing in the DOM. It uses the **declared** width and the pin offset from `getPinOffsets`
  (also by declared widths): this is what the server renders and the `var()` fallback. The live width
  is not in the key; it reaches the DOM through CSS variables (below). So a resize or a width write
  rebuilds no props and renders no row; tests: `scope.columns` and their props stay the same after
  a resize is written to the layout and after `setWidths`.
- The `frame` records the new `cache` map every run, so entries of removed columns do not leak.
- The rule is "one frozen object per column, shared by all rows" (`CLAUDE.md`, stable references).

`columns`, `byName` (`Map<name, RenderedColumn>`, backs `getColumn`) and `declaredByName` (`Map` of
the declared columns, used by commands) are derived from it.

#### Widths: committed, draft, preview, live

Two small `shallowRef`s hold widths not in the layout:

- `draft`: widths of an ongoing resize gesture (`resize`).
- `preview`: widths shown without being written, such as the frames of a transition
  (`previewWidths`).

`resolveWidths(overrides)` produces `{ sizes, manual }`: for every declared column, a `resizable` one
takes `overrides[name] ?? layout.widths[name]`; the size is `clampColumnWidth(column, stored ??
column.width)`. A column that has a stored value is `manual` (the user, or code, set its width).

Three derived values:

- `committed = resolveWidths({})`: layout only.
- `live`: the same as `committed` (the very same object) when both `draft` and `preview` are empty,
  otherwise `resolveWidths({ ...preview, ...draft })`. A resize draws over a preview: the edge under
  the pointer wins.
- `getWidth(name)` reads `live`; `0` for an unknown name.

`manualColumns` is a `stableComputed` over `live.manual` that keeps the previous `Set` when equal
(`isSameSet`). The reason is stated in a test: a frame of a resize adds the same name to `manual` each
frame, and without this a reader of `getGrow` would wake on each frame. `getGrow(name)` returns
`column.flex` unless the column is manual, in which case `0`: a column with a user-set width stops
growing, which is the same rule the CSS variable encodes.

#### CSS variables and the overlay

`buildColumnStyles({ sizes, manual })` returns `Map<name, Record<variable, value>>`, walking `columns`:

- for a `resizable` column: the width variable `getWidthVariable(name)` = `Npx`; and if the column has
  `flex > 0` and is manual, the grow variable `getGrowVariable(name)` = `'0'`;
- for `start`-pinned columns, in order, the pin variable `getPinVariable('start', name)` with the
  accumulated offset; for `end`-pinned, the same from the end backwards. This makes pinned columns
  shift when a neighbour on the same edge is resized.

Two consumers:

- `variables` (root layer): `committedStyles` merged into one object, plus the two inset variables
  `getInsetVariable('start' | 'end')`. At rest all geometry sits on the root.
- `overlay`: `readonly GeometryLayer[]`. When `live === committed` it is the shared `NO_LAYERS`
  (the same array every time, a test checks it). Otherwise, for each column compare `liveStyles`
  with `committedStyles` and create a layer `{ selector: getColumnSelector(name), style: diff }` **only
  for columns whose variables changed**, with only the changed variables in `diff`.

Why: a custom property written on the root restyles the whole subtree. During a gesture the value
that changes every frame is written only to the elements that read it (`[data-dg-column="…"]` and
`[data-dg-columns~="…"]` through `getColumnSelector`), and the root does not change at all. At the end
`commitResize` writes the width to the layout; `committed` takes the new value and `overlay` becomes
empty again.

`offsets` (prefix sums, starting from `insets.start`, using `getWidth` so it follows `live`) and
`contentWidth` (`{ committed, live }`, sums of widths of shown columns) complete the geometry.

#### Writing the layout: `current`, `patch`, `batch`

The layout is written as a whole object: `options.layout.value = { ...resolved.value, ...next }`.

- `current()` is `pending ?? resolved.value`: inside a batch, actions build on the pending layout and
  see each other.
- `patch(next)`: with `depth === 0` writes at once; inside `batch` stores `pending = { ...current(),
  ...next }`.
- `batch(run)`: `depth += 1`, `run()`, and in `finally` `depth -= 1`; when the outermost batch ends and
  there is a pending layout, one write. Consequences (all covered by tests): three changes cost one
  layout write; a batch with no changes creates no layout; a nested batch writes once, on leaving the
  outer one; an exception inside a batch does not leave pending changes (the `finally` still writes
  what the batch had already built before throwing, then `pending` is cleared).

#### Actions

| Function | Behavior |
| --- | --- |
| `resize(name, width)` | for a `resizable` declared column, `draft = { ...draft, [name]: clampColumnWidth(column, width) }`; otherwise ignored |
| `commitResize()` | no draft: nothing. Otherwise `patch({ widths: { ...current().widths, ...draft } })` and clear the draft |
| `previewWidths(next)` | `preview = next ? { ...next } : {}` (a copy; `null` takes it off) |
| `setWidths(next)` | clamp each `resizable` column's width; skip other names; `false` if nothing was set. Drops those names from `draft` (the written value wins over an old gesture), then one `patch` |
| `setGroupCollapsed(name, collapsed)` | `patch({ collapsed: { ...current().collapsed, [name]: collapsed } })` |
| `toggleColumn(name)` | ignored unless the column is `hideable`; toggles the name in `current().hidden` |
| `pinColumn(name, side)` | ignored unless `pinnable`; removes the name from `pinned`, and adds it back when `side` is not `null` |
| `moveColumnTo(name, index)` | `index` counts among shown columns *after the column is taken out*; writes `order` |
| `moveColumnBefore(name, before)` | turns a neighbour name (or `null` for the end) into an index and calls `moveColumnTo`; an unknown target does nothing |
| `moveColumnBy(name, delta)` | moves by `delta` allowed places; returns whether it moved |
| `canMoveColumnTo`, `canMoveColumnBy` | the same checks without writing |

`resize` and `commitResize` here do not schedule anything: the per-frame throttle lives in the engine.

#### How a move is validated

`currentColumns()` returns `{ pins, ordered, hidden, visible }` for `current()`. When there is no
pending layout it reuses the cached computeds; inside a batch it recomputes them from the pending
layout (`resolvePins`, `orderColumns`, `concealFrom`, `filterVisible`), so a move after a pin in the
same batch sees the new pins.

`resolveMove(name, index)`, returns the new full order (`AnyColumn[]`) or `null`:

1. `shown` is the visible columns without `name`; `group` is those with the same pin side as `name`.
2. The target `index` must be inside that group's range `[start, start + group.length]`: a column never
   leaves its pin group. An empty group with `start === -1` is refused.
3. The anchor is `shown[index]`; if the column goes to the end of its group, it is placed before the
   next column of the full `ordered` list (so hidden columns keep their slots).
4. `moveColumn(ordered, name, before)` (from `columns/column-order`) does the move; `null` means the
   column is not `movable`.
5. After the move, `keepsFixedColumns(visible, after)` (columns that must keep their place) and
   `options.keepsGroups(before, after)` (`keepTogether` groups; `true` if the option is absent) must
   both hold.

`resolveMoveBy(name, delta)`: the `index` for `moveColumnTo` that corresponds to `delta` allowed
places. It scans from the current position in the direction of `delta`, only inside the column's pin
group (that is the only side `resolveMove` accepts, and each check is linear, so the scan is limited),
counting only indexes for which `resolveMove` succeeds, until `|delta|` such places are counted. So a
`keepTogether` group is stepped over as one place, and the move goes as far as it can when fewer places
are allowed. Returns `null` for an unknown column, `delta === 0`, a column that is not `movable`, or no
allowed place.

#### Return value

`columns`, `orderedColumns`, `offsets`, `variables`, `overlay`, `contentWidth`, `hiddenColumns`
(= `concealed`), `getColumn`, `getPin`, `getPinOffset`, `getGrow`, `isColumnHidden`, `getWidth`,
`resize`, `commitResize`, `previewWidths`, `setWidths`, `setGroupCollapsed`, `currentLayout`,
`toggleColumn`, `pinColumn`, `moveColumnTo`, `moveColumnBefore`, `canMoveColumnTo`, `moveColumnBy`,
`canMoveColumnBy`, `batch`.

#### Reference stability

| Value | Stable while |
| --- | --- |
| `columns` and each `RenderedColumn` | place, pin, row-header flag and style-relevant geometry hold; a width write does not break it |
| `cellProps` / `headerProps` | the geometry key is the same: one frozen object per column |
| `overlay` | `NO_LAYERS` at rest |
| `manualColumns` | the set of manual names holds |

Where it is used: `useGridEngine` only (Grep). It is exported from `internals` so a custom engine can
reuse it.

---

## `use-grid-engine.ts`

### How the pieces are wired

```
                  options.columns ---> columnList (reconcileColumns, stable)
                  options.groups  ---> groupList -> groupPaths, collapsible, groupsByName
 state.layout  \                               |
 insets        --> useGridColumns  <-- getCollapsedColumns, keepsGroups (from group helpers)
 cellStyles   /       |  columns, getWidth, getPinOffset, getGrow, variables, overlay, ...
                      v
 options.root --> useScrollViewport(root) ----+-------------------+
                      |                        |                   |
                      v                        v                   v
 options.rows --> useVirtualRows       useVirtualColumns     (viewport size, scroll)
   rowKeys, rowIndexes, heights          columns, getWidth
        |                                        |
        v                                        v
     rowWindow.items, rowRange        columnWindow.range -> resolveColumnWindow -> renderedColumns
                                                                  |
                       useColumnGroups(paths, visible, rendered, pinOffset, grow) -> headerGroups
```

One `useScrollViewport(options.root)` is created and shared by the row and column windows, so the
scroll container is observed once.

### Options

`VirtualOptions` (root API):

| Option | Default | Meaning |
| --- | --- | --- |
| `rows` | `true` | row window (only when the object form is used) |
| `columns` | `true` | column window |
| `overscan` | `6` | rows rendered past each edge |
| `bufferPx` | `200` | px rendered past each edge, since columns differ in width |
| `ssrRows` | `24` | rows rendered before the container is mounted, on the server and in hydration |

`virtual` itself is `boolean | VirtualOptions`, default `false`. `true` or an object (even `{}`) turns
both windows on; an object can switch them separately. The engine resolves it into
`virtual: ComputedRef<Required<VirtualOptions>>` with defaults from `DEFAULTS`.

`GridEngineOptions<TRow>` (root API). Required: `columns`, `rows`, `root`, `rowKey`, `rowHeight`.

| Option | Notes |
| --- | --- |
| `columns` | `MaybeRefOrGetter<ColumnsInput \| readonly AnyColumn[]>` |
| `groups` | optional; object by name or array |
| `rows` | already sorted, grouped, flattened, filtered |
| `root` | `Ref<HTMLElement \| null>`; the windows wait for it |
| `rowKey` | field name or function; **read once** |
| `state` | a `GridColumnsState`; created with `useGridColumnsState()` when absent; **read once** |
| `insets` | `{ start, end }`, default `{0, 0}` |
| `cellStyles` | default `FLEX_CELL_STYLES`; **read once** |
| `rowHeight` | `MaybeRef<number> \| ((row, index) => number)`; **no default** |
| `measureRows` | measure in the DOM; `rowHeight` becomes an estimate |
| `indexAttribute` | default `data-dg-index`; **read once** |
| `scrollMargin`, `scrollMarginEnd` | sticky top / bottom heights, px |
| `bodyOffset` | in-flow height between the sticky top and the body, px, default `0` |
| `anchorAtTop` | keep rows in view in place at the very top too, default `false` |
| `keepRows`, `keepColumns` | indexes / names that must stay rendered |

Details of why:

- `rowHeight` has no default: the row window computes offsets from it and a made-up number would shift
  scrolling against the real rows. A function is **always a height function** (`getRowHeightOption`
  returns a function as is, and `unref`s anything else), never a getter of a number; a test covers it.
- "Read once" options are used at setup (`createRowKeyResolver(options.rowKey)`, `options.state ??
  useGridColumnsState()`, `options.cellStyles ?? FLEX_CELL_STYLES`, `indexAttribute`); changing them
  later has no effect.

### Rows

- `rows = computed(() => toValue(options.rows))`.
- **`rowKeys`** (`stableComputed`): the key of every row at the same index. It compares with the
  previous array while walking: if the length is equal it starts as "no change" and only builds a new
  array (`[...previous.slice(0, index), key]` and the rest) at the first key that differs. Same keys
  under new data: same array (a test: `rowKeys` stays the same array while new data comes under the same
  keys). That means new data under the same rows wakes none of the readers of `rowKeys`. A changed
  list is passed to the dev duplicate-key check.
- **`rowIndexes`**: `Map<key, index>` built from `rowKeys`. The **first** index wins for a duplicate
  key. It is lazy: not built until someone reads it (`getRowIndex` or the window's `getItemIndex`).
  `scope.getRowIndex(key)` returns `-1` when missing.
- `getRowKey(index)` (private, for the window) returns `String(index)` for an index that is outside
  `rows`: rows can shrink one frame before the window does, and the key of a missing row must never be
  resolved. `scope.getRowKey` is the resolver itself, `getKeyOf(row)`.
- `getRowHeight(index)` calls the height function with the row and index. `uniformHeight` is the
  number when `rowHeight` is a number (or a ref of one) and `measureRows` is off, otherwise `null`; the
  window uses it to skip per-row work.

### Columns and groups

- **`columnList`** (`stableComputed`): `reconcileColumns(previous, toColumnList(toValue(columns)))`
  keeps the old column objects whose declarations did not change, so a recreated `columns` object with
  the same fields keeps the set, and a recreated value function changes it (tests).
- **Groups**: `groupList` (`toGroupList`), `groupsByName`, `groupPaths` (`resolveGroupPaths`) and
  `collapsible` (any group is collapsible) are computeds.
  `isCollapsedIn(layout, group)` is `layout.collapsed[name] ?? group.collapsedByDefault ?? false`.
- They enter `useGridColumns` as two callbacks: `getCollapsedColumns(layout)` returns the columns
  hidden under that layout (`resolveCollapsedColumns`; `NO_COLUMNS` when no group collapses, which
  avoids work), and `keepsGroups(before, after)` is `keepsGroupsTogether`. Passing the layout makes the
  check right inside a `batch`, where the layout is not yet written.
- `isGroupCollapsed(name)` is `false` for an unknown group or one without `showWhen`.
  `toggleGroup(name)` flips it through `columns.setGroupCollapsed`, based on `columns.currentLayout()`
  rather than the state, so two toggles in one `batch` leave the group as it was.
- **`headerGroups`** (`useColumnGroups`): gets the group paths, the collapsed check, the shown columns,
  the rendered columns (windowed), `getPinOffset`, `getGrow` and `cellStyles`; it returns the group rows
  above `renderedColumns` (empty without groups).

### Sort

The sort itself lives in the columns state (`state.sort`, `state.multiSort`). The engine adds three
things:

- **`activeSort`**: `state.sort` without items whose column is not declared (a stored or initial sort
  may name columns that are gone). Returns `state.sort` itself when nothing is filtered, so an unchanged
  sort keeps its reference (test).
- **`getSortDirection(name)`** and **`getSortIndex(name)`**: the index is 1-based and only returned when
  `activeSort.length > 1`; a single sorted column has no position.
- **`toggleSort(name, additive)`**: only for a declared, `sortable` column:
  `state.sort.value = toggleSort(activeSort, name, additive && multiSort, column.sortOrder)`. Because it
  builds on `activeSort`, the gone columns are dropped from the state by the next header click (test).
- **`toggleColumn`** (the engine's own wrapper): after `columns.toggleColumn`, if the column is now
  hidden, it also removes it from `state.sort`. So a hidden column stops sorting, and showing it again
  does not bring the sort back. It looks at `columns.currentLayout()`, so it works inside `batch`.

### Windows

- `viewport = useScrollViewport(options.root)`.
- **`rowWindow = useVirtualRows({...})`**: gets the viewport, `count`, `enabled`, `overscan`,
  `scrollMargin`, `scrollMarginEnd`, `bodyOffset`, `anchorAtTop`, `estimateSize`, `uniformSize`,
  `measured`, `getItemKey`, `getItemKeys`, `getItemIndex`, `keep`, `ssrCount`, `indexAttribute`. Every
  value is passed as a getter so the window tracks it.
- **`columnWindow = useVirtualColumns({...})`**: the viewport, the shown `columns`, `enabled`,
  `getWidth` (live widths), `inset` (`insets.start`), `bufferPx`, `keep`.
- **`columnsWindow`** (`stableComputed<ColumnWindow, null>`) calls `resolveColumnWindow(columns,
  range, getWidth, previous, cellStyles.spacer)` to cut the shown columns down to the range and
  put spacers in the place of the skipped ones; the previous result is passed in so unchanged windows
  keep their arrays. `renderedColumns = columnsWindow.rendered`.
- **`windowed`** = `renderedColumns !== columns.columns`. It tells whether the column window actually
  skipped something; without the window `renderedColumns` is the very same array as `columns` (test).
- **Kept rows and columns**: `keepSources` is a `shallowRef` list of `KeepRendered`. `keepRendered(source)`
  appends it and returns `release`; when called inside an effect scope it also registers
  `onScopeDispose(release)`, so a component's source goes away when the component unmounts.
  `keptRows` / `keptColumns` merge the `keepRows` / `keepColumns` option with the output of every source
  (the option array itself when there are no sources, avoiding a copy). The windows read these inside
  their own computeds, so the sources stay reactive.
- **`rowRange`** (`stableComputed`): the first and last index of `rowWindow.items` as a half-open
  `{ start, end }`; `EMPTY_RANGE` with no items; keeps the previous object while the bounds hold, so a
  kept row that moves inside the window re-renders nothing (test). Note it is from the first to the last
  item, kept rows included.

### Commands with a warning wrapper

`createUnknownColumnWarning(getColumns)` creates a function `(method, names)` that warns once per
`method + name` (the id joins them with `\u0000`) when a name is not a declared column, naming the
method and listing the declared columns. It is only created under `__DEV__`; call sites use `?.`.
Commands warn (`toggleColumn`, `pinColumn`, `moveColumnTo`, `moveColumnBefore` for both names,
`moveColumnBy`, `resize`, `toggleSort`, `setWidths`, `fitColumns` with names, `scrollToColumn`); queries
(`getColumn`, `getWidth`, ...) stay quiet because asking about a removed column is fair. A declared
column that a command merely leaves alone (a non-hideable one) does not warn.

### Resizing, per frame

The pointer fires several moves per frame; all but the last would cost work that never reaches the
screen. So `scope.resize` batches:

1. If the column is not declared, warn; if it is not `resizable`, return `columns.getWidth(name)`.
2. Store the width in `pendingWidths` (a `Map`, the last width per column wins).
3. `resizeFrame ??= requestAnimationFrame(flushResize)`: one frame for any number of moves. Without
   `requestAnimationFrame` (SSR, tests), `flushResize()` runs at once.
4. Return `clampColumnWidth(column, width)` immediately, so a gesture can continue from the real width
   without waiting for the frame.

`flushResize` clears `resizeFrame`, passes the pending widths to `columns.resize` (the draft) and
clears the map. `commitResize` cancels the waiting frame, flushes at once and calls
`columns.commitResize()` to write the layout; with no moves nothing is written. `onScopeDispose` cancels
a waiting frame on unmount (test).

### `fitColumns(names?)`

1. Warn on unknown names.
2. `targets` = shown `resizable` columns, filtered by `names` when given.
3. Return `false` without a root or targets.
4. `fixed = insets.start + insets.end` plus the width of every shown column that is not a target.
5. `columns.setWidths(fitColumnWidths(fitted, root.clientWidth - fixed))`.

It goes through `setWidths`, so the result is clamped again and written in one layout write. The only
DOM read is `root.clientWidth`.

### `scrollToColumn(name, align = 'auto')`

Warns on an unknown name; does nothing without a root, for a hidden (not shown) column or a pinned
one (always visible). Otherwise: `rtl` from `getComputedStyle(root).direction`; `pinnedStart` /
`pinnedEnd` = the insets plus widths of the pinned columns on each side; then
`resolveScrollPosition` (from `virtual/scroll`) with the column's `offsets[index]` and
`offsets[index + 1]`, the pinned insets, `clientWidth`, `Math.abs(scrollLeft)`, the scrollable maximum
and `align`. A `null` result means "already fine". In RTL a positive result is written as negative
`scrollLeft`. `scrollToRow` is simply `rowWindow.scrollToIndex`.

### `getColumnSpan(start, end)`

A row across the grid (an overlay such as a cell range) that spans shown columns `[start, end)`.
`resolveColumnSpan(columns, start, end, { insets, getPinOffset, getGrow, cellStyles }, previous)` splits
it by pin side and fills the other places with cells; each cell is styled as a group cell so it lays
out and resizes with the real cells without a render. The engine keeps a `Map<"start:end", cells>`
cache and passes the previous value for the same span, so the same array is returned while the geometry
holds. The cache is cleared whole at `SPAN_CACHE_LIMIT` (256) entries: more than a selection's ranges,
bounded so a long session cannot grow it. It is a plain `Map` inside the closure, so it lives and dies
with the grid. It is not reactive; it reads reactive sources when called, so call it in a render or a
`computed`.

### The scope object

`scope` is assembled at the end, as in the table in `scope.ts`. Most members are straight references to
the pieces above (`rowWindow.visibleRange`, `columns.getWidth`, ...); the rest are the wrappers described
above. `getRowKey: getKeyOf` and `getRowIndex` do not go through `getRowKey(index)`.

### Return value

```ts
{
	scope,           // GridScope<TRow>
	state,           // the one passed in, or its own
	virtual,         // options with defaults filled in
	uniformHeight,
	windowed,
	hiddenColumns,   // hidden by the user or by a collapsed group
	layers,          // GeometryLayer[]: root layer + the resize overlay
	contentWidth,    // { committed, live }: total width of shown columns, without insets
	items,           // row window items
	totalSize,       // height of the body
	measureElement,  // measure a row
}
```

`layers` = `[{ selector: null, style: columns.variables }, ...columns.overlay]` (`selector: null` means
the root). The consumer passes it to `useGridGeometry`, which writes it to the DOM.

### Dev-only code (`__DEV__`)

Three watchers, none created in production:

- `createRecreationWatcher`: when a column is replaced with an object that differs **only in functions**
  (`getChangedFields` + `isFunctionOnlyChange` from `columns/column`) it counts per column name and warns
  at the third time (`RECREATION_LIMIT = 3`): such a replacement re-renders all cells of that column,
  and usually means columns are declared inside a `computed`.
- `createDuplicateKeyWatcher`: warns once per grid, when the keys are first read, about a row key that
  belongs to more than one row.
- `createUnknownColumnWarning`: above.

Messages carry the `[@vue-data-grid/engine]` prefix.

### Anchoring note

The JSDoc of `useGridEngine` says it keeps the rows in view in place itself when rows come in or go
above them (the row window does it, with `bodyOffset` and `anchorAtTop`), so the container needs
`overflow-anchor: none`, or browsers with scroll anchoring move the rows a second time.

### Where it is used

`useGridEngine` is called once, in `packages/core/src/data-grid/use-data-grid.ts`, with `scrollMargin:
headHeight`, `scrollMarginEnd: footHeight`, `bodyOffset` and `anchorAtTop` coming from the core's
sticky measurement and loading edges. `engine.layers` goes to `useGridGeometry` there, together with
layers added by `addLayers`. Its `scope` is provided by `createDataGridContext` in
`packages/core/src/components/context.ts`. `scope.keepRendered` is called by
`core/src/drag/use-grid-row-drag.ts` and `use-grid-column-drag.ts`.

---

## Tests

`packages/engine/tests/engine/` has one spec per source file: `fit-columns.spec.ts`,
`use-grid-columns.spec.ts` (cell props, widths and resizing, geometry layers, offsets, visibility /
pinning / moving, batch), `use-grid-engine.spec.ts` (the widest: windows, sorting, groups, spans,
warnings, reference stability, resize per frame) and `use-grid-scope-context.spec.ts`.
