# `src/render`

Geometry: how column widths, pins and grow factors become CSS, and how that CSS reaches the DOM. The
folder has no markup and no rendering of its own, despite the name: it produces **style strings,
variable names, selectors and layers**, and one composable that writes layers to elements. It sits
above `columns` (it reads `ColumnGeometry`, `ColumnPinSide`, `RenderedColumn`) and below `rows`,
`virtual`, `column-groups` and `engine`.

```
render/
  index.ts             public surface of the folder
  geometry.ts          variable names, cell/group/spacer styles, selectors, pin offsets, geometry key
  column-span.ts       cells over a run of columns (groups, range overlays), with reference reuse
  use-grid-geometry.ts writes GeometryLayer[] to the DOM and keeps it written
```

The idea in one paragraph: widths and pin offsets live in **CSS custom properties** (`--dg-width-*`,
`--dg-pin-*-*`, `--dg-grow-*`, `--dg-inset-*`). Every cell style is a string that reads those
variables with the declared value as the `var()` fallback. A resize then changes a variable, not a
vnode, so nothing re-renders; the server renders the same strings and the fallbacks make them correct
without any variable being written.

Root exports (`src/index.ts`): types `ColumnSpanCell`, `GeometryLayer`, `GridCellStyles`,
`GroupGeometry`; values `compileCellStyle`, `compileGroupStyle`, `FLEX_CELL_STYLES`,
`getColumnCellSelector`, `getColumnSelector`, `getColumnToken`, `getFlexSpacerStyle`,
`getGrowVariable`, `getInsetVariable`, `getPinVariable`, `getWidthVariable`, `useGridGeometry`.

Internals (`src/internals.ts`): types `ColumnRunGeometry`, `ColumnSpanOptions`; values
`getColumnRunGeometry`, `getColumnRunGrow`, `getGeometryKey`, `getPinOffsets`, `resolveColumnSpan`.

Note the asymmetry: `ColumnSpanCell` is public (it is the result type of the public
`getColumnSpan` of the engine), while the function that builds it, `resolveColumnSpan`, is internal.

---

## `geometry.ts`

### Variable names

```ts
function getWidthVariable(name: string): string;                       // --dg-width-<name>
function getPinVariable(pin: ColumnPinSide, name: string): string;     // --dg-pin-<pin>-<name>
function getGrowVariable(name: string): string;                        // --dg-grow-<name>
function getInsetVariable(side: ColumnPinSide): string;                // --dg-inset-<side>
```

One variable per column and per concern. `getInsetVariable` is the width of the application's own
service columns at one edge of the row; pinned columns on that side stick *after* it.

The column name is user data and can contain anything (`"a.b"`, `"price, $"`, a space), but a custom
property name must be a `<dashed-ident>`. The private `toVariableName` maps it:

1. `[\w-]` (ASCII word characters and the hyphen) pass through.
2. A character at or above U+00C0 that matches `\p{L}` or `\p{N}` (non-Latin letters and digits)
   passes through, so a Cyrillic column name stays readable (`isPlainLetter`).
3. Anything else becomes `·<hex>·`, e.g. a space becomes `·20·`.

Why the mark `·` (U+00B7) is escaped too: it is below U+00C0 and is not `\w`, so rule 3 turns a literal
`·` in a name into `·b7·`. Because the mark itself is never passed through, the mapping is
**injective**: two different column names can never share a variable or a `data-dg-columns` token. The
tests check that the result is accepted both as text in `cssText` and through `setProperty`.

`getGrowVariable` exists because of a resize subtlety: a `flex` column normally grows to fill the row.
When the user sets its width, the engine writes `--dg-grow-<name>: 0`. Without that, a resize would
change only the flex basis, the column would grow the space back and the edge under the pointer would
not move.

Used by: `engine/use-grid-columns.ts` (all four), through the root API by `@vue-data-grid/core`.

### `GeometryLayer`

```ts
interface GeometryLayer {
	selector: string | null;   // within the root; null = the root itself
	style: Readonly<Record<string, string>>;
}
```

A piece of geometry and where to write it. A custom property is inherited, so writing it on the root
restyles the whole subtree (and style recalculation covers every descendant whether or not it reads
the property). A layer with a selector writes it only on the elements that read it. Consumed by
`useGridGeometry`; produced by `engine/use-grid-columns.ts` (`variables` as the root layer, `overlay` as
selector layers).

