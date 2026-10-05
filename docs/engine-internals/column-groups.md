# `src/column-groups`

Multi-level column headers: groups of columns ("Market" over "Price" over `last`, `change`), groups
that collapse, and groups that must stay contiguous. The folder turns a declarative group tree into
three things the rest of the engine needs:

- the **header group rows** (`scope.headerGroups`): cells with spans, pinning and geometry;
- the set of **columns hidden by collapsed groups**;
- a **veto for column moves** that would tear a `keepTogether` group apart.

It sits above `render` and `rows` and below `engine` (`columns` <- `render`, `rows` <-
`column-groups`, `virtual` <- `engine`). It reads `RenderedColumn` from `columns` and the geometry
helpers from `render`; the engine wires it in. The folder splits in three: **what a group is and the
pure layout algorithms** (`column-groups.ts`), **how a user declares groups** (`define-column-groups.ts`)
and **the reactive, reference-stable header rows** (`use-column-groups.ts`).

```
column-groups/
  index.ts               surface of the folder
  column-groups.ts       group types + pure algorithms: paths, rows, collapsing, keepTogether
  define-column-groups.ts defineColumnGroups: object key becomes the group name
  use-column-groups.ts   useColumnGroups: header rows as a computed with cached cells
```

Exports in the root (`src/index.ts`): the types `ColumnGroup`, `ColumnGroupExtension`,
`ColumnGroupInput`, `ColumnGroups`, `ColumnGroupsInput`, `GroupShowWhen`, `RenderedGroup` and the
function `defineColumnGroups`.

Exports in `internals.ts` only: the type `GroupCellDraft` and the functions `toGroupList`,
`resolveGroupPaths`, `getGroupDepth`, `resolveGroupRows`, `isCollapsibleGroup`,
`resolveCollapsedColumns`, `keepsGroupsTogether` and `useColumnGroups`.

Pure functions live in `column-groups.ts` and are tested without Vue
(`tests/column-groups/column-groups.spec.ts`); reactivity is confined to `use-column-groups.ts`.

---

## `column-groups.ts`

### Declaration types

```ts
type GroupShowWhen = 'expanded' | 'collapsed';

interface ColumnGroupExtension {}

interface ColumnGroupInput<TMeta = unknown> extends ColumnGroupExtension {
	label?: string;
	children: readonly string[];
	showWhen?: Readonly<Record<string, GroupShowWhen>>;
	collapsedByDefault?: boolean;
	keepTogether?: boolean;
	meta?: TMeta;
}

interface ColumnGroup<TMeta = unknown> extends ColumnGroupInput<TMeta> {
	name: string;
}

type ColumnGroupsInput = Readonly<Record<string, ColumnGroup>>;
```

- `ColumnGroupInput` is what a user writes; `ColumnGroup` adds the `name` that
  `defineColumnGroups` fills from the object key.
- `children` lists **column names and nested group names together**, in order. There is no separate
  field for nesting: a name is a nested group if some group has that name, otherwise it is a column
  (see `resolveGroupPaths`).
- `showWhen` maps a child name to the state of *this* group in which the child is visible. A child
  mapped to `'expanded'` is shown only while the group is expanded; `'collapsed'` only while it is
  collapsed; children not mentioned are always shown. A group with at least one entry is
  *collapsible* (`isCollapsibleGroup`). JSDoc warns to keep at least one child visible while
  collapsed, otherwise the group has no cell to expand it from; the code does not check it.
- `collapsedByDefault` is the starting state when the layout holds nothing for the group (see the
  engine usage below).
- `keepTogether`: moves never split the group's columns and no other column lands between them
  (`keepsGroupsTogether`).
- `meta` is a free slot typed by `TMeta`.
- `ColumnGroupExtension` is an empty interface that is **declared to be augmented**, exactly as
  `ColumnExtension` is for columns. `@vue-data-grid/core` augments it with an optional `header`
  render function (`packages/core/src/columns/column-fields.ts`). Because `ColumnGroupInput` extends
  it, an augmented field becomes valid in user declarations without the engine knowing about it.
- `ColumnGroupsInput` is the shape the engine option `groups` accepts as an object (its type is
  `Readonly<Record<string, ColumnGroup>>`, i.e. entries that already have a `name`, which is what
  `defineColumnGroups` returns).

