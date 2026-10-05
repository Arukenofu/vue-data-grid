# `src/virtual`

The row and column windows. Given the scroll position and the size of the scroll container, this
folder decides which rows and which columns are rendered, where they stand, and how tall and wide the
whole list is. It also keeps the rows in view in place when rows come in above them, and scrolls to a
row.

```
virtual/
  index.ts                 public surface of the folder
  item-metrics.ts          positions and sizes along one axis, visible range, item objects (pure)
  anchor.ts                how far to scroll to keep the rows in view in place (pure)
  scroll.ts                the scroll position that shows a target between sticky edges (pure)
  column-window.ts         the rendered column list with spacers for the skipped columns (pure)
  use-mounted-element.ts   a ref to the root that is set only after mount
  use-scroll-viewport.ts   scroll position and size of the root, one ref per value
  use-anchored-scroll.ts   the scroll position the rows are windowed at, with the anchor shift applied
  use-virtual-columns.ts   the column ranges over the scrolling part of the row
  use-virtual-rows.ts      the row window: items, total size, measuring, scroll to a row
```

Layer: `virtual` sits above `columns`, `render` and `rows` (it imports `RenderedColumn`,
`stableComputed`, `getFlexSpacerStyle`) and below `engine`, which is its only consumer.

`index.ts` exports the pure functions, the types and the three composables below. Two files are
private to the folder and not in `index.ts`: `use-anchored-scroll.ts` (used by `use-virtual-rows.ts`)
and `use-mounted-element.ts` (used by `use-scroll-viewport.ts`).

| Where | Exports |
| --- | --- |
| Root (`src/index.ts`) | types only: `ColumnRange`, `PageDirection`, `ScrollAlign`, `VirtualItem` |
| `internals.ts` | `collectIndexes`, `createItemMetrics`, `expandRange`, `isSameRange`, `resolveAnchorShift`, `resolveColumnWindow`, `resolvePageStep`, `resolveScrollPosition`, `resolveVirtualItems`, `resolveVisibleRange`, `useScrollViewport`, `useVirtualColumns`, `useVirtualRows`; types `AnchorSnapshot`, `AnchorTarget`, `ColumnWindow`, `ItemMetrics`, `ItemRange`, `ScrollTarget`, `ScrollViewport`, `VirtualColumnsOptions`, `VirtualRowsOptions` |

The four root types are the ones that show up in the public shape of the engine (the `items` of the
row window, the column ranges, the align argument of `scrollToRow`, the page move direction). The
three composables and all the pure functions are building blocks; the stable way to get a window is
the engine (`useGridEngine`), which wires them.

How the pieces fit:

```
useScrollViewport(root) ──► scrollTop, scrollInline, width, height
        │
        ├─► useVirtualRows ── useAnchoredScroll ──► scrollTop adjusted by the anchor shift
        │        └─ item-metrics: createItemMetrics → resolveVisibleRange → expandRange
        │                          → collectIndexes → resolveVirtualItems  ──► items
        │
        └─► useVirtualColumns ──► range, visibleRange, scrollingRange
                 └─ (engine) resolveColumnWindow(columns, range, …) ──► rendered columns + spacers
```

---

## `item-metrics.ts`

The arithmetic of one axis. Rows use it for heights, columns for widths. Everything here is a pure
function of its arguments.

### `ItemMetrics`

```ts
interface ItemMetrics {
	readonly count: number;
	readonly total: number;
	startOf: (index: number) => number;
	sizeOf: (index: number) => number;
}
```

Item positions measured from the start of the list. `startOf(count)` is `total`, so the end of the
last item needs no special case. Everything else in the folder talks to a list through this
interface and never reads sizes directly, so uniform and variable lists share one code path.

### `createItemMetrics(count, size)`

```ts
function createItemMetrics(count: number, size: number | ((index: number) => number)): ItemMetrics
```

**Problem.** A grid with 100 000 rows of one height must not walk 100 000 rows on every change, and a
grid with different heights needs fast positions.

**How it works.**

1. `size` is a number: the metrics are plain arithmetic (`total = count * size`,
   `startOf = index * size`) and the list is never touched. This is the "uniform" fast path.
2. `size` is a function: it is called once per item and stored as prefix sums in a `Float64Array`
   of `count + 1` elements (`starts[index + 1] = starts[index] + size(index)`). `startOf` is a lookup,
   `sizeOf` is a difference of two neighbours, `total` is the last prefix.

So positions are O(1) and, together with the binary searches below, finding the item at a position is
O(log n). Building the sums is O(n), paid whenever the metrics are rebuilt (a new `computed` result).

Invariants: the result is immutable; a new object is returned every call. Callers that compare
metrics by reference (`useAnchoredScroll`) rely on the owner returning the same object while nothing
changed, which `useVirtualRows` gets from `computed`.

Used by: `use-virtual-rows.ts` (`metrics`) and `use-virtual-columns.ts` (`metrics`).

### `findStartAfter` and `findStartFrom` (private)

Two binary searches over `startOf`:

- `findStartAfter(metrics, position)` is the first index whose start is **greater than** `position`;
- `findStartFrom(metrics, position)` is the first index whose start is **at least** `position`.

They differ in one comparison (`>` versus `>=`) and that is the point: the difference decides the
edge cases of `resolveVisibleRange`. The item that holds a position is `findStartAfter(...) - 1`
(the last item that starts at or before it). The item that ends the visible area is
`findStartFrom(offset + size) - 1`, because an item that starts exactly at the lower edge of the
range is **not** visible.

### `ItemRange` and `resolveVisibleRange(metrics, offset, size)`

```ts
interface ItemRange { start: number; end: number }   // half-open [start, end)

function resolveVisibleRange(metrics: ItemMetrics, offset: number, size: number): ItemRange
```

The items that intersect `[offset, offset + size)`, in list coordinates (0 is the top or the inline
start of the first item).

How it works:

1. Empty list: the frozen `EMPTY_RANGE` constant (`{ start: 0, end: 0 }`), always the same reference.
2. `first` = the item that holds `offset`, clamped into `[0, count - 1]`.
3. `last` = the item before the first start that is `>= offset + size`, clamped into
   `[first, count - 1]`.
4. Return `{ start: first, end: last + 1 }`.

Edge cases, all from the clamps:

- A viewport past either end of the list, or of zero size, **still yields the nearest item**. The
  comment in the source gives the reason: a window should never render empty while the list is not.
  The consequence is that callers who need "nothing is in view" must check for it themselves; the
  `visibleRange` in `useVirtualRows` and `useVirtualColumns` do (they return `NO_RANGE` for a zero
  size).
- An item that starts exactly at `offset + size` is outside the range; an item that ends exactly at
  `offset` is outside it too (it is not the one that holds `offset`).
- Fractional sizes work, since the comparison is against `startOf`.

A new object is returned on each call, except the empty case. Callers that need a stable range
compare with `isSameRange` inside `stableComputed`.

Used by: `anchor.ts`, `use-anchored-scroll.ts`, `use-virtual-rows.ts` (window and `visibleRange`),
`use-virtual-columns.ts` (window and `visibleRange`).

### `findItemAt` (private)

The item whose span holds a position, clamped to `[0, count - 1]`; past either end of the list it is
the item at that end. Used by `resolvePageStep`.

### `PageDirection` and `resolvePageStep(metrics, index, direction, page)`

```ts
type PageDirection = 'up' | 'down';

function resolvePageStep(metrics: ItemMetrics, index: number, direction: PageDirection, page: number): number
```

How many items a PageUp or PageDown move passes. The keyboard code needs "a page" in **items**, but a
page is a height, and items differ in height.

How it works:

1. No items: `1`.
2. `from` = `index` clamped into the list (a stale index never reads outside).
3. Take the start of `from`, add or subtract `page` px, find the item at that position (`findItemAt`).
4. The step is `|target - from|`, never less than `1`.

The "at least one" is deliberate: a page smaller than an item (or a zero page before mount, see
`getPageStep` below) must still move the focus.

### `expandRange(range, overscan, count)`

```ts
function expandRange(range: ItemRange, overscan: number, count: number): ItemRange
```

Widens the range by `overscan` items on each side, clamped into `[0, count)`. With `overscan <= 0` it
returns **the same range object**, not a copy, which keeps the reference stable on that path. Only
rows use it; columns use pixel buffers instead (widths differ).

### `collectIndexes(range, keep, count)`

```ts
function collectIndexes(range: ItemRange, keep: readonly number[], count: number): number[]
```

Turns the window range plus the "kept" indexes (rows that must stay rendered because they are under a
gesture or under focus) into one ascending list of indexes.

How it works:

1. Push every index of the range.
2. From `keep`, take the ones that are integers, in `[0, count)` and **outside** the range.
3. No extras: return the list as is. Otherwise merge through a `Set` (drops repeats in `keep`) and sort
   ascending.

Why the filter on integers and bounds: `keep` comes from other parts of the engine (focus, drag) and
can be stale after rows were removed; a bad index must not produce a phantom row. The result is
always sorted so rows render in order, whatever order the kept ones were given in.

### `isSameRange(current, next)`

```ts
function isSameRange(current: ItemRange | null, next: ItemRange | null): boolean
```

Equal by identity, or both non-null with equal `start` and `end`. `null` equals only `null`. This is
the comparison inside every `stableComputed` range in the folder. It accepts `ColumnRange` as well
because the two shapes are the same.

### `VirtualItem`

```ts
interface VirtualItem {
	key: string;
	index: number;
	start: number;
	end: number;
	size: number;
}
```

One rendered row. `index` is the index into `rows`. `start` and `end` are edges along the scroll axis
in px: the offset in the body **plus `scrollMargin`**. `bodyOffset` is deliberately left out (see
`useVirtualRows`): it moves the whole body, and items must keep their objects while it changes.

### `resolveVirtualItems(indexes, metrics, getKey, margin?, previous?)`