### `getPinDeclarations` (private)

Builds the three declarations of a pinned cell:

```
position:sticky
z-index:var(--dg-pinned-z-index, 1)
<inset-inline-start | inset-inline-end>:calc(var(--dg-inset-<pin>, 0px) + var(--dg-pin-<pin>-<name>, <offset>px))
```

- **Logical sides** (`inset-inline-*`), so in a right-to-left grid `start` pins to the right with no
  extra code.
- The z-index is a variable (`--dg-pinned-z-index`, default `1`): an inline style beats any rule, so a
  stylesheet could not raise a pinned cell (for example while it is edited) if the value were inline.
  A scrolling cell gets no `z-index` and no `position` at all.
- The offset is the `var()` **fallback**, not the value. Resizing a column to the left writes the
  `--dg-pin-*` variables; with no variable written (server render, first paint) the declared offset is
  correct.

### `compileCellStyle(column, pin, offset)`

```ts
function compileCellStyle(column: ColumnGeometry, pin: ColumnPinSide | undefined, offset: number): string
```

The style of a body or header cell in a flex row. Step by step:

1. `width` expression (`getWidthExpression`): for a **resizable** column `var(--dg-width-<name>, <width>px)`,
   otherwise a plain `<width>px` (no variable to write, so no variable to read).
2. `grow`: for a resizable column with `flex > 0`, `var(--dg-grow-<name>, <flex>)`; otherwise the
   number. `flex: 0` adds no grow variable, there is nothing to zero.
3. Declarations `flex:<grow> 1 <width>` and `min-width:<width>`. The minimum equals the width, so a
   cell never shrinks below its (live) width; `flex-shrink` is `1` but the min-width pins it.
4. `max-width:<n>px` only when `maxWidth` is set.
5. If pinned, the declarations of `getPinDeclarations`.

The result is a **string, not an object**. `createVNode` normalizes an object `style` by writing to
`props.style`, and cell props are frozen and shared by all rows, so an object would throw or be
copied. How the cell lays out its content (`display`, alignment through `data-dg-align`, `overflow`) is
left to CSS (`@vue-data-grid/core/style.css`), so changing alignment never touches this function.

Used as `FLEX_CELL_STYLES.cell`.

### `getFlexSpacerStyle(width)`

`flex:0 0 <width>px;min-width:<width>px`. The style of a column-window spacer. Used as
`FLEX_CELL_STYLES.spacer`, and directly as the default `spacerStyle` argument in
`virtual/column-window.ts`.

### `GroupGeometry` and `compileGroupStyle(group)`

```ts
interface GroupGeometry {
	columns: readonly ColumnGeometry[];   // shown columns under the cell, in display order
	pin: ColumnPinSide | undefined;
	offset: number;                        // offset of the outermost column on that side
	grow: number;                          // sum of the columns' grow, user-sized counted as 0
}
function compileGroupStyle(group: GroupGeometry): string
```

The style of a cell that spans several columns (a group header, a range overlay piece). The goal: the
cell stays exactly above its columns while they resize.

- The basis is `calc(<w1> + <w2> + ...)` of the columns' own width expressions, i.e. the same
  `var(--dg-width-*)` the cells below read. The group therefore resizes with its columns from the
  same variables, without a render.
- The grow is a **number** (the sum computed by the caller), not a `calc()` of variables, because
  older Safari does not accept `calc()` in `flex-grow`. Hence `grow` has to be recomputed in JS when a
  column becomes user-sized (`getGrow` in `use-grid-columns.ts` returns `0` for those).
- Known limit (documented in the JSDoc): a growing column with `maxWidth` stops at its limit and its
  row neighbours take the rest; the group row does not know and drifts.
- A pinned group sticks by its outermost column's variable: the **first** column for `start`, the
  **last** for `end` (the edge nearest to the pin side of the viewport). `offset` must be the offset of
  that column.

### `GridCellStyles` and `FLEX_CELL_STYLES`

```ts
interface GridCellStyles {
	cell: (column, pin, offset) => string;
	header?: (column, pin, offset) => string;   // default: the body style
	group?: (group: GroupGeometry) => string;   // default: group cells get no style
	spacer: (width: number) => string;
}
const FLEX_CELL_STYLES: GridCellStyles   // frozen: compileCellStyle, compileGroupStyle, getFlexSpacerStyle
```