### `GroupCellDraft`

```ts
interface GroupCellDraft {
	group: ColumnGroup | null;
	parent: ColumnGroup | null;
	columns: RenderedColumn[];
	pin?: ColumnPinSide;
	spacer?: RenderedColumn;
	continues: { start: boolean; end: boolean };
}
```

A cell of a group row **before styling**: what it covers and where it stands, with no geometry or
props yet. It is the output of the pure layout (`resolveGroupRows`) and the input of
`useColumnGroups`, which turns it into a `RenderedGroup`. Keeping the two stages apart is what lets
the layout be tested without Vue or CSS.

- `group` is `null` for columns that have no group at this level (the path is shorter than the
  level) and for a column-window spacer.
- `parent` is the group one level up, `null` at the top level.
- `columns` are the shown columns under the cell in display order; empty for a spacer.
- `spacer` holds the spacer `RenderedColumn` when the cell stands in for a column-window spacer.
- `continues` says whether the *same group* has more columns before (`start`) or after (`end`) this
  cell in the row; it is `true` when the group is cut by pinning, a move or the column window.

Only exported through `internals.ts`.

### `RenderedGroup`

```ts
interface RenderedGroup {
	group: ColumnGroup | null;
	parent: ColumnGroup | null;
	level: number;
	collapsible: boolean;
	collapsed: boolean;
	key: string;
	columns: readonly string[];
	pin?: ColumnPinSide;
	spacer?: ColumnPinSide;
	continues: Readonly<{ start: boolean; end: boolean }>;
	props: Readonly<Record<string, unknown>>;
	index: number;
	span: number;
}
```

A cell of a group row in `scope.headerGroups`, the public output. Notes on the fields:

| Field | Meaning |
| --- | --- |
| `level` | row number from the top, `0` is the outermost groups |
| `collapsible` / `collapsed` | the group has `showWhen` / it is collapsible *and* currently collapsed |
| `key` | name of the first column under the cell, or the key of a spacer; unique in the row, for `v-for` |
| `columns` | names of the shown columns under the cell; empty for a spacer |
| `spacer` | for a spacer cell, the pin side of the window spacer it stands for |
| `props` | `key`, `data-dg-group`, `data-dg-columns`, `data-dg-pinned`, `style` as one frozen object |
| `index` | position of the first covered column among shown columns from `0`; `-1` for a spacer. `aria-colindex` is `index + 1` |
| `span` | how many shown columns it covers (`aria-colspan`); `0` for a spacer |

The engine only supplies the numbers; roles and `aria-*` are applied in `@vue-data-grid/core`
(engine/core boundary in `CLAUDE.md`). `grid-header.ts` in core reads `grid.scope.headerGroups.value`
per level (verified by Grep).

### `toGroupList(groups)`

```ts
function toGroupList(
	groups: ColumnGroupsInput | readonly ColumnGroup[] | undefined,
): readonly ColumnGroup[]
```

Normalizes the `groups` option to an array: `undefined` gives `[]`, an array is returned as is, an
object gives `Object.values(...)`. The order of groups only matters for the "first group wins" rule
in `resolveGroupPaths`. For `undefined` it returns a fresh `[]` each call, so reference stability is
the caller's concern: in the engine the call sits inside a `computed`
(`use-grid-engine.ts`: `groupList`).

### `resolveGroupPaths(groups)`

```ts
function resolveGroupPaths(
	groups: readonly ColumnGroup[],
): Map<string, readonly ColumnGroup[]>
```

**Problem.** `children` is a flat list per group, mixing columns and sub-groups. Everything else
needs the opposite view: for a given column, which groups contain it, outermost first.

How it works:

1. Index groups by name (`byName`).
2. Build `parents`: for every group, for every child name, record that group as the child's parent
   **unless the child already has one**. So a name listed in two groups stays in the first (in
   the order of `groups`).
3. For every child that is **not** a group name (that is what makes it a column), walk up the
   `parents` chain from its parent, `unshift`ing each group into a `path`, so the path reads from
   the outermost group in.
4. A `seen` set of group names stops the walk at the first repeat, so a cycle (`a` contains `b`,
   `b` contains `a`) terminates; the cycle is cut at the repeat.

Facts and edge cases (from the tests):