```ts
function resolveVirtualItems(
	indexes: readonly number[],
	metrics: ItemMetrics,
	getKey: (index: number) => string,
	margin = 0,
	previous: readonly VirtualItem[] = [],
): readonly VirtualItem[]
```

**Problem.** Row render caches compare `VirtualItem` objects by reference. If every scroll frame
created new item objects, every row would re-render on every frame. The list of items is also a
reference that the template reads.

**How it works.** For each index, in order:

1. Compute `key`, `start = margin + metrics.startOf(index)`, `size = metrics.sizeOf(index)`.
2. Try `previous[position]` (the item at the same place in the list). It is reused if its `key`,
   `index`, `start` and `size` all match (`isSameItem`).
3. If not, look for the item **by key** in a `Map` of `previous`. The map is built lazily, `??=`, on the
   first item that moved; a window scrolled by a few rows finds most items at the same position
   after the first miss is paid for, and a window that did not change never builds the map. It is
   reused if the four fields match.
4. Otherwise create a new `{ key, index, start, end: start + size, size }`.
5. Track whether every item is identical to `previous[position]` and the length is equal. If so,
   return `previous` itself.

Consequences worth knowing:

- A kept row that moves inside the window (a row under focus that was outside the range, and now is
  inside it) keeps its item object because the match is by key, not by position.
- New row **objects** under the same keys leave the items untouched: items hold only key, index and
  geometry, never the row data. The row data is looked up by index when rendering.
- An item whose `index` changes (rows were inserted above) is replaced, since its geometry is not the
  same.

Used by: `use-virtual-rows.ts` (`items`).

---

## `anchor.ts`

### `AnchorSnapshot`, `AnchorTarget`

```ts
interface AnchorSnapshot {
	metrics: ItemMetrics;
	getKey: (index: number) => string | undefined;
}

interface AnchorTarget extends AnchorSnapshot {
	getIndex: (key: string) => number;   // -1 for none
}
```

The list at one moment. `AnchorSnapshot` (the list **before** the change) only answers "what key is at
this index"; for a row that was not rendered or not read it may answer `undefined`. `AnchorTarget` (the
list **after**) can also find an item by key.

### `resolveAnchorShift(previous, next, offset, size)`

```ts
function resolveAnchorShift(previous: AnchorSnapshot, next: AnchorTarget, offset: number, size: number): number
```

**Problem.** A page of rows is loaded at the **top** of a list (a chat, a log, an infinite scroll
upwards). The rows in view jump down by the height of the new rows. To keep the screen still, the
scroll position must move by the same amount. The function computes that amount; it does not scroll.

`offset` and `size` are the part in view in list coordinates **before** the change. The result is the
px distance the first item in view moved by.

How it works:

1. `visible` = `resolveVisibleRange(previous.metrics, offset, size)`. If it is empty, or the new list is
   empty, return `0`.
2. `first` = the key at `visible.start` before the change. If it is unknown, return `0`.
3. Fast exit: if the key at the **same index** after the change is still `first`, nothing moved above:
   return `0`. This covers rows added at the end and rows measured anew, and costs no lookup.
4. `moved` = the new index of `first` (`getIndex`). Not found (`< 0`): return `0`. `delta = moved -
   visible.start`.
5. Check every other item in view: its key before must be known, and the item at `index + delta` after
   must exist and have the same key. Any mismatch returns `0`.
6. Return `next.metrics.startOf(moved) - previous.metrics.startOf(visible.start)`.

The all-items-moved-by-the-same-count check in step 5 is the invariant that makes this safe: **only
when every item in view moved by as many places as the first did, the change was all above them**. So:

| Change | Result |
| --- | --- |
| rows added or removed below the view | `0` |
| a sort or a filter (items scatter) | `0` |
| a page added at the top | the height of the added rows |
| a page added at the top while another is dropped at the bottom (a page limit) | the height of the added rows |

It reads the keys of the visible items only, and the key search by `getIndex` happens in one case.
The cost is proportional to the rows in view, not to the list.

Used by: `use-anchored-scroll.ts` (`resolveShift`). Exported to `internals.ts`.

---

## `scroll.ts`

### `ScrollAlign`, `ScrollTarget`

```ts
type ScrollAlign = 'start' | 'center' | 'end' | 'auto';

interface ScrollTarget {
	start: number;       // edges of the target in scroll-content coordinates along the axis, px
	end: number;
	insetStart: number;  // how much of each edge sticky content covers, px
	insetEnd: number;
	viewport: number;
	scroll: number;
	max: number;         // content size minus viewport size
	align: ScrollAlign;
}
```

Everything the calculation needs, as numbers. The same type serves both axes: rows pass the sticky
top and bottom as insets, columns pass the pinned start and end widths.

### `resolveScrollPosition(target)`

```ts
function resolveScrollPosition(target: ScrollTarget): number | null
```

The scroll position that puts the target at `align` inside the **uncovered** part of the viewport (the
part between the sticky edges); `null` when no scrolling is needed.

How it works:

1. `toStart = start - insetStart` puts the target's start just below the start inset.
   `toEnd = end - viewport + insetEnd` puts its end just above the end inset.
2. `'start'` uses `toStart`, `'end'` uses `toEnd`, `'center'` their mean.
3. `'auto'` scrolls just enough:
   - the target starts above the uncovered part, **or** is larger than the uncovered part: `toStart`
     (a target that does not fit is aligned to the start);
   - the target ends below the uncovered part: `toEnd`;
   - otherwise the current `scroll` stays.
4. The result is clamped into `[0, max]` (a negative `max` counts as `0`) and rounded to an integer.
5. If the rounded result equals the rounded current `scroll`, return `null`.

Why the rounding and the `null`: browsers store scroll positions in whole pixels in many cases;
comparing rounded values means "already there" is detected and the caller does not issue a no-op
scroll (and, in `scrollToIndex`, stops its correction loop).

Used by: `use-virtual-rows.ts` (`scrollToIndex`) and `engine/use-grid-engine.ts` (scrolling to a column,
horizontal, with pinned widths as insets; it takes the absolute `scrollLeft` and negates the result in a
right-to-left container).

---

## `column-window.ts`

### `ColumnRange`

```ts
interface ColumnRange { start: number; end: number }   // half-open, indexes in `columns`
```

A run of adjacent columns, such as the ones in view. It is a root type.

### `ColumnWindow`

```ts
interface ColumnWindow {
	rendered: readonly RenderedColumn[];
	leadingWidth: number;
	trailingWidth: number;
}
```

`rendered` is the window plus the pinned and row header columns, with **spacer columns** standing in
for the skipped ones. `leadingWidth` and `trailingWidth` are the total widths of the skipped columns
before and after the range, px (the sum of all spacers on that side).

### `resolveColumnWindow(columns, range, getWidth, previous?, spacerStyle?)`

```ts
function resolveColumnWindow(
	columns: readonly RenderedColumn[],
	range: ColumnRange | null,
	getWidth: (name: string) => number,
	previous?: ColumnWindow | null,
	spacerStyle: (width: number) => string = getFlexSpacerStyle,
): ColumnWindow
```

**Problem.** A row of 200 columns must render maybe 15. But the row still has to be as wide as
before, and the rendered cells have to stay in the right places. Skipped columns are replaced by
empty spacer columns of the same total width.

How it works:

1. **Find the pinned edges.** `pinnedStart` is the number of leading columns with `pin === 'start'`,
   `pinnedEnd` is where the trailing `pin === 'end'` columns begin. Pinned columns are never skipped.
2. **Clamp the range** into `[pinnedStart, pinnedEnd]`. No range (`null`: windowing is off or the root
   is not mounted) means the whole scrolling part is in the range.
3. **Walk the scrolling columns** (`pinnedStart` to `pinnedEnd`) and build `parts`. A column in the
   range, or a **row header** column anywhere, is pushed as is. Any other column is added to a
   `SkippedRun` of the same side (`'start'` before the range, `'end'` after it); a run accumulates
   width, and `leadingWidth` / `trailingWidth` grow in step.
4. **Runs do not cross the range**, even an empty one: the run types are distinguished by side.
5. **Fast exit.** No nonzero runs and every column present: nothing is skipped, so the window is the
   input `columns` array itself. If `previous.rendered === columns` the previous window object is
   returned, otherwise a new one with zero widths.
6. **Assign spacers.** Each nonzero run becomes one spacer column. Its key is built from its distance
   from the range (`getSpacerKey`): `dg-spacer-start` next to the range, `dg-spacer-start-1` one run
   farther, and so on; on the end side the distance counts up from the range, so `dg-spacer-end`,
   `dg-spacer-end-1`... A row header column outside the range splits the skipped columns on its side
   into two runs, which is why several spacers per side are possible and why keys are by distance
   rather than by side only. A run with zero width is dropped.
7. **Assemble** `rendered`: the pinned-start columns, the middle parts, then the pinned-end columns.
8. **Compare with `previous`** (`isSameWindow`): same widths, same length and every element `===`. If so,
   return `previous`.

Spacer columns (`createSpacerColumn`) are `RenderedColumn` objects with `column: null`, `index: -1`,
`spacer: side` and frozen `cellProps` / `headerProps` (the same object for both) holding the `key`,
`data-dg-spacer` and `style`. The style comes from `spacerStyle(width)` and defaults to
`getFlexSpacerStyle` from `render/geometry`; the engine passes `cellStyles.spacer`.

**Reference stability.** The window comparison in step 8 is element-wise, so the spacer must also be
the same object for the same state. `resolveSpacer` looks up the previous window for a column with
the same key and reuses it **while its style string is equal**. The style is a string, not an object,
for the same reason as elsewhere in the engine (see "Stable references" in the README). The effect: a
scroll frame that keeps the same columns and the same skipped widths returns the very same
`ColumnWindow`, and nothing below recomputes. When the skipped width changes, only the affected spacer
is a new object.

Note on `getWidth`: it takes the column **name**; a column without a model uses `''`.