The seam for other layouts: a CSS grid or a `<table>` reads the same width and pin variables and
differs only in these strings. Contract in the JSDoc: each function runs once per column or group cell
when its geometry changes, **not once per row**, and must read only its arguments, because the cache
key (`getGeometryKey`) is built from them; anything else it reads will not reach the style.

`header` falls back to the body style in `use-grid-columns.ts` (`header ? header(...) : style`).
`group` is optional, and its absence disables column spans (see below).

Where used: `engine/use-grid-engine.ts` takes `options.cellStyles ?? FLEX_CELL_STYLES`, hands it to
`useGridColumns`, `useColumnGroups` (as `options.cellStyles`), `getColumnSpan`, and passes
`cellStyles.spacer` to the column window.

### `getPinOffsets(columns, getPin)`

```ts
function getPinOffsets(
	columns: readonly Pick<ColumnGeometry, 'name' | 'width'>[],
	getPin: (name: string) => ColumnPinSide | undefined,
): Map<string, number>
```

Offset of each pinned column from its edge by **declared widths**. Two passes: start-pinned columns
from the beginning, accumulating widths; end-pinned columns from the **end** of the array backwards, so
the last end-pinned column has offset `0`. Scrolling columns get no entry (callers use
`?? 0`). It is what the server renders and the `var()` fallback that resizing overrides; the live
offsets during a resize are built separately in `use-grid-columns.ts` (`buildColumnStyles`) from
current widths.

Used by: `engine/use-grid-columns.ts` (`pinOffsets` computed, exposed as `getPinOffset`). Internals only.

### Selectors and tokens

```ts
function getColumnToken(name: string): string        // = toVariableName(name)
function getColumnCellSelector(name: string): string // [data-dg-column="<name>"]
function getColumnSelector(name: string): string     // cells + group cells above it
```

- `getColumnToken` is the column's entry in the space-separated `data-dg-columns` list of a group cell.
  It uses the same escape as variables, which keeps tokens whitespace-free (needed for `~=`).