- Group names in `children` do not appear as keys in the result.
- A cycle `a: ['b', 'x']`, `b: ['a']` gives `x -> [b, a]`: the walk starts at `a`, goes up to `b`, sees
  `a` again and stops.
- Columns that no group mentions have no entry. Consumers read `paths.get(name) ?? []`.
- A child name that is neither a group nor a real column still gets a path; the function does not
  know the column list. Unknown names are filtered later, because only rendered columns are looked up.
- Paths hold the `ColumnGroup` **objects**, and later code compares and keys by object identity
  (`bounds` map, `includes`, `Set`). They must come from the same `groups` array the paths were built
  from.

Returns a new `Map` on every call; the engine wraps it in a `computed` (`groupPaths`).

### `getGroupDepth(paths)`

```ts
function getGroupDepth(paths: ReadonlyMap<string, readonly ColumnGroup[]>): number
```

The length of the longest path, i.e. the number of group rows above the column header. `0` for no
groups (`resolveGroupPaths([])` gives depth `0`). Groups stick to the top of the table: a column
with a shorter path has empty (group-less) cells in the deeper rows, not in the top rows.

### `getGroupBounds(visible, paths)` (private)

For every group, the `index` of the first and last **shown** column (`RenderedColumn.index`) that
belongs to it. It scans `visible`, which is the column list **before the column window**, so a
group keeps its true extent even when the window renders only a piece of it. The scan assumes
`visible` is in display order: `first` is set on first sight, `last` is overwritten on each later
member. Used only to compute `continues`.

### `canJoin(cell, next)` (private)

Decides whether a column's draft cell merges into the previous cell of the row:

- the previous cell exists and is **not a spacer**;
- same `group` (object identity);
- same `pin`;
- and, **only for group-less cells**, same `parent`.

The last rule is the subtle one. Two group-less cells under *different* parent groups must not merge
into one big empty cell, or a hole would span groups. Real group cells do not need the parent
check, since a group has exactly one parent. The test "empty space under different groups does not
merge into one cell" pins this down.

### `resolveGroupRows(visible, rendered, paths, depth)`

```ts
function resolveGroupRows(
	visible: readonly RenderedColumn[],
	rendered: readonly RenderedColumn[],
	paths: ReadonlyMap<string, readonly ColumnGroup[]>,
	depth: number,
): GroupCellDraft[][]
```

The layout algorithm: for each level `0..depth-1` one row of `GroupCellDraft`s, from the top.

Why two column lists: `visible` is every shown column (to know where groups really start and end),
`rendered` is what the column window actually renders, including spacers. The rows are built from
`rendered`, so they line up with the header and body cells; `visible` only feeds the bounds.

Per level, step by step:

1. Walk `rendered`. For a **spacer** (`item.column` is `null`) push a spacer draft
   (`group: null`, `parent: null`, `columns: []`, `spacer: item`) and move on. A spacer is present in
   every row and never joins neighbours, so it also cuts any group around it.
2. For a column, take `path = paths.get(name) ?? []`, `group = path[level] ?? null`,
   `parent = level > 0 ? path[level - 1] ?? null : null`.
3. Build `next` with `columns: [item]` and `pin: item.pin`. If `canJoin(last, next)`, push the column
   into the previous cell, otherwise start a new cell.
4. After the row is built, compute `continues` for each real group cell from the bounds:
   `start = firstColumnIndex > bound.first`, `end = lastColumnIndex < bound.last`. Group-less cells
   and spacers keep the shared frozen `NOT_CONTINUED`.

Consequences:

- A group split by **pinning**, a **move** or the **column window** comes out as several cells, each
  with `continues` showing where the rest is. (Test: pinning `last` to the start cuts `price` into
  `price:last` and `price:change`, with `continues` `{start:false,end:true}` and `{start:true,end:false}`.)
- Neighbouring columns merge only if they are adjacent in `rendered`; the algorithm never
  reorders.
- With `depth === 0` the result is `[]`.
- `columns` arrays are fresh and mutated while the row is built (`push`), so a draft must not be
  retained across calls. `useColumnGroups` derives its own immutable data from them.

Cost: O(levels x rendered columns) per call, plus one pass over `visible` and a `Map` lookup per
column. No `find`/`includes` in the loop.

### `isCollapsibleGroup(group)`