Used by: `engine/use-grid-engine.ts` (`columnsWindow`, a `stableComputed` fed with `columnWindow.range`).
The engine's `windowed` flag is `renderedColumns !== columns.columns` (identity), which relies on
step 5 returning the input array itself.

---

## `use-mounted-element.ts`

### `useMountedElement(source)`

```ts
function useMountedElement(source: Ref<HTMLElement | null>): ShallowRef<HTMLElement | null>
```

Exposes the root element only **after mount**. Before mount it is `null`, even if `source` already
holds an element (a template ref is set during the first render).

Why: the windows treat "no element" as "render the server set" (`ssrCount` rows, all columns). If the
element appeared during the first client render, the client's first frame could differ from the
server's HTML and break hydration. Gating on `onMounted` makes the server frame and the hydration
frame identical.

How it works:

1. A local `shallowRef` starts at `null`.
2. A `watch(source, ..., { flush: 'sync' })` copies changes into it, but only once `mounted` is true.
3. `onMounted` sets `mounted` and copies the current value.

After mount, it follows the source, including to `null` (the root is unmounted or replaced) and to a
new element; `flush: 'sync'` makes a swap visible to readers at once.

Private to the folder: used by `use-scroll-viewport.ts` only. Must be called in a component's
`setup` because of `onMounted`.

---

## `use-scroll-viewport.ts`

### `ScrollViewport`

```ts
interface ScrollViewport {
	element: Readonly<ShallowRef<HTMLElement | null>>;
	scrollTop: Readonly<ShallowRef<number>>;
	scrollInline: Readonly<ShallowRef<number>>;
	width: Readonly<ShallowRef<number>>;
	height: Readonly<ShallowRef<number>>;
	sync: () => void;
}
```

The scroll state of the grid root, shared by the row window and the column window.

- `element`: the root once mounted; `null` on the server and before mount.
- `scrollTop`: the vertical position.
- `scrollInline`: the horizontal distance from the **inline start**, px, never negative. In a
  right-to-left container `scrollLeft` is zero or negative; the value is `Math.abs(scrollLeft)`, so it
  stays the distance from the right edge and the column code does not know about direction.
- `width`, `height`: `clientWidth` and `clientHeight`, the visible area without scrollbars, px.
- `sync()`: reads `scrollTop` and `scrollInline` from the element right now.

### `useScrollViewport(root)`

```ts
function useScrollViewport(root: Ref<HTMLElement | null>): ScrollViewport
```

How it works:

1. `element = useMountedElement(root)`; four `shallowRef(0)` for the numbers.
2. A `watch(element, ..., { immediate: true, flush: 'sync' })` runs when an element appears or changes.
   For a non-null element it reads scroll and size once, adds a **passive `scroll` listener** and
   creates a `ResizeObserver` (if the environment has one; otherwise there is no observer, only the
   initial size read). `onCleanup` removes the listener and disconnects the observer, so replacing
   the element leaks nothing. A `null` element does nothing and leaves the last numbers.
3. `sync()` reads the position directly.

**Why `sync` exists.** The `scroll` event fires with the next frame after a programmatic scroll. When
code sets `scrollTop` and then needs the windows to see the new position in the same tick (the anchor
shift, `scrollToIndex`), it calls `sync()` instead of waiting.

**Why separate refs.** Each axis is its own ref, so vertical scrolling never wakes the column window
and horizontal scrolling never wakes the row window. A `shallowRef` assigned a value equal to its
current one does not trigger, so a scroll event that moved only one axis, or a resize that changed only
height, wakes only the readers of that value.

Used by: `engine/use-grid-engine.ts`, which creates one viewport from `options.root` and gives it to
both windows.

---

## `use-anchored-scroll.ts`

Private to the folder, used by `useVirtualRows`. The most subtle file; read it with the tests
`use-virtual-rows.spec.ts` ("keeps the rows in view in place ..." group).

### `AnchoredScrollOptions`

```ts
interface AnchoredScrollOptions {
	viewport: ScrollViewport;
	metrics: () => ItemMetrics;
	getItemKey: (index: number) => string;
	getItemIndex: (key: string) => number;      // -1 for none
	bodyOffset: () => number;
	pageHeight: () => number;
	atTop: () => boolean;
}
```

`bodyOffset` is the height of what stands between the sticky top and the body and scrolls away.
`pageHeight` is the height of the part of the viewport where rows are seen (between the sticky top and
bottom). `atTop` says whether rows are kept in place also at scroll position 0.

### `useAnchoredScroll(options)`

```ts
function useAnchoredScroll(options: AnchoredScrollOptions): {
	scrollTop: ComputedRef<number>;
	scrollTo: (position: number) => void;
	scrollBy: (delta: number) => void;
}
```

**Problem.** When rows come in above the ones in view (or the body offset above them changes), the
content grows and the browser keeps `scrollTop`, so the rows in view slide down. The grid wants to
keep them where they were on the screen. But the element can only be scrolled after the DOM is as
tall as the new rows, which is after the render. If the window and the visible range were computed
from the old `scrollTop` in that render, they would show the wrong rows for one frame.