- `getColumnCellSelector` escapes only `"` and `\` (`name.replace(/["\\]/g, '\\$&')`). Inside a quoted
  attribute value nothing else matters, and `CSS.escape` is for identifiers and needs a browser
  (the engine also runs on the server).
- `getColumnSelector` joins the cell selector with `[data-dg-columns~="<token>"]`, so a resize layer
  reaches both the column's cells and the group cells above it, but not groups above neighbours. The
  escaped token keeps names that differ only in escaped characters from matching each other (tested).

`getColumnSelector` is used by `use-grid-columns.ts` to build the selector of resize layers. In
`engine/src` nothing else calls `getColumnCellSelector` or `getColumnToken` directly outside
`geometry.ts`/`column-span.ts`; they are root exports for `@vue-data-grid/core` and custom markup.

### `getGeometryKey(column, pin, offset)`

```ts
function getGeometryKey(column: ColumnGeometry, pin: ColumnPinSide | undefined, offset: number): string
```

`"<width>|<minWidth>|<maxWidth>|<flex>|<align>|<resizable>|<pin>|<offset>"`: exactly what the style and
`data-dg-align` depend on, and nothing else. Reference-stability role: changing a column's handler,
label or rights produces the same key, so the cached frozen `cellProps`/`headerProps` object is
reused and no attribute is rewritten.

Used by: `engine/use-grid-columns.ts` (`getColumnEntry`: same key means the previous cache entry is
returned) and `column-groups/use-column-groups.ts` (`getSignature`, one key per column under the
cell, with `''` for spacers). Internals only.

---

## `column-span.ts`

A *column span* is a row across the grid that covers shown columns `[start, end)`, split into cells
that follow the same layout as the real cells. Its purpose: overlays above the body (cell range
selection) that must lay out, stick and resize with the columns under them with no render. It reuses
the group style machinery: each piece is styled as a group cell.

### Types

```ts
interface ColumnSpanCell {
	key: string;                 // unique in the span, for v-for
	inside: boolean;             // columns are within the span; others hold place of the columns around
	columns: readonly string[];  // display order; empty for an inset of the row
	pin: ColumnPinSide | undefined;
	continues: { start: boolean; end: boolean };  // span goes on past this cell's edge, to another pin side
	props: Readonly<Record<string, unknown>>;     // frozen: style, data-dg-columns, data-dg-pinned
}

interface ColumnSpanOptions {
	insets: { start: number; end: number };
	getPinOffset: (name: string) => number;
	getGrow: (name: string) => number;
	cellStyles: GridCellStyles;
}

interface ColumnRunGeometry { style: string | undefined; tokens: string }
```

`continues` lets the renderer round corners or draw borders only at the true ends of the span: if a
span crosses from a scrolling area into a pinned one, the piece in each area is cut, and `continues`
says the cut is not an end.

### `getColumnRunGrow(names, getGrow)`

Sum of `getGrow(name)` over the names. Used by `resolveColumnSpan` and by
`column-groups/use-column-groups.ts`. The engine's `getGrow` returns the flex factor, or `0` for a
user-sized column, matching the zeroed `--dg-grow-*` variable.

### `getColumnRunGeometry(items, grow, options)`

```ts
function getColumnRunGeometry(
	items: readonly RenderedColumn[],
	grow: number,
	options: Pick<ColumnSpanOptions, 'getPinOffset' | 'cellStyles'>,
): ColumnRunGeometry
```

The shared core of "a cell over neighbouring columns on one pin side" for column groups and span
pieces. Steps:

1. `names` are the item keys; `pin` is the pin of the first item (the caller guarantees one run has
   one pin side).
2. `edge` is the column the cell sticks by: the **last** name for `pin === 'end'`, else the first.
3. `style` = `cellStyles.group?.({ columns, pin, offset, grow })`, where `columns` are the items'
   `column` fields (spacers have `column: null` and are dropped via `flatMap`) and `offset` is
   `getPinOffset(edge)` when pinned, else `0`.
4. `tokens` = the item names mapped through `getColumnToken` and joined with spaces: the
   `data-dg-columns` value.

`items` must be non-empty (`items[0]` is read without a check). Returns `style: undefined` when the
styles have no `group`. Used by `resolveColumnSpan` and `use-column-groups.ts`.

### `resolveColumnSpan(columns, start, end, options, previous)`

```ts
function resolveColumnSpan(
	columns: readonly RenderedColumn[],
	start: number,
	end: number,
	options: ColumnSpanOptions,
	previous: readonly ColumnSpanCell[] = NO_CELLS,
): readonly ColumnSpanCell[]
```

How it works:

1. Clamp: `first = max(start, 0)`, `last = min(end, columns.length)`. Return the frozen `NO_CELLS` when
   `cellStyles.group` is missing or `first >= last` (empty, or a span that is out of range).
2. **Group the columns into runs.** Walk all columns in order; a column joins the last run when it is
   on the same side of the span edges (`inside`) *and* has the same `pin`. Otherwise it starts a new
   run. So a span `[1,4)` over `[a b | c d | e]` with `c d` pinned yields separate pieces for
   scrolling and pinned parts, and the unselected columns around form their own placeholder runs.
3. Build the cells: an optional **start inset** (`createInset('start', width)`, key
   `dg-inset-start`, no columns, `style: cellStyles.spacer(width)`) when `insets.start > 0`; then one
   cell per run (key = first column name, props = `key`, `data-dg-columns`, `data-dg-pinned`,
   `style` from `getColumnRunGeometry`); then an **end inset** the same way. The insets keep the
   service columns' width so the cells line up.
4. `continues` is computed only for `inside` runs: `start` is whether the previous run is also inside,
   `end` whether the next is. Placeholder runs share a frozen `NO_CONTINUATION`.
5. **Reuse previous references.** Each new cell is replaced by the one in `previous` with the same
   `key` when `isSameCell` holds (key, `inside`, `pin`, `continues`, `props.style` and
   `props['data-dg-columns']` equal). If all cells are reused and the length is the same, `previous`
   itself is returned.

Invariants and edge cases:

- Props are frozen and **a style string**, for the same reason as cell props (see `compileCellStyle`).
- Cell comparison does not look at `columns` (an array of names): the tokens in `data-dg-columns`
  already encode the same list.
- The matching in step 5 is by key via `find`, O(n^2) in the number of cells; the number of runs is
  small (bounded by pin side changes and span edges).
- With every column being spacer-free, rendering windows make `columns` contain spacer entries
  (`column: null`); they take part in runs like any other item.

Used by: `engine/use-grid-engine.ts`, in `getColumnSpan(start, end)`. The engine keeps a `Map` of
results by `"start:end"` and passes the cached array as `previous`; the cache is cleared when it reaches
`SPAN_CACHE_LIMIT` entries. Internals only (`ColumnSpanCell` is the public result type).

Tests: `tests/render/column-span.spec.ts` (runs split by pin side, `continues`, grow sum, attributes,
insets, empty cases, reference reuse).

---

## `use-grid-geometry.ts`

### `useGridGeometry(host, layers)`

```ts
function useGridGeometry(
	host: MaybeRefOrGetter<HTMLElement | null>,
	layers: MaybeRefOrGetter<readonly GeometryLayer[]>,
): void
```

The only reactive and DOM-touching file of the folder. It writes layers to elements after every
render, imperatively, so a resize frame changes a few `style` properties and skips Vue's render.

**Internal state**: `applied: Map<selectorOrRoot, { elements, style }>` (what is currently written and
where), `observed` (the root), two `MutationObserver`s and `watchingTree`. The root is keyed by the
sentinel `'\u0000root'` (cannot clash with a real selector).

**The effect** (`watchEffect`, `flush: 'post'`: selector layers must find the elements this render
produced):

1. `observe(element)`: if the root changed, disconnect, reset `applied` (a new root has none of the old
   properties, so it receives every property, not only the changed ones) and create the observers.
   Without a root, or without `MutationObserver` (server), nothing is written.
2. **Merge** layers by key (`selector ?? ROOT`); layers of one key are merged, later overriding
   earlier.
3. For each merged key, find `elements` (the root, or `querySelectorAll(key)`), then write each
   property with `setProperty`. For the **root** with a previous entry, skip properties whose value
   did not change (`byDiff`). Selector layers are written in full every time, because freshly rendered
   elements may match and have no property yet.
4. Remove properties that were in the previous layer of the key but are not in the new one.
5. For keys in `applied` that no longer exist, remove all their properties from their elements: "a
   removed layer takes its properties with it, or a resize override would outlive the gesture".
6. Replace `applied`, then `syncTreeObserver()`.

**Two keep-alive mechanisms** (the point of the observers):

- `rootObserver` watches `style` attribute changes of the root and calls `restoreRoot`. Vue sets
  `cssText` when a *string* `style` of the root changes, which drops every property set with
  `setProperty`. `restoreRoot` rewrites the properties whose value no longer matches. Only the root
  needs this: cells are not re-styled by this code path.
- `treeObserver` (`childList`, `subtree`) calls `applyToAdded`: for every added element and its
  descendants matching an active selector layer, write the layer and remember the element (so it is
  cleaned at the end). It handles rows scrolled into view during a resize. It is **connected only while
  a selector layer exists** (`syncTreeObserver`): during a gesture, not on every scroll.

`onScopeDispose(disconnect)` stops both observers.

Guarantees seen in tests (`tests/render/use-grid-geometry.spec.ts`): no throw before mount or for a
selector that matches nothing; a root that appears later gets all geometry; the unchanged root property
is not rewritten between frames; at the end of a gesture the overlay is removed from cells and the root
keeps the new committed width; cells mounted during the layer are cleaned with it; without a selector
layer, mounted cells are left alone.

Used by: re-exported at the root; the engine's JSDoc says to pass its `layers` to this composable
(`useGridEngine` does not call it itself; `packages/core/src/data-grid/use-data-grid.ts` does).
`getColumnCellSelector` is used by `core/src/columns/measure-column.ts` and
`core/src/drag/column-shift.ts`.

Layer sources in the engine (`use-grid-columns.ts`): `variables` (committed widths, pin offsets,
insets) is the root layer; `overlay` (live resize values that differ from committed) is one
`{ selector: getColumnSelector(name), style: diff }` layer per changed column, and `NO_LAYERS` when
nothing is being resized. That split is the whole performance design: rarely changing values go on the
root, per-frame values go only to the elements that read them.

---

## `index.ts`

Re-exports everything above by category (types, then values). Each export goes to exactly one of
`src/index.ts` or `src/internals.ts` (checked by `tests/entries.spec.ts`); the lists are at the top of
this page.