```ts
function isCollapsibleGroup(group: ColumnGroupInput): boolean
```

`true` when `showWhen` exists and has at least one key. An empty `showWhen: {}` does not make a
group collapsible. It is the single definition of "can collapse"; every other place calls it.

### `resolveCollapsedColumns(paths, isCollapsed)`

```ts
function resolveCollapsedColumns(
	paths: ReadonlyMap<string, readonly ColumnGroup[]>,
	isCollapsed: (group: ColumnGroup) => boolean,
): Set<string>
```

The names of columns hidden by collapsed groups.

For each column and its path, the column is hidden if **any** group on the path hides it. At level
`level`, the group looks up the rule for the *child on the way down*: `path[level + 1]?.name` when
the column sits in a nested group, otherwise the column's own name. That is why a group can hide a
whole nested group with `showWhen: { detail: 'expanded' }`: every column under `detail` finds the
rule via `detail`.

The test for one group: `rule !== undefined && (rule === 'expanded') === isCollapsed(group)`:

| rule | group collapsed | hidden |
| --- | --- | --- |
| `'expanded'` | yes | yes |
| `'expanded'` | no | no |
| `'collapsed'` | yes | no |
| `'collapsed'` | no | yes |
| none | any | no |

Tests (`quote` with `showWhen: { total: 'collapsed', detail: 'expanded' }` over `detail` with
`showWhen: { ask: 'expanded' }`): everything expanded hides only `total`; collapsing `quote` hides
`bid` and `ask` (everything under `detail`); collapsing `detail` alone hides `total` and `ask`. Each
nested group collapses on its own.

The predicate is injected, so the function stays pure and knows nothing about where the collapsed
state is stored.

### `countRuns(names, paths, group)` (private)

Counts the **contiguous runs** of members of `group` in an ordered name list: a run starts when a
member follows a non-member.

### `keepsGroupsTogether(paths, before, after)`

```ts
function keepsGroupsTogether(
	paths: ReadonlyMap<string, readonly ColumnGroup[]>,
	before: readonly string[],
	after: readonly string[],
): boolean
```

Whether a move from the order `before` to `after` leaves every `keepTogether` group in **no more runs
than it had**.

1. Collect the `keepTogether` groups that appear on any path.
2. For each, compare `countRuns(after, ...)` with `countRuns(before, ...)`. If `after` has more, return
   `false`.
3. Otherwise `true`.

Why "not more than before" instead of "exactly one run": pinning (or a previous move) can already have
split the group. Requiring one run would freeze every column in a cut group. With the comparison,
moves inside the group, moves of the whole group and moves that keep it as cut as it was are
allowed. Tests: a swap inside the pair and moving the pair past another column pass; putting a foreign
column between the children, or pushing a child outside, fails; a group that is already cut may move
without having to join. A group without `keepTogether` never blocks.

Nested groups: `keepTogether` on an outer group counts all columns under it (paths include outer
groups), and also on an inner one.

---

## `define-column-groups.ts`

### `ColumnGroups<TInput>` and `defineColumnGroups(input)`

```ts
type ColumnGroups<TInput> = {
	readonly [TName in keyof TInput]: TInput[TName] & { name: TName & string };
};

function defineColumnGroups<TInput extends Record<string, ColumnGroupInput>>(
	input: TInput,
): ColumnGroups<TInput>
```

**Problem.** The user would otherwise write the group name twice (`{ market: { name: 'market', ... } }`),
and a typo between key and `name` would silently break nesting, which is matched by name.

**Solution.** The object key is the name. For each key it copies the input (`{ ...input[name], name }`)
and freezes the resulting object. A `name` written inside an entry is overridden by the key.

Typing: the mapped type `ColumnGroups<TInput>` keeps each entry's literal type (so `meta` and extension
fields keep their inferred types) and intersects it with `{ name: <key literal> }`. The runtime value is
built as `Record<string, ColumnGroup>` and cast once with `as unknown as ColumnGroups<TInput>`, an
untyped-boundary cast, because the mapped type cannot be built incrementally.

Details:

- The freeze is **shallow**: the outer record is frozen; the group objects inside and their `children`
  arrays are not. Groups are copied, so later changes to the input object do not reach the result.