**Idea.** `scrollTop` here is a computed that **runs ahead of the element**: it returns the position
the element *will* have (the viewport's plus a `shift`), so everything read in the render, the row
window and the rows in view, already sees the rows in place. After the render, a `flush: 'post'`
watcher scrolls the element to that position, and the two meet.

State (plain variables, not refs, by design):

- `anchor`: what was in view at the last read (`Anchor`): the element, the `metrics` object, the
  `bodyOffset`, the `scrollTop` it was read at, the `start` index of the first visible row and the
  `keys` of the visible rows.
- `shift`: how far the position runs ahead of the element, px.
- `revision` (a `shallowRef`): bumped after the element is scrolled from here, so the computed reads
  the position again.

The `scrollTop` computed:

1. Reads `revision`, the element, `metrics()`, `bodyOffset()` and the viewport's `scrollTop`.
2. **No anchor yet, or the element changed**: `shift = 0`. A new root starts from its own position;
   rows measured in the old one say nothing about it.
3. **Otherwise**, only if the previous read was scrolled (`anchor.scrollTop > 0`) or `atTop()` is true:
   `shift += resolveShift(anchor, metrics, bodyOffset)`. This is the rule "at the very top nothing is
   kept in place unless `atTop` says so": at 0, what comes in above shows, as in browsers.
4. `result = max(current + shift, 0)`.
5. `shift = result - current`: if the result was clamped at 0, or a scroll in the same flush
   cancelled the shift, the leftover is dropped, so nothing is scrolled needlessly and the next
   real scroll lands where the user put it.
6. The anchor is re-read at `result` (`readAnchor`), or set to `null` without an element.

`resolveShift(previous, metrics, bodyOffset)`:

- starts with `bodyOffset - previous.bodyOffset` (a body that moved down by N px moves the rows by N);
- if `metrics !== previous.metrics` (the rows changed), adds `resolveAnchorShift` computed from the
  **previous** keys (`previous.keys[index - previous.start]`) against the new list (`getItemKey`,
  `getItemIndex`), over the part that was in view: `previous.scrollTop - previous.bodyOffset` with
  `pageHeight()`.

`readAnchor` avoids reading keys on every scroll frame: the `keys` array is reused unless the
`metrics` object, the `start` index or the number of visible rows changed.

The `flush: 'post'` watcher watches **how far the position runs ahead**
(`scrollTop - viewport.scrollTop`, or `0` without an element), not the position itself. A scroll
and a shift that meet in one flush can leave the position equal to the old one while the element is
elsewhere; watching the difference still fires. When the difference is not zero it calls `apply`.

`apply(position)`: sets `shift = 0`, writes `root.scrollTop`, calls `viewport.sync()`, bumps
`revision`. Without an element it does nothing.

Public methods, which exist so that other code does not write over a pending shift:

- `scrollTo(position)`: `anchor = null`, then `apply`. For a position worked out from the rows **as
  they are now** (`scrollToIndex`): the pending shift is dropped, because the position already
  accounts for it. The test "scrolls to a row asked for in the same tick as rows came in above" covers
  this.
- `scrollBy(delta)`: adds `delta` to the element's `scrollTop` and syncs. The pending shift **stays**.
  For rows above that changed height (see `handleResize`).

Reference stability: the result is a number, so a computed that returns the same value does not wake
its readers. The `keys` array of the anchor is reused as described.

---

## `use-virtual-columns.ts`

### `VirtualColumnsOptions`

```ts
interface VirtualColumnsOptions {
	viewport: ScrollViewport;
	columns: () => readonly RenderedColumn[];
	enabled: () => boolean;
	getWidth: (name: string) => number;
	inset: () => number;
	bufferPx: () => number;
	keep: () => readonly string[];
}
```

`columns` are the shown columns in display order with the pinned ones included. `inset` is the width
of the service columns at the start edge. `bufferPx` is the extra width rendered past each edge of the
viewport, **in pixels, not columns**, since widths differ. `keep` is the column names that must
stay rendered (under a gesture or focus).

### `useVirtualColumns(options)`

```ts
function useVirtualColumns(options: VirtualColumnsOptions): {
	range: ComputedRef<ColumnRange | null>;
	visibleRange: ComputedRef<ColumnRange>;
	scrollingRange: ComputedRef<ColumnRange>;
}
```

The column window over the **scrolling part** of the row. Pinned columns are never windowed: their
width together with the start inset is where the scrolling part begins. All ranges are in indexes of
`columns` (the whole list, pinned included), not of the scrolling part.

Internals:

- `scrolling` (computed): `start` and `end` of the scrolling part, by walking past the leading
  `pin === 'start'` and trailing `pin === 'end'` columns, plus `items`, the slice between them.
- `margin`: `inset()` plus the width of the columns before the scrolling part, i.e. where the scrolling
  part begins horizontally.
- `marginEnd`: the width of the pinned-end columns, which cover the viewport from its end edge.
- `metrics`: `createItemMetrics` over the scrolling columns, sized by `getWidth(name)`.

The three outputs, each a `stableComputed` over `isSameRange` (the same object while the range holds):

- **`range`**: the window to render. `null` when `enabled()` is false, when there is no element yet, or
  when there are no scrolling columns; `resolveColumnWindow` treats `null` as "render all". Otherwise
  `resolveVisibleRange(metrics, scrollInline - margin - buffer, width + 2 * buffer)`, then each kept
  column found in the scrolling part widens the range to include it, and the result is shifted by the
  scrolling start into the indexes of `columns`. Because the window is always **one contiguous slice**,
  a kept column far from the view stretches the window up to it rather than being rendered alone (a
  rendered column on its own would need a spacer on each side, which the structure does not have).
  The window ignores a kept name that is not among the scrolling columns, such as a pinned one: pinned
  columns are always rendered.
- **`visibleRange`**: the scrolling columns that are in view, at least partly, between the pinned ones,
  **whether the window is on or not**. Width is `viewport.width - margin - marginEnd`; if there is no
  element, no width left, or no scrolling columns, it is the frozen `NO_RANGE`. The position is
  `scrollInline` directly, since scrolling columns start after the start margin in their own
  coordinates. It has no buffer and no kept columns.
- **`scrollingRange`**: all the scrolling columns, `{ start, end }` of the scrolling part.

Used by: `engine/use-grid-engine.ts` builds one with the viewport it shares with rows. `range` feeds
`resolveColumnWindow`; `visibleRange` and `scrollingRange` are exposed on the scope as
`visibleColumnRange` and `scrollingColumnRange`; `core/src/loading/use-grid-edge.ts` reads both from
the scope.

---

## `use-virtual-rows.ts`

### `VirtualRowsOptions`

All inputs are getters so the composable reads them reactively. The ones that are not obvious:

| Option | Meaning |
| --- | --- |
| `overscan` | rows rendered past each edge of the viewport |
| `scrollMargin` | height of the sticky top: the body starts below it; scrolling to a row keeps it uncovered |
| `scrollMarginEnd` | height of the sticky bottom (a footer, rows pinned there); scrolling to a row keeps it uncovered |
| `bodyOffset` | height of what stands between the sticky top and the body and **scrolls away**; the body starts below it too |
| `anchorAtTop` | whether rows coming in above keep the rows in view in place also at the very top |
| `estimateSize(index)` | height of a row, or its estimate until measured |
| `uniformSize()` | one height for every row (positions are then arithmetic); `null` otherwise |
| `measured()` | rows are measured in the DOM through `measureElement` |
| `getItemKey(index)` | key of a row |
| `getItemKeys()` | keys of every item, shared with others: a new array only when they change |
| `getItemIndex(key)` | index of a key, `-1` for none |
| `keep()` | row indexes that must stay rendered |
| `ssrCount()` | rows rendered before the root is mounted |
| `indexAttribute` | the attribute with the row index that the markup puts on each row element |

### `useVirtualRows(options)`

```ts
function useVirtualRows(options: VirtualRowsOptions): {
	items: ComputedRef<readonly VirtualItem[]>;
	totalSize: ComputedRef<number>;
	range: ComputedRef<ItemRange | null>;
	visibleRange: ComputedRef<ItemRange>;
	getPageStep: (index: number, direction: PageDirection) => number;
	getOffset: (index: number) => number;
	measureElement: (target: Element | ComponentPublicInstance | null) => void;
	scrollToIndex: (index: number, align?: ScrollAlign) => void;
}
```

The row window. Rows intersecting the viewport plus `overscan` on each side are rendered, and so are
the kept ones. Before the root is mounted, the first `ssrCount` rows are rendered, so the server and
the hydration frame agree.

**Coordinates.** Three offsets come into play and they are easy to mix up:

- The body starts at `getBodyStart() = scrollMargin + bodyOffset` in the scroll content.
- Items are placed at `scrollMargin + startOf(index)` (the margin is passed to `resolveVirtualItems`),
  **without** `bodyOffset`. `bodyOffset` moves the whole body (an element above the rows scrolls away
  with the content), so the items keep their positions and objects while it changes.
- The window is computed in list coordinates at `scrollTop - getBodyStart()`. The rows in view
  (`visibleRange`) at `scrollTop - bodyOffset`, since the sticky top does not cover rows but the
  scrolling-away block does.

**Sizes and metrics.**

- `sizes`: a `shallowRef(new Map<key, px>)`, mutated in place and triggered once per batch of
  measurements (`triggerRef`). Stored **by row key**, so heights survive sorting and streaming.
- `keys`: `getItemKeys()` when `measured()`, otherwise `null` (so unmeasured grids do not depend on the
  key list).
- `metrics` (computed) picks one of three paths: uniform size and not measured: arithmetic
  `createItemMetrics(count, uniform)`; not measured: `estimateSize`; measured: per row
  `sizes.get(key) ?? estimateSize(index)`.

**Outputs.**

- **`range`** (`stableComputed`): `null` when disabled or no element. Otherwise
  `expandRange(resolveVisibleRange(metrics, scrollTop - bodyStart, viewport.height), overscan, count)`,
  where `scrollTop` is the **anchored** one. Same object while the range holds (`isSameRange`).
- **`items`** (`stableComputed`): the indexes depend on the state:
  - window disabled: every row (`collectIndexes` over `[0, count)`);
  - no element (server, hydration frame): the first `min(count, ssrCount)`;
  - otherwise `range` plus `keep()`.
  Then `resolveVirtualItems(indexes, metrics, getItemKey, scrollMargin, previous)`, so the array and its
  items keep their references as described above. The comment in the source states the contract: a kept
  row that moves inside the window re-renders nothing.
- **`totalSize`**: `metrics.total`, the full height of the body, known before any row is rendered.
- **`visibleRange`** (`stableComputed`): rows between the sticky top and bottom, **without overscan and
  without kept rows**. `getPageHeight()` is `viewport.height - scrollMargin - scrollMarginEnd`
  (clamped at 0). When there is no element or the page height is `0` (the sticky blocks cover
  everything) it is the frozen `NO_RANGE`, because `resolveVisibleRange` would give the nearest row.
- **`getPageStep(index, direction)`**: `resolvePageStep` with the page height; before mount the page is `0`,
  so the step is one row.
- **`getOffset(index)`**: the offset of the row's top edge from the top of the first row; the index is
  clamped into `[0, count]`, so `getOffset(count)` is the total height.

**Measuring.**

`measureElement` is a ref callback for a row element (`:ref="measureElement"`). It accepts an element
or a component instance (`$el` is taken), ignores non-`HTMLElement`s, already observed elements
(a `WeakSet`), and does nothing if `measured()` is false or `ResizeObserver` does not exist. One
`ResizeObserver` is created lazily for all rows.

`handleResize(entries)` for each entry:

1. An element no longer in the DOM (`!isConnected`) is unobserved and forgotten.
2. The row index comes from `indexAttribute` on the element. An invalid index, one outside the list,
   or a size that is not `> 0` is skipped. Zero means the row is hidden together with the grid
   (for example `display: none`), not empty: its known height is kept.
3. The size is `borderBoxSize[0].blockSize`, or `offsetHeight` if the entry lacks it.
4. The height is stored under the row key; if it differs from the previous metrics, the row is
   marked as changed. If its top is **above** `root.scrollTop` (`margin + startOf(index) <
   scrollTop`), the difference is added to `shift`.

After the loop: if more heights are stored than there are rows, `forgetGoneRows` removes the keys that
are not in `getItemKeys()` (otherwise a stream of new keys would grow the map forever; the count check
makes the cleanup run only when it can find something). If anything changed, `triggerRef(sizes)` once.
A nonzero `shift` calls `anchored.scrollBy(shift)`, so a row that changes height above the viewport
moves the scroll by the same amount and the rows in view stay in place; a row in view leaves the
scroll alone.

**Scrolling to a row.**

`scrollToIndex(index, align = 'start')`:

1. Cancels a pending correction frame. Does nothing without an element or for an index outside the
   list.
2. `step()` computes the target (`getBodyStart() + startOf(index)`, size `sizeOf(index)`), calls
   `resolveScrollPosition` with `scrollMargin` and `scrollMarginEnd` as insets and the element's real
   `clientHeight`, `scrollTop` and `scrollHeight - clientHeight`, then `anchored.scrollTo(position)`.
3. With `measured()`, the neighbours of the target are measured only after they are rendered, so the
   position can still be off: the step is repeated on `requestAnimationFrame`, at most
   `MAX_SCROLL_CORRECTIONS` (10) times, and stops as soon as `resolveScrollPosition` returns `null`.
   Without measuring the first step is final. Without `requestAnimationFrame` there is no repeat.

`onScopeDispose` cancels the pending frame and disconnects the observer.

Used by: `engine/use-grid-engine.ts`: `items`, `totalSize` and `measureElement` go on the scope as
they are; `visibleRange` as `visibleRowRange`, `getPageStep`, `getOffset` as `getRowOffset`, and
`scrollToIndex` as `scrollToRow`. In `core`, `VirtualItem` is used in `components/context.ts` and
`data-grid/use-data-grid.ts`.

---

## Tests

`packages/engine/tests/virtual/` has one spec per file, except the two private files:
`item-metrics`, `anchor`, `scroll`, `column-window`, `use-scroll-viewport`, `use-virtual-columns` and
`use-virtual-rows`. The pure files are tested without Vue. `use-virtual-rows.spec.ts` is the best
description of the behaviour: SSR set, overscan, `scrollMargin` and `bodyOffset`, reference stability
of `items`, the anchor cases (a page at the top, `anchorAtTop`, a page limit, a clamped shift, a new
root, a new order), measuring (by key, forgetting gone rows, zero size, shift above the viewport) and
`scrollToIndex` for each alignment.