- It returns a new object per call. Call it once at module or setup level, not inside a render.
- `children` is not validated: unknown names are columns, group names are groups.
- The engine accepts the result as `ColumnGroupsInput` (an object) or any array of `ColumnGroup`
  through `toGroupList`.

Exported from the root. Where used: the engine option `groups` documents it as the way to build the
value (`use-grid-engine.ts`); the function itself has no other caller in `src` (checked with Grep).

---

## `use-column-groups.ts`

### `useColumnGroups(options)`

```ts
function useColumnGroups(options: ColumnGroupsOptions): ComputedRef<readonly (readonly RenderedGroup[])[]>

interface ColumnGroupsOptions {
	paths: () => ReadonlyMap<string, readonly ColumnGroup[]>;
	isCollapsed: (group: ColumnGroup) => boolean;
	visible: () => readonly RenderedColumn[];
	rendered: () => readonly RenderedColumn[];
	getPinOffset: (name: string) => number;
	getGrow: (name: string) => number;
	cellStyles: GridCellStyles;
}
```

(`ColumnGroupsOptions` is not exported; the return type is inferred, and matches
`scope.headerGroups` in `engine/scope.ts`.)

**Problem.** Header group rows are derived from many things that change at different rates (collapse
state, pinning, the column window on each scroll step, resizing). A naive computed would build new
cell objects for every group cell on every change, and everything that caches by reference
(markup `patchProps`, memoized header cells) would re-render the whole group header while scrolling.

**Solution.** Each cell is cached by a signature; a cell whose columns and geometry did not change
comes back as the **same object**, and when no cell changed in any row, the whole result is the same
reference.

Inputs are getters, not refs (`paths`, `visible`, ...). Reading them inside the `computed` registers
the dependencies, and the caller can pass `() => someRef.value`. This is how the engine passes them.

#### Pieces

- `depth = computed(() => getGroupDepth(options.paths()))`. A separate computed so a change of paths
  that does not change the depth does not notify on its own.
- `isCollapsed(group)` (inner): `group !== null && isCollapsibleGroup(group) && options.isCollapsed(group)`.
  A non-collapsible group is never "collapsed", whatever the external predicate answers.
- `getSignature(draft, names, grow)`: the string
  `groupName | parentName | pin | continues.start | continues.end | collapsed | firstIndex | grow | geometry...`
  where `geometry` is `getGeometryKey(column, pin, pinOffset)` for each column (width, min/max,
  flex, align, resizable, pin, offset; from `render/geometry.ts`). Everything that appears in the
  produced cell is in the signature, so equal signature means an equal cell.
- `createCell(draft, level, names, grow)`: builds the `RenderedGroup`. Geometry goes through
  `getColumnRunGeometry(draft.columns, grow, options)` from `render/column-span.ts`: the `style` (from
  `cellStyles.group`, a **string**, in line with the "style is a string" rule) and the
  `data-dg-columns` tokens. A run pinned to the end sticks by its last column, so its pin offset is
  taken from that edge. `props` is `Object.freeze({ key, 'data-dg-group', 'data-dg-columns', 'data-dg-pinned', style })`.
  `key` is the first column's name; `index` the first column's `index`; `span` the number of columns.
- `createSpacer(draft, level, spacer)`: a cell with no group, `columns: []`, `index: -1`, `span: 0`,
  `spacer` set to the pin side, and **`props` taken from the spacer column's `headerProps`**, so a spacer
  cell looks exactly like the header spacer (same frozen object, same widths).

#### The frame and the cache

State is one object, `GroupsFrame { cache, rows }`, kept by `stableComputed` (see `shared.md`):

1. If `depth` is `0`, return the shared `EMPTY_FRAME` (`rows: []`); no allocation, and the result
   reference is the same constant every time.
2. `resolveGroupRows(visible, rendered, paths, depth)` makes the drafts.
3. A new `cache` map is created for this pass. For each draft:
   - **Spacer**: key `${level}:\u0000${spacer.key}` (the NUL separator prevents any clash with a
     column name). The previous cell is reused if its `props` is still the spacer's current
     `headerProps` (reference equality), otherwise `createSpacer`.
   - **Group cell**: key `${level}:${firstName}`, signature `names.join(' ') + '|' + getSignature(...)`.
     The previous cell is reused when the stored signature equals the new one, else `createCell`.
     `grow` is `getColumnRunGrow(names, options.getGrow)`, the sum of the columns' flex.
   - the cell goes into the new `cache` under its key.
4. If `isSameRows(previous.rows, rows)` (same row count, same cell count, and every cell `===`),
   return `previous`, which keeps the old arrays too. Otherwise return `{ cache, rows }`.

The final value is `computed(() => frame.value.rows)`. Because `stableComputed` returns the same
`frame`, `rows` keeps its identity, and Vue does not notify dependents.

Why keys are `level:firstName` and not the cell index: when a column is added or moved, cell
positions shift, but a cell that still starts at the same column keeps its identity. The same name at a
different level is a different cell, so the level is part of the key.

Why the cache is rebuilt per pass instead of mutated: cells that disappeared drop out
automatically, so the cache cannot grow without bound; only cells of the current frame live in it.

Edge cases:

- Spacer entries have `signature: ''` in the cache, because validity is judged by `props` identity
  rather than by a signature.
- A group split into several cells has several cells with the same group but different first
  columns, so each gets its own key.
- Collapse changes the shown columns, so `visible`/`rendered` change; the `collapsed` flag is also in
  the signature, which refreshes the toggling cell even when its own columns do not change.
- A moved column shifts `index` and may change `continues`; both are in the signature.

#### Where it is used

`engine/use-grid-engine.ts` creates it as `headerGroups`:

- `paths` is `groupPaths` (from `resolveGroupPaths(toGroupList(options.groups))`);
- `isCollapsed` reads `state.layout.value.collapsed[group.name]`, falling back to
  `group.collapsedByDefault`, then `false` (`isCollapsedIn`);
- `visible` is `columns.columns.value` (before the window), `rendered` is the windowed list with spacers;
- `getPinOffset` and `getGrow` come from `useGridColumns`, `cellStyles` from the engine options.

The result is exposed as `scope.headerGroups` (`engine/scope.ts`) and consumed by core's
`grid-header.ts` and `use-grid-props.ts` (`headerRows` counts `headerGroups.length`).
`tests/engine/use-grid-engine.spec.ts` checks that an untouched cell keeps its reference
(`headerGroups.value[0][1]` `toBe(before)`) and that no groups give `[]`.

---

## How the pieces connect in the engine

In `engine/use-grid-engine.ts` (checked with Grep):

```
options.groups
  -> toGroupList            groupList
  -> resolveGroupPaths      groupPaths
  -> isCollapsibleGroup     collapsible (any group)
```

- **Hidden columns.** `useGridColumns` receives `getCollapsedColumns: layout => collapsible ?
  resolveCollapsedColumns(groupPaths, group => isCollapsedIn(layout, group)) : NO_COLUMNS`. Inside
  `use-grid-columns.ts` the result is unioned with the user-hidden set. Hiding by a collapsed group
  therefore changes `visible` first, and the header rows follow.
- **Move veto.** `useGridColumns` receives `keepsGroups: (before, after) => keepsGroupsTogether(groupPaths, before, after)`.
  A move is accepted only when `keepsFixedColumns(...)` and `keepsGroups` both pass (the move returns
  `null` otherwise).
- **Toggling.** `isGroupCollapsed(name)` and `toggleGroup(name)` look the group up by name and
  act only if `isCollapsibleGroup(group)`. `toggleGroup` calls `columns.setGroupCollapsed(name, !current)`,
  which patches `layout.collapsed`. The collapsed state is part of the layout, not of this folder.
- **Header rows.** `useColumnGroups` as above.

The state of collapsing lives in the layout (so it can be persisted with the rest of it); this folder
only reads it through predicates.

## Invariants worth remembering

- Group identity is by **object**, groups are matched by **name**: the same array of groups must feed
  `resolveGroupPaths` and everything derived from it.
- Rows are built from `rendered` (with spacers), bounds from `visible` (without the window).
- A cell with `spacer` set has `group: null`, `columns: []`, `index: -1`, `span: 0`.
- `key` of a group cell is its first column's name and is unique in its row only because cells in a row
  cover disjoint columns.
- Reference stability: unchanged cells are the same objects; unchanged rows give the same outer array;
  `props` is frozen and shared while geometry holds; `EMPTY_FRAME` is shared for no groups.
