# `src/rows`

The row pipeline: everything that turns the rows the application hands over into the rows the grid
shows. Sorting, grouping with aggregates, trees, changes of rows by key, a stream of live changes,
row editing and row selection. Row identity (the key) is the one idea that runs through all of it.

The folder sits on the `columns` layer: it reads `RuntimeColumn.value`, `compare` and `aggregate`,
and takes the sort model from `columns/sort`. It imports `shared/stable-computed` and nothing above
itself.

```
rows/
  index.ts               public surface of the folder
  compare.ts             default value comparison and the notion of an "empty" value
  row-key.ts             RowKey and the key getter built from it
  aggregate.ts           aggregates over rows, plus a mergeable form for groups
  sort-rows.ts           pure sorting: full sort and incremental "delta" re-sort
  row-groups.ts          pure grouping by value, with a cache of group rows
  row-tree.ts            tree types (RowNode) and children / parent-key helpers
  row-changes.ts         pure changes of rows by key (add, update, remove, move) with their undo
  row-batch.ts           pure one-pass application of updates, removals and adds without a place
  row-list.ts            the rows a batch of changes works on: positions, siblings, splices
  row-stream.ts          pure queue of row changes for the stream
  use-sorted-rows.ts     composable over sort-rows
  use-grouped-rows.ts    composable over row-groups
  use-row-tree.ts        composable: flat or nested rows to shown rows and nodes
  use-row-stream.ts      composable: batched live changes
  use-row-editing.ts     composable: changes of rows as commits
  use-row-selection.ts   composable: selection by key, ranges, "select all", trees
```

The split follows the project rule: files without the `use-` prefix are pure functions that tests
run without Vue; the `use-*.ts` files only wire reactivity around them.

## Root API versus internals

| Where | Exports |
| --- | --- |
| root (`src/index.ts`) | functions `aggregateColumn`, `aggregateRows`, `applyRowChanges`, `compareValues`, `isEmptyValue`, `createRowKeyResolver`, `getRowChildren`, `groupRows`, `sortRows`, `useGroupedRows`, `useRowEditing`, `useRowSelection`, `useRowStream`, `useRowTree`, `useSortedRows`; types `AddRowChange`, `ChildrenField`, `GroupedRowsOptions`, `GroupColumns`, `GroupRowsOptions`, `MoveRowChange`, `ParentKey`, `RemoveRowChange`, `RowChange`, `RowChangeOptions`, `RowChangeResult`, `RowCommit`, `RowCommitRequest`, `RowEditing`, `RowEditingOptions`, `RowEditSource`, `RowGroup`, `RowGroupLevel`, `RowKey`, `RowNode`, `RowPlace`, `RowSelection`, `RowSelectionOptions`, `RowStreamOptions`, `RowTree`, `RowTreeOptions`, `RowWriteResult`, `SelectionMode`, `SortedRowsOptions`, `UpdateRowChange` |
| `internals.ts` | functions `buildRowGroups`, `getQueuedChanges`, `indexRows`, `queueRowChanges`, `resolveSortedRows`; types `AggregatePart`, `AggregateParts`, `GroupCacheEntry`, `QueuedRow`, `RowGroupCache`, `RowQueue`, `SortFrame`, `SortKey` |
| neither | `createParentKeyResolver`, `readAggregateParts`, `mergeAggregateParts`, `finishAggregates`, `applyKeyedChanges`, `isUnplaced` and the working list of `row-list.ts` (exported from their files for the folder's own use, not from `rows/index.ts`) |

The rule of thumb: the root has what an application calls; `internals` has the building blocks that
carry the incremental state (frames, caches, queues) and are meant for someone assembling a custom
pipeline.

---

## `compare.ts`

### `isEmptyValue(value)`

```ts
function isEmptyValue(value: unknown): boolean
```

`true` for `null`, `undefined` and `NaN`. These are "missing" values: sorting puts them last in
either direction and aggregates `min`/`max` skip them. Everything else, including `0`, `''` and
`false`, is a real value.

### `compareValues(a, b)`

```ts
function compareValues(a: unknown, b: unknown): number
```

The default comparison when a column has no `compare`. Steps, in order:

1. Both convertible to a number (`number`, or `Date` through `getTime()`) -> `a - b`.
2. Both `boolean` -> `false` before `true`.
3. Both `bigint` -> `Number(a > b) - Number(a < b)`. A subtraction would lose precision or throw on
   mixing, so it compares and turns the booleans into -1/0/1.
4. Anything else -> `String(a)` against `String(b)` with a module-level `Intl.Collator('en', { numeric: true })`.

Why shaped this way:

- `numeric: true` makes `A9` sort before `A10`.
- The locale is **fixed to `en`**, the root Unicode rules, so a server render and the browser sort
  alike. A different locale is a column's `compare`, not a global setting.
- The collator is created once at module load (a constant, not per call): constructing an
  `Intl.Collator` is expensive and this runs inside sort comparators.
- Mixed types fall through to strings rather than throwing (a number against a string compares as
  text).

`compareValues` does not look at emptiness: callers filter that first (`sort-rows.ts`,
`aggregate.ts`, and `cells/use-cell-changes.ts`).

Used in: `rows/sort-rows.ts`, `rows/aggregate.ts` and `cells/use-cell-changes.ts` (together with
`isEmptyValue`).

---

## `row-key.ts`

### `RowKey<TRow>`

```ts
type RowKey<TRow> = keyof TRow | ((row: TRow) => string)
```

How the application tells the engine what identifies a row: a field name or a function. The key must
stay the same while the row is the same row, through sorting, streaming and filtering, because focus,
selection and measured heights hold on to it.

### `createRowKeyResolver(rowKey)`

```ts
function createRowKeyResolver<TRow>(rowKey: RowKey<TRow>): (row: TRow) => string
```

A function `rowKey` is returned as it is (same reference). A field name becomes
`row => String(row[rowKey])`, so numeric ids are stringified here and every key in the engine is a
`string`. The check is `typeof rowKey === 'function'`, so a field that holds a function would never be
confused with a getter: only the option itself is tested.

Used in: `use-row-tree.ts`, `use-row-stream.ts`, `use-row-selection.ts`, `row-list.ts`, `row-batch.ts`, and
`engine/use-grid-engine.ts` (its `getKeyOf`).

---

## `aggregate.ts`

Aggregates are column-level summaries over a set of rows: `sum`, `avg`, `min`, `max`, `count`, or a
function `(values, rows) => unknown`. The file has two layers: a **plain pass** over rows
(`aggregateColumn`, `aggregateRows`) and a **mergeable form** (`AggregatePart`) that lets a group
combine the results of its subgroups instead of re-reading all leaves.

### Internal helpers

- `isNumber(value)` is `typeof value === 'number' && Number.isFinite(value)`: `NaN` and `Infinity`
  are not summed.
- `pickValue(current, value, sign)` keeps the better of two values for `min`/`max`. A value wins when it
  is not empty and (nothing is picked yet, or `sign * compareValues(value, current) > 0`). `sign` is `1`
  for `max` and `-1` for `min`. It uses `compareValues`, so `min`/`max` work on dates, strings and
  booleans, not just numbers.
- `AGGREGATES` is a table `name -> (values, rows) => result`. `sum` and `avg` filter finite numbers and
  return `null` when none are left; `min`/`max` reduce with `pickValue`; `count` is `rows.length`
  (empty values count, since it counts rows).

### `aggregateColumn(column, rows)`

```ts
function aggregateColumn(column: AnyColumn | RuntimeColumn, rows: readonly unknown[]): unknown
```

Reads `column.value(row)` for every row and applies the column's `aggregate`: a function is called as
`aggregate(values, rows)`, a name is looked up in the table. Returns `undefined` for a column without
`aggregate`, which is how callers tell "no aggregate" from "an aggregate that gave `null`".

Used in: `finishAggregates` (below) and `core/src/components/grid-footer.ts`, the footer cell.

### `aggregateRows(columns, rows)`

```ts
function aggregateRows(columns: readonly (AnyColumn | RuntimeColumn)[], rows: readonly unknown[]): Record<string, unknown>
```

An object by column `name` with the aggregate of every column that has one. Columns without
`aggregate` are left out of the object entirely. Each column re-reads the values on its own; this is
the simple flat version.

Exported from the root. Within `src` and `core/src` I found no caller of it; it is an application-facing
helper.

### `AggregatePart` / `AggregateParts`

```ts
interface AggregatePart { total: number; numbers: number; picked: unknown }
type AggregateParts = ReadonlyMap<string, AggregatePart>   // by column name
```

A built-in aggregate in a form that merges. One shape serves all four:

- `sum`/`avg`: `total` is the sum of finite numbers, `numbers` is how many there were. `avg` is
  `total / numbers` and needs the count, which is why an average of averages is never taken.
- `min`/`max`: `picked` is the value picked so far (`null` for none).

`count` and function aggregates are **not** mergeable (a function sees all values and rows), so they
get no part.

### `getMergeable` / `isPicked` / `getSign` (private)

`getMergeable(column)` returns the aggregate name if it is a string other than `count`, else `null`.
`isPicked` is `min` or `max`; `getSign` gives `1` for `max`, `-1` for `min`.

### `readAggregateParts(columns, rows)`

```ts
function readAggregateParts(columns, rows): AggregateParts
```

For each mergeable column makes a fresh part and walks the rows once: picks for `min`/`max`,
accumulates `total`/`numbers` for the finite numbers otherwise. This is the **only** place where leaf
values are read for a group's built-in aggregates. Used by `row-groups.ts` for bottom-level groups.

### `mergeAggregateParts(columns, children)`

```ts
function mergeAggregateParts(columns, children: readonly AggregateParts[]): AggregateParts
```

Builds a group's parts from its subgroups' parts without touching a row: totals and counts add up;
for `min`/`max` the child `picked` values go through `pickValue` again. Used by `row-groups.ts` for
every level above the bottom one.

Non-obvious: for a `sum`/`avg` column `part.picked` is set to `null` on each merge step (the ternary
yields `null` when the aggregate is not a pick), which is harmless because `picked` is only read for
`min`/`max`.

### `finishAggregates(columns, parts, rows)`

```ts
function finishAggregates(columns, parts, rows): Record<string, unknown>
```

Turns parts into the final values of the `aggregates` object that a `RowGroup` carries:

- no `aggregate` on the column -> skipped;
- not mergeable (`count`, a function) or no part -> falls back to `aggregateColumn(column, rows)` over
  the group's leaves;
- `min`/`max` -> `part.picked`;
- `sum`/`avg` -> `null` if `numbers === 0`, else `total` or `total / numbers`.

The JSDoc notes a numeric caveat: a `sum` merged from subgroups adds the subgroup sums, so in
floating point it can differ from a flat sum in the last digit.

Tests (`aggregate.spec.ts`) cover: built-ins skipping empty values, `min`/`max` on non-numbers,
`count`, `null` when no value is left, function aggregates getting `(values, rows)`, and the
`undefined` result without `aggregate`.

---

## `sort-rows.ts`

Pure sorting with an optional incremental mode. The state carried between passes is a `SortFrame`.

### `SortKey`

```ts
interface SortKey { column: RuntimeColumn; sign: 1 | -1 }
```

One resolved sort criterion: the runtime column and `1` for ascending, `-1` for descending.

### `SortFrame<TRow>`

```ts
interface SortFrame<TRow> {
	source: readonly TRow[];            // the input array that produced `rows`
	rows: readonly TRow[];              // sorted result
	keys: readonly SortKey[];           // criteria that produced it
	values: Map<TRow, readonly unknown[]> | null;  // sort values by row, kept for delta
}
```

The previous result, passed back to the next call. `source` lets the next pass see "same input array,
nothing to do"; `keys` lets it see "same criteria"; `values` is kept **only** when the delta mode is
on, because it costs a map entry per row.

### Private helpers

- `resolveKeys(sort, columns)` maps the `GridSort[]` model to `SortKey[]`. Columns are found by
  `name`, converted with `toRuntimeColumn`, and an **unknown column name is skipped** silently
  (the sort model may mention a column that is currently absent). Direction `'asc'` is `1`, anything
  else `-1`.
- `isSameKeys` compares keys by length, column reference and sign. The check compares columns by reference, so it relies on `toRuntimeColumn` handing back the same object for the same column. It does: `toRuntimeColumn` is only a type cast (`column as unknown as RuntimeColumn`), so the reference is the column's own.
- `readValues(keys, row)` reads one value per key.
- `compareRowValues(keys, first, second)` compares two rows through their pre-read value arrays,
  key by key:
  - if either value is empty: when only one is empty, the empty one goes **last** (returns `1` or `-1`
    **without** multiplying by sign, which is why empty values stay last in either direction);
    if both are empty, the key is a tie and the next key decides;
  - otherwise uses `column.compare` if present, else `compareValues`; a non-zero, non-`NaN`
    result is returned as `sign * result`. A zero or `NaN` result is a tie, so the next key decides.
  - all keys tied -> `0`.

### `sortAll(rows, keys, delta)`

Full sort. It reads all values **once** into `values[]` (so the comparator never calls
`column.value`), sorts an array of indexes, and uses `|| first - second` as the final tiebreaker so
equal rows keep input order independent of the engine's sort stability. The result frame holds a
`Map<row, values>` only if `delta` is set.

### `sortChanged(previous, rows, values)` (delta path)

Incremental re-sort, O(n + k log k) for k new rows. The idea: rows that are the same object as before
have not changed (this is the immutable-update contract), so keep their relative order and only
place the newcomers.

1. `added` are rows with no entry in `values` (arrived as new objects).
2. If the counts show something left (`kept.length + added.length !== rows.length`), build a `Set` of
   the current rows and filter `previous.rows`, deleting the gone rows from `values`.
3. If there is nothing added: returns `{ ...previous, source: rows }` when nothing was removed (the
   same `rows` array reference is reused), else a new frame with the filtered `kept`.
4. Otherwise reads values for the added rows into the map, sorts them (`added.sort` with
   `compareRowValues`), then merges with `kept` using a standard two-pointer merge. On a tie the kept
   (older) row goes first, because the added one is taken only when it compares `< 0`.

The previous frame's `values` map is **taken over and mutated** (comment in the code). That frame
must not be used afterwards. This is safe in the flow below because `stableComputed` only keeps the
latest frame.

### `resolveSortedRows(previous, rows, sort, columns, delta)`

```ts
function resolveSortedRows<TRow>(
	previous: SortFrame<TRow> | null,
	rows: readonly TRow[],
	sort: readonly GridSort[],
	columns: readonly AnyColumn[],
	delta: boolean,
): SortFrame<TRow>
```

The decision function. In order:

1. Resolve keys. `sameKeys` = `previous` exists with equal keys.
2. **No keys** -> the frame carries `rows` as its `rows` (the input array itself, not a copy). If
   `sameKeys` and the same `source`, `previous` is returned: full reference stability.
3. `sameKeys` and `previous.source === rows` -> `previous`.
4. `delta && sameKeys && previous.values` -> `sortChanged`.
5. Otherwise `sortAll`.

Edge cases from this order: changing direction or the set of sort columns changes `keys`, so the
delta path is skipped and the sort is from scratch (the test "a direction change sorts from scratch").
Without `delta` a row mutated in place is still re-sorted, because a full sort re-reads everything
(`delta` is what trades correctness under in-place mutation for speed).

Exported from `internals`. Used in `use-sorted-rows.ts` and `use-row-tree.ts` (one frame per parent).

### `sortRows(rows, sort, columns)`

```ts
function sortRows<TRow>(rows, sort: readonly GridSort[], columns: ColumnsInput | readonly AnyColumn[]): readonly TRow[]
```

A one-shot, non-reactive sort: `resolveSortedRows(null, ...)` with `delta = false`, returning just the
rows. `columns` may be an object from `defineColumns` or an array (`toColumnList`). The input is never
modified (test "the input is not modified"). Root API. In `src` and `core/src` I found no caller of
it; it is for use outside a grid, such as on a server.

---

## `row-groups.ts`

Pure grouping of leaves by values into a tree of group rows, with a cache so unchanged groups return
the same row object.

### Types

- `RowGroupLevel<TRow>`: `{ name, value(row) }`. A column from `defineColumns` fits, so
  `by: [columns.status]` works.
- `GroupColumns = ColumnsInput | readonly AnyColumn[]`: the columns whose `aggregate` is computed.
- `RowGroup<TRow, TAggregates>`: what `createGroup` receives: `key` (path from the root), `level`,
  `name` (the level's name), `value`, `rows` (every leaf under the group, all levels), `children`
  (the ready child rows: group rows of the subgroups or leaves) and `aggregates`. `TAggregates` is
  `ColumnAggregates<TColumns>` for typed columns.
- `GroupRowsOptions`: `by`, optional `columns`, and `createGroup(group) => TRow`. The group row has the
  **same type as a leaf**: the application puts `group.key` into its key field, `group.children` into
  the children field (so `useRowTree` flattens it) and the aggregates into the value fields, so columns
  read a group row with the same `value` as a leaf.
- `GroupCacheEntry<TRow>`: `{ value, children, row, parts }`, one per group key.
- `RowGroupCache<TRow> = ReadonlyMap<string, GroupCacheEntry<TRow>>`.

### Private helpers

- `toGroupValue(value)` turns a `Date` into `getTime()`, other values unchanged. It is the **identity**
  of a bucket: two different `Date` objects with the same time form one group (test "dates with the same
  time form one group").
- `isSameList(current, next)` is an element-wise `===` comparison of two lists. The same helper is
  declared again in `use-grouped-rows.ts` and `use-row-tree.ts` (the project rule of three has not yet
  been applied to it).

### `buildRowGroups(rows, options, previous?)`

```ts
function buildRowGroups<TRow, TColumns extends GroupColumns = GroupColumns>(
	rows: readonly TRow[],
	options: GroupRowsOptions<TRow, TColumns>,
	previous: RowGroupCache<TRow> = new Map(),
): { rows: TRow[]; cache: Map<string, GroupCacheEntry<TRow>> }
```

Returns the top-level rows and a **new cache** to pass as `previous` next time. The recursion
`build(leaves, level, parent)` works like this:

1. **Past the last level** (`options.by[level]` is missing): returns the leaves as `[...leaves]` with
   `parts: null`. The null tells the caller "these are leaves, read them".
2. **Bucket** the leaves by `toGroupValue(by.value(row))` in a `Map`. Buckets are created in the order
   values first appear, and leaves keep input order inside a bucket.
3. **Key** each group: `base = parent + '/' + 'group:' + name + '=' + String(value)`, joined with `/`
   to the parent key. Because `String` can collapse different values (`1` and `'1'`), a `used` counter
   adds `~1`, `~2` ... to repeated bases ("different values with the same string get different
   keys"). The key is therefore a **path**, unique in the tree, and cannot equal a leaf key as long as
   leaf keys do not start with `group:`; the JSDoc states "never equal to a leaf key".
4. **Recurse** to build the children first (`build(bucket.rows, level + 1, key)`).
5. **Reuse check** with the cached entry under that key: the cached `value` is the same
   (`Object.is` on `toGroupValue`) **and** the new `children.rows` are an element-wise `===` match of
   `known.children`. Children are rows of subgroups or leaves, so if any leaf object changed, either
   a leaf differs or some subgroup row was rebuilt, and the equality fails all the way up: "a group
   above a changed one is a new one".
6. If reusable: the entry is copied with the new `value` (`{ ...known, value: bucket.value }`), so the
   `row`, `children` and `parts` stay as they were.
7. Otherwise: `parts` are `mergeAggregateParts(columns, children.parts)` when there are subgroups,
   or `readAggregateParts(columns, bucket.rows)` for the bottom level; then
   `createGroup({ key, level, name, value, rows: bucket.rows, children: children.rows, aggregates: finishAggregates(columns, parts, bucket.rows) })`.
8. Every entry, reused or new, goes into the new `cache`. A group that disappeared is therefore
   dropped from the cache: no growth.

Consequences worth knowing:

- Built-in aggregates of a parent are merged from subgroups, so a change under one bottom group
  re-reads only the leaves of that group; the groups above merge parts. This is the point of
  `AggregatePart` (test "a changed leaf is read again only in its own bottom group").
- A top-level `avg` is the average of all leaves (via `total`/`numbers`), not an average of averages.
- `count` and function aggregates are recomputed from `bucket.rows` in `finishAggregates` for each
  rebuilt group.
- Without any `by` level, the `rows` returned are a copy of the leaves, but `useGroupedRows` skips the
  call in that case to keep the input array.
- `previous` is only valid with the same `createGroup`, `by` and `columns`; the composable checks
  that (below).

### `groupRows(rows, options)`

`buildRowGroups(rows, options).rows`: the one-shot, cache-less form. Root API. In `src` and
`core/src` I found no caller of it besides the folder's own tests; `useGroupedRows` calls
`buildRowGroups`.

---

## `row-tree.ts`

Types and tiny helpers for trees. The tree building is in `use-row-tree.ts`.

### `ChildrenField<TRow>`

A mapped type: the keys of `TRow` whose value is `readonly TRow[] | undefined`, so the editor only
offers fields that hold an array of rows of the same type.

### `ParentKey<TRow>`

`keyof TRow | ((row) => string | null | undefined)`. `null`, `undefined`, `''` and a key that no row has
put the row at the top level.

### `RowNode`

The place of a row in the tree:

| Field | Meaning |
| --- | --- |
| `key` | row key |
| `level` | depth, `0` at the top |
| `parent` | key of the holding group, `null` at the top |
| `group` | has a children array (even empty), or other rows name it as a parent |
| `expanded` | whether the group is expanded |
| `count` | leaves under the group on all levels; `0` for a leaf |
| `position` | index among siblings under the same parent, from `0` |
| `setSize` | number of siblings under the same parent, itself included |

`position` and `setSize` exist so `@vue-data-grid/core` can write `aria-posinset` and `aria-setsize`
without scanning (the engine only hands out numbers).

### `getRowChildren(row, field)`

Returns `row[field]` when `field` is defined and the value is an array (`Array.isArray`), else
`undefined`. **An empty array is an array**: the row is a group with no children (test). A non-array
value does not count. Root API.

### `createParentKeyResolver(parentKey)`

Same pattern as `createRowKeyResolver`: reads the field or calls the function, and maps `null`,
`undefined` and `''` to `null`, everything else to `String(value)`. Not exported from the folder's
`index.ts`; used by `use-row-tree.ts` and `row-changes.ts`.

---

## `row-changes.ts`

One model of changes of rows by key, for the stream, drops of dragged rows, buttons that add and
remove rows, and undo.

### Types

- `RowPlace`: `{ before?, after?, parent?, index? }`, one interface. `before` wins over `after`, and a
  neighbour over `parent` and `index`; a neighbour that is `null` is not given, so
  `{ after: focusedKey }` needs no ternary when nothing is focused (`getNeighbour` in `row-batch.ts`).
- `AddRowChange`, `UpdateRowChange`, `RemoveRowChange`, `MoveRowChange`, and their union `RowChange`.
  `expected` is `NoInfer<TRow>`, so the row type is inferred from `row` alone. An add of a known key
  is skipped unless `existing: 'replace'`; a removal may carry `subtree`, the keys that must be under
  the row for it to apply (the undo of an add sets it).
- `RowChangeOptions`: `rowKey`, `parentKey`, `setParent`, `childrenField`. `parentKey` wins over
  `childrenField`, as in the tree.
- `RowChangeResult`: `rows` (the same array when nothing changed), `applied`, `skipped`, `undo`.

### State: `row-list.ts`

`applyRowChanges` works on a `RowList`: every row of the tree in three parallel arrays in data
order, the row, its key, and the parent it names (`parentKey`), sits under (nested) or `null`
(flat). A nested tree is flattened into them first (`pushRow`); where a child stands in the arrays
does not matter, only the order of siblings among each other. The file is not exported from the
folder's `index.ts`.

What keeps a positioned batch from costing more than it must:

- **Named keys.** The batch first collects the keys its changes name (rows, keys, neighbours,
  parents), and the position index (`Map` key -> position) holds only those, built lazily. A key
  outside them, such as an ancestor during a move, switches the index to every key once.
- **Removal in place.** A removed row is marked in `removed` and leaves the index, so other positions
  stay valid; the arrays are compacted in one pass before the next splice (an add at a place, a
  move) and at the end. The undo index of a removed row of a flat list is its position minus the
  removed rows before it, without a scan.
- **Untouched lists.** `changed` is set by every write; without one the input comes back at once.

- **Child index.** `children` maps each parent to the positions of its children in order, built
  lazily (`getChildIndex`) and dropped by a splice, a compaction or a parent that changes; removed
  rows stay in it and are skipped on read, so removals in a row do not rebuild it, and an append
  extends it (except in a tree by `parentKey`, where the appended row may be the parent of rows that
  named it before). Siblings, the index among siblings, descendants and the subtree a nested row
  carries back are read from it: O(siblings) or O(subtree), not O(n).

The first row with a repeated key wins, as in the tree; a repeated key that a change names warns
once in development (`warnDuplicateKey`, also from the batch pass).

### The batch of a stream: `row-batch.ts`

A batch that holds only updates, removals and adds without a place, in a flat list or a tree by
`parentKey`, never goes through the working list: `applyKeyedChanges` gives the same `rows`,
`applied` and `skipped` in one pass, and `applyRowChanges` returns them with `undo` as a getter that
runs the working list on the first read (a stream never reads it; a commit of `useRowEditing` does,
for a few changes). A nested tree and any batch with a move or an add at a place take the working
list.

- **By key** (a flat list, or a tree by `parentKey` without removals): changes of different keys do
  not touch each other, so the indexes of the changes are grouped by key, each key folds its own
  changes in order (`step`) when the walk over the rows reaches its row, and keys the rows do not
  have fold after it. One `getKey` and one `Map` lookup per row, as the old queue. A removed key that
  is added again goes last, in the order of the adds, as in order.
- **With subtrees** (a tree by `parentKey` with removals): the changes go in order over the states
  of their keys; the first removal builds one index of the rows by parent (positions of the rows of
  the list, keys of added rows), which later changes of a parent extend. An entry counts only while
  its row still names that parent, and a removed row is taken before its children are visited, so
  cycles end.

`row-batch.spec.ts` checks the pass against the working list over random batches (a skipped move to
a missing key forces the working list on the same changes).

Measured in a temporary Vitest spec over 10 000 and 100 000 rows (100 runs after 20 warm-up runs,
Node 24 on the author's machine), against the queue of the previous version (`applyRowQueue`), in
ms:

| Batch | 10 000 rows | 100 000 rows | before, 10 000 | before, 100 000 |
| --- | --- | --- | --- | --- |
| 200 updates, flat | 0.6 | 5.6 | 0.5 | 5.9 |
| 200 updates, `parentKey` | 0.6 | 6.2 | 0.5 | 5.9 |
| 20 removals, flat | 0.5 | 5.8 | 0.4 | 5.9 |
| 20 removals with subtrees, `parentKey` | 2.1 | 26 | — | — |

After the review of 2026-10-18 (`output/reviews/2026-10-18-row-changes.md`), the same kind of spec
(median of 15 runs after 5 warm-up runs), before and after the child index, the stream's base and
the lazy undo of a commit, in ms:

| Case | before | after |
| --- | --- | --- |
| stream, 10 000 flat rows: 50 × (move + `patch`) and a flush | 581 | 69 |
| stream, 100 000 rows by `parentKey`: 50 `patch` and a flush | 25.4 | 3.9 |
| nested tree of 10 000 rows: 100 removals | 62 | 3.4 |
| `useRowEditing`, 10 000 rows by `parentKey`: 1000 removals, rows and undo | 185 | 4.0 |
| 100 000 flat rows: 1000 updates | 5.8 | 5.2 |

Runs differ by about 10 %: the flat batches are as fast as the old queue. The old queue had no
subtrees, so a removal from a tree has nothing to compare with; its cost is the index of children,
one pass and one push per row with a parent. Before `row-batch.ts` the same batches went through the
working list: 200 updates 0.8 and 9.2 ms, 20 removals 1.2 and 17 ms.

Three kinds of trees, from the options: `flat` (every row a sibling of every other, `parent` of a
place ignored), `parents` (a field names the parent; **raw** values are compared, so a parent no row
has is a bucket, as the task board example splits one array into lists by a field), `nested`
(structure; a parent must be a row). In `parents` a row that names a parent no row has, or itself,
is **also** a child of the top level, where the tree shows it (`isUnder`): a drop at the top level
counts it among its siblings, and `withParent` leaves its field as it is when it goes to the top
level.

### Placement

`listPosition` turns `{ parent, index }` into a position in the arrays, with the moved row excluded:
before the `index`-th sibling; past the end, right after the last sibling **and its subtree**; with
no siblings, right after the parent, or at the end for an unknown parent or the top level. Rows that
are in tree order stay in tree order. `before` / `after` resolve to the neighbour's parent and its index among its
siblings (+1 for `after`), counted with the moved row taken out.

### Changes

- **add**: a known key is skipped, or with `existing: 'replace'` replaces its row in place; a new key
  is inserted at the place. Without any place it is appended, which is last among its parent's children
  in every kind of tree, without a scan. With `parentKey`, a row placed under another parent gets it
  written in (`withParent`: `setParent`, else `{ ...row, [parentKey]: parent }`; a function
  `parentKey` without `setParent` throws when a write is needed).
- **update**: the key must be there and hold `expected`; the row replaces the old one in place.
- **remove**: the key must be there, hold `expected` and, with `subtree`, have exactly those keys
  under it; the row is removed with its subtree.
- **move**: an unknown key is skipped (a row from another grid is an add); the key must hold
  `expected`, and `from` must be a parent the row is under; a target parent inside the row's own
  subtree (walk up from the target, bounded by the row count against cycles) is skipped. `row`
  replaces the row the key holds.

`isSameRow` compares `expected` by reference, and in a nested tree apart from the children field
(shallowly by own keys): the final rebuild gives rows whose children changed new objects, and an
undo step must still recognise them.

### Undo

Each applied change gives its inverse group; groups are reversed, each kept in its own order:

- add (new key) -> `remove` with `expected` of the stored row and `subtree`: the children it brought
  in a nested tree, none by `parentKey`, so it never takes rows that came under it since (rows it
  adopted by their parent field in the same commit make it skip too, and stay);
- update, or an add with `existing: 'replace'` -> `update` back with `expected`; by `parentKey` a row
  that names another parent moved, so its undo is a `move` back to its index among its old siblings,
  with `row`, `expected` and `from`;
- remove -> `add` at `{ parent, index }`; with `parentKey` the subtree comes
  back row by row, parents first, each at its index among its siblings; a nested row comes back as
  one row with its subtree built at the time;
- move -> `move` back with `expected` and `from` set to the new row and parent, and `row` with the old
  object when the move wrote a new parent;
- a nested parent that was a leaf before a row went into it also gets an `update` back to the leaf
  object, or it would stay a group with an empty children array.

### Finishing

Flat and `parents`: the rows array, or the input itself when every element is the same. Nested:
`buildRow` rebuilds bottom-up from the parents; a row whose built children equal its children array
element by element (or that has none and gets none) is kept as is, every other one becomes
`{ ...row, [field]: children }`.

Cost on the working list: after the O(n) set-up, an update, an add without a place and a removal
from a flat list are O(1); a removal from a tree is O(subtree + siblings) on the child index; an add
at a place and a move are O(n) each (splices, the indexes rebuilt after a splice).

---

## `row-stream.ts`

The pure queue of `useRowStream`.

- `QueuedRow<TRow>`: `{ present, absent, removes }`, all pending changes of one key in a run folded
  into what they make of a key that has a row when they apply (`undefined` keeps it, `null` removes
  it) and of one that has none, since an update and a removal reach only a row that is there and an
  add only a key that is free. `removes` says a removal is among them, which in a tree takes the
  subtree even when an add brings the key back.
- `RowQueue<TRow>`: an ordered array of runs (`Map` key -> `QueuedRow`) and single changes.
- `queueRowChanges(queue, changes, getRowKey)`: an update, a removal or an add without a place and
  without a guard folds into the last run, if the last item is a run, else into a new one
  (`foldChange`). Every other change (a move, an add at a place, a guarded change) is pushed as it
  is, and the changes after it start a new run, so order is kept around it.
- `getQueuedChanges(queue)`: the queue as `RowChange[]` in order, in the order keys were first
  queued: per key a `remove`, an `update`, an `add`, an `add` with `existing: 'replace'` when both
  cases end with the same row, or an `update` then an `add` when they differ; a removal followed by
  an add keeps the `remove` first.
- `indexRows(rows, getRowKey, childrenField?)`: every row by key with the key of the row it is under
  in a nested tree (`IndexedRow`), nested children included.

---

## `use-sorted-rows.ts`

### `useSortedRows(options)`

```ts
function useSortedRows<TRow>(options: SortedRowsOptions<TRow>): ComputedRef<readonly TRow[]>
```

Options: `rows`, `sort`, `columns` (all `MaybeRefOrGetter`) and optional `delta`. It is a thin wrapper:

```ts
const frame = stableComputed<SortFrame<TRow>, null>(null, previous => resolveSortedRows(previous, ...));
return computed(() => frame.value.rows);
```

`stableComputed` supplies the previous `SortFrame`, and `resolveSortedRows` returns that same frame when
nothing changed; the final `computed` exposes only `rows`. **Reference stability:** same rows array +
same keys -> same frame -> same output array; with `delta`, a new array of the same objects keeps the
order as the same array (test); no sort keys -> the input array itself.

`delta` contract (from the JSDoc): correct only with immutable updates, where a changed row is a new
object and an unchanged row the same one. A row mutated in place is not noticed.

Used in: `core/src/data-grid/features.ts` (`useGridSorting`).

---

## `use-grouped-rows.ts`

### `useGroupedRows(options)`

```ts
function useGroupedRows<TRow, TColumns extends GroupColumns = GroupColumns>(
	options: GroupedRowsOptions<TRow, TColumns>,
): ComputedRef<readonly TRow[]>
```

Options: `rows`, `by`, optional `columns` (reactive) and `createGroup` (a plain function, not reactive).

The `stableComputed` state is a `GroupedFrame` with the rows, the cache, and the `by`, `columns` and
`createGroup` that produced them. Per run:

1. `by` is empty -> returns `{ rows, cache: new Map(), ... }` so the input array passes through.
2. `reuse` is true when the previous frame exists, has the **same `createGroup`**, an element-wise
   equal `by` and an element-wise equal `columns` list. Only then is the previous cache offered to
   `buildRowGroups`; otherwise group rows are rebuilt (a cache built with other levels, columns or a
   builder would give wrong rows).
3. After building: if `reuse` and the new top-level array equals the previous one element by element,
   the **previous array** is returned, so downstream computeds do not fire.

That is why the JSDoc says: keep `createGroup` the same function; an inline arrow created each render
disables the cache. The `createGroup` is cast to a non-generic signature because after
`toColumnList` the columns are a plain list (comment in the code).

Used in: `core/src/data-grid/features.ts` (`useGridGrouping`), paired with `useGridTree` and a
`childrenField`.

---

## `use-row-tree.ts`

The most involved file. It takes rows (nested by a children field, or flat with a parent key) and
produces: the **shown rows** (expanded tree flattened in traversal order), the **node** for each,
and lookups.

### `RowTreeOptions<TRow>`

| Option | Role |
| --- | --- |
| `rows`, `rowKey` | data and identity |
| `childrenField` | reactive; field with the array of children |
| `parentKey` | flat form; takes precedence over `childrenField`; **read once** (not reactive) |
| `expanded` | `Ref<string[] \| undefined>` for `v-model`; `undefined` means "initial state from `defaultExpanded`" |
| `defaultExpanded` | how many levels start expanded; negative expands all; default `0` |
| `sort`, `columns`, `delta` | sort siblings on every level, as in `useSortedRows` |

### Types (internal)

- `TreeEntry`: `{ row, node, children: string[] }`, one per key.
- `TreeIndex`: `{ entries, root: string[], frames }`. `frames` holds one `SortFrame` per parent for the
  incremental sort (key `'\u0000root'` for the top level, a character a real key will not start with).
- `ShownFrame`: `{ rows, nodes, expanded }`; `expanded` is the map of nodes of expanded groups.

### Helpers

`isSameNode` compares all eight `RowNode` fields; `reuseNode(previous, next)` returns the previous
node when it is equal; `isSameList` is element-wise `===`.

### The `index` computed (structure)

`index` is a `stableComputed` over rows, field, sort, columns and delta. It builds
`entries`, `root` and `frames`. Pieces:

- `groupByParent(rows, parentOf)` (flat form only): reads all keys, then for each row resolves its
  parent; the parent is used only if it is not null, is not the row itself and **exists among the rows**
  (`known.has`). Otherwise the row goes to the top level (`null`). Buckets keep input order. This is
  how "a row whose parent is missing goes to the top level" and self-parenting are handled.
- `order(siblings, parent)`: without a sort the siblings as they are; with a sort it calls
  `resolveSortedRows` with the previous frame **for that parent** (`previous?.frames.get(id)`), stores
  the new frame, returns `frame.rows`. When `delta` is on and the sibling array of a parent is the same
  or has only a few new objects, only that level is re-placed ("siblings whose array did not change are
  not sorted again").
- `getChildren(row, key)`: flat form `byParent.get(key)`, nested form `getRowChildren(row, field)`.
  `undefined` means a leaf; any array, even empty, means a group.
- `visit(siblings, parent, level, keys)`: depth-first; for each ordered row: **skip if the key is
  already in `entries`** (a duplicate key or a cycle of parents), build an entry with a mutable node,
  push its key to `keys`, recurse, store `node.count`. The returned count adds `node.count` for a group
  or `1` for a leaf, so `count` is the number of **leaves** below a group, on all levels; a group with no
  leaves has `0` and counts as `0`.
- Start: `visit(top-level rows, null, 0, root)` (flat form uses `byParent.get(null)`).
- **Cycle rescue:** in the flat form, rows whose parents form a cycle are not reachable from the top.
  After the main pass, if `entries.size < rows.length`, every row not yet visited is visited as a top
  level row, appended to `root` ("shown instead of disappearing").
- `place(keys)`: second pass over each sibling list once its final order is known: sets `position` and
  `setSize` on the node and then `reuseNode` swaps in the previous node when all fields are equal. The
  nodes are mutable during construction (fresh, not shared yet) and become effectively frozen by
  convention after `place`.

Because `index` is a `stableComputed`, its resolver's `previous` argument gives both the previous node
objects and the previous sort frames.

### `expandedKeys` (computed)

If `expanded.value` is defined, a `Set` of it. Otherwise it derives the initial state from
`defaultExpanded`: all groups whose `level < levels` (or all, when negative). Therefore `undefined`
means "not touched by the user": the default keeps applying (and follows new groups) until something
writes a list.

### `shown` (stableComputed)

Walks `index.root`, pushing `entry.row` and a node per visited row, descending into a group only if it
is expanded:

- for a collapsed row the node is the index node (`expanded: false`);
- for an expanded group a new node `{ ...node, expanded: true }` is created and passed through
  `reuseNode` against the previous frame's `expanded` map, so an unchanged expanded node keeps its
  reference. "Expanding a group keeps the nodes of every other row" follows from this.
- If the new `rows` and `nodes` lists equal the previous ones element-wise, the **whole previous frame**
  is returned.

`rows` and `nodes` are `computed` views of `shown.value`; they change reference only when the frame
does.

### `leaves` (stableComputed)

All non-group rows in entry (traversal) order, expanded or not; the previous array when equal. Meant for
totals.

### Return value

| Member | Behaviour |
| --- | --- |
| `enabled` | `true` with a `parentKey`, or when `childrenField` is set; without both the rows are flat |
| `parentKey`, `childrenField` | the options as given (`childrenField` as a `computed`), for changes of the rows that follow the tree, such as the `rowEditing` feature of `core` |
| `rows`, `nodes` | the shown rows and their nodes at the same index |
| `leaves` | all leaves |
| `hasGroups` | `leaves.length < entries.size`, i.e. some row has children |
| `getNode(key)` | the index node of any row, shown or not; its `expanded` is always `false` (read the real state through `isExpanded`) |
| `getChildren(parent)` | child keys of a group; `null` gives the top level; `[]` (a shared `EMPTY`) for an unknown key |
| `isExpanded(key)` | `expandedKeys.value.has(key)` |
| `setExpanded(key, value)` | no-op if already so; otherwise writes a new array (`[...set]`) to `expanded` |
| `toggle(key)` | flips it |
| `reveal(key)` | expands all ancestors in **one** write, `false` if the key is not in the tree |

Why `reveal` writes once: with `v-model:expanded` a write returns through the parent on the next tick,
so a write per ancestor would each start from the stale value and overwrite the previous one (comment in
the code). It also writes only if the set grew.

Edge cases: a flat list with a children field set but no row having children is a tree with no groups
(`hasGroups` is `false`); a function `rowKey` works; the sort uses column `value`/`compare` like
`useSortedRows`.

### `RowTree<TRow>`

`ReturnType<typeof useRowTree<TRow>>`, with `TRow = unknown` by default: the type to put in props and
contexts.

Used in: `core/src/data-grid/features.ts` (`useGridTree`, which passes the grid's sort state, or `[]`
when `sort` is turned off). `RowTree.getChildren` is passed to `useRowSelection` there. `core` also types
parts of the navigation and props against the tree's shape (`use-cell-navigation.ts`, `use-grid-props.ts`).

---

## `use-row-stream.ts`

### `useRowStream(options)`

```ts
function useRowStream<TRow>(options: RowStreamOptions<TRow>): {
	rows: ComputedRef<readonly TRow[]>;
	apply(changes: readonly RowChange<TRow>[]): void;
	patch(key: string, fields: Partial<TRow>): boolean;
	flush(): void;
	reset(next: readonly TRow[]): void;
	getRow(key: string): TRow | undefined;
}
```

**Problem.** A feed (a websocket, a ticker) can deliver hundreds of row changes per second. Applying
each one would copy the array and re-render the grid each time. The stream **collects** changes in a
queue and applies them in a batch, once per animation frame by default, through `applyRowChanges`.
`RowStreamOptions` extends `RowChangeOptions`, so a stream changes a tree by `parentKey` or
`childrenField` too.

State: `rows` (`shallowRef`), `queue` (`RowQueue`), `base` with `baseCount` (the rows after the
first `baseCount` items of the queue, which no later change alters), `index` (a lazily built index
of `base`) and `cancel`. `rowKey`, `parentKey`, `setParent` and `childrenField` are read once.

- **`apply(changes)`**: `queueRowChanges`, then `schedule()`.
- **`settle()`**: applies the items of the queue before its last run that are not in `base` yet, each
  once, and syncs the index: a move costs one pass when it is settled, not one per `getRow`.
- **`schedule()`**: if a flush is already scheduled, does nothing. Otherwise, `wait` (via `toValue`)
  `undefined` and `requestAnimationFrame` available -> a frame; else `setTimeout(flush, wait ?? 0)`.
  The check `typeof requestAnimationFrame === 'function'` keeps it safe in SSR. A hidden tab has no
  frames, so changes keep collecting, one per key in a run, until it is visible again.
- **`flush()`**: cancels a pending frame or timer, takes the queue (so a batch that throws is not
  tried again every frame), applies what `base` does not have yet to it, syncs the index, and assigns
  `rows.value` **only if the array reference changed**.
- **`syncIndex(applied)`**: keeps `index` in step with the applied changes (a removal deletes, a row
  sets) in a flat list, and by `parentKey` while the batch neither removes nor moves; otherwise drops
  it, since a removal takes a subtree, a move may write a copy, and a nested change copies the rows
  above it.
- **`getRow(key)`**: the row **including pending changes**: `settle()`, the row of the key in `base`,
  then the last run (`present` for a key with a row, `absent` without). In a tree, a row under one
  the last run removes is `undefined` (a walk up the parents, bounded against cycles). So a patch
  after a pending move sees the parent the move writes.
- **`patch(key, fields)`**: `getRow`, and if there is a row queues the update `{ ...base, ...fields }`;
  `false` otherwise and **no frame is requested**. For plain-object rows.
- **`reset(next)`**: cancels the flush, clears the queue, `base` and the index, sets the rows. Used when a
  new snapshot arrives through the `rows` option (`watch`).
- **Dispose**: `onScopeDispose(() => cancel?.())`.

**Stability.** `rows` is a `computed` over the ref; the array changes only when a batch really changed
something, and rows no change touched stay the same objects. `useSortedRows` with `delta` depends on
this.

Used in: no caller in `packages/engine/src` or `packages/core/src`; it is a root export for
applications, covered by `use-row-stream.spec.ts` and `row-stream.spec.ts`.

---

## `use-row-editing.ts`

### `useRowEditing(options)`

```ts
function useRowEditing<TRow>(options: RowEditingOptions<TRow>): {
	lastCommit: Readonly<ShallowRef<RowCommit<TRow> | null>>;
	write(changes: readonly RowChange<TRow>[], source: RowEditSource): RowWriteResult<TRow>;
}
```

The twin of `useCellEditing` for rows. `options.rows` is read with `toValue` at every write, and
`childrenField` may be a ref or a getter (the tree's `childrenField` is a `computed`).

`write` applies the changes to the rows; with applied changes it asks `onBeforeCommit`, which may
return other changes (applied again to the same rows, their skips added) or `false`. When the rows
did not change there is no commit. Otherwise the commit is `{ source, changes, undo, rows, apply }`,
`onCommit` gets it and `lastCommit` holds it. `undo` is a getter over the result: a batch that took
the one-pass path works its undo out only when something reads it. `write(changes, source, { link })` puts
`link` on the commit (`null` without it): the commit it goes with, such as the add of a dropped row
to the grid it went to for the removal from the grid it left, which `useChangeHistory` makes one
step. `apply(list)` returns the cached `rows` for the very
array the commit was made from, and applies the changes again to any other array, such as one a
stream changed since.

Used in: `core/src/editing/use-grid-row-editing.ts` (`useGridRowEditing`, the `rowEditing` feature),
with the grid's source rows, `rowKey`, and the tree's `parentKey` and `childrenField`.

---

## `use-row-selection.ts`

### `useRowSelection(options)` and related types

```ts
type SelectionMode = 'single' | 'multiple'
function useRowSelection<TRow>(options: RowSelectionOptions<TRow>): RowSelection
type RowSelection = ReturnType<typeof useRowSelection>
```

Options: `rows` (the order in which `extend` walks), `rowKey`, `selection` (`Ref<string[]>` for
`v-model`), `selectAll` (`Ref<boolean | null>`), `selectionMode` (default `'multiple'`), `canSelect(key)`,
`getChildren(key | null)` (a tree: `useRowTree().getChildren` fits).

Selection is by **key**, not by row object or index, so it survives sorting, streaming and filtering.

### State model

- `model`: `shallowRef<readonly string[]>` copy of the selected keys. As with `useModelRef`, writes go to
  the local copy first and then to the external ref, because `defineModel` only returns a written value
  after a parent re-render and two operations in one tick would otherwise lose the first. A `watch` with
  `flush: 'sync'` on the external ref copies outside writes in (skipped when `next === model.value`, which
  is the echo of our own write). The same watcher patches `marks`.
- `flag`: the `selectAll` mode, mirrored the same way.
- `marks`: `shallowReactive(new Set(model))`, the model as a **reactive set**. `marks.has(key)` is tracked
  per key, so a click wakes only the rows whose entry changed. `patchSet(target, keys)` makes it hold
  exactly `keys` by deleting missing ones and adding new ones; `add` of an already present key does not
  trigger.
- `anchor` and `lead`: plain variables (not reactive): the row of the last `replace`/`toggle`, and the
  end of the last `extend` range.

### "All selected" mode (`selectAll`)

When the flag is `true`, every row is selected and `selection` holds the **exceptions**. The point is
paged loading: pages not loaded yet arrive already selected ("a newly loaded page comes selected").
Internally `inverted = flag === true`, and `isLeafSelected(key) = canSelect(key) && (inverted !== marks.has(key))`
(an XOR). `mark(next, leaves, value)` keeps this symmetry: selecting in the inverted mode **deletes**
exceptions, deselecting adds them. `selectedCount` counts only loaded rows ("not the whole set", per the
JSDoc).

### Trees

With `getChildren`, `collectLeaves` walks the tree from `null` once (inside the `tree` computed) and
builds `byGroup` (leaves under each group on all levels, in order) and `all` (every leaf, collapsed ones
included). A key with no children is a leaf; a `seen` set guards against a key appearing twice. Then:

- the selection model holds **leaves only**; a group is selected when every selectable leaf under it is;
- "all" means every leaf of the tree, not only shown rows (`universe`);
- in `'single'` mode only leaves can be selected: `getLeaves` returns `NO_KEYS` for a group.

`getLeaves(key)` gives the selectable leaves under a group, or `[key]` for a leaf or a row not in the
tree, or none if `canSelect` refuses.

### Per-row reactivity

`getGroupState(key)` returns `'all' | 'some' | 'none'` from a **lazy `computed` per group** kept in a
`Map`. Each computed tracks only its group's leaves; when its value does not change, Vue does not wake
its readers, so a click under one group wakes the rows of that group only (test). The map is cleaned
when it reaches twice the number of live groups, removing dead names, so it cannot grow without bound.
For a key that is not a group it returns `undefined`, and `isSelected` falls back to `isLeafSelected`.

### Reads

| Member | Meaning |
| --- | --- |
| `selectedKeys` | `computed(() => model.value)`: the model as it is (exceptions in the all mode); same array until the model changes |
| `selectionMode` | `computed` over the option |
| `isSelected(key)` | leaf: tracked per key; group: `state === 'all'` |
| `isPartlySelected(key)` | `state === 'some'`, always `false` for a leaf |
| `isSelectable(key)` | `getLeaves(key).length > 0` |
| `isAllSelected` | inverted: no exceptions left; otherwise selectable rows exist **and** all are selected (an empty list is not "all") |
| `isSomeSelected` | `selectedCount > 0 && !isAllSelected` |
| `selectedCount` | selected leaves among the universe |

### Writes

All writes go through `commit(next, nextFlag)`: patches `marks`, sets `model`, writes `selection` if
given, and writes `flag`/`selectAll` only if the flag changed.

- `replace(key)`: selects only this row (or the leaves of a group), makes it `anchor` and `lead`. Does
  nothing for a row that cannot be selected. In `'single'` the first leaf. The flag, if the mode is
  available, becomes `false` ("turn the all mode off").
- `toggle(key)`: no-op on an unselectable row (a key press on a disabled row keeps the selection).
  `single`: select -> `replace`, deselect -> `clear` and set the anchor. `multiple`: toggles the leaves
  with `mark` and updates the anchor.
- `extend(key)`: Shift+click. `single` -> `replace`. Otherwise gets `range = getRange(anchor, key)` over
  the **shown** rows (`keys` computed, `indexOf` for both ends, `null` if either is not shown, for a
  group it takes `getLeaves` of each row in the range). With a range it first **releases the previous
  range** (`anchor` to `lead`) and then selects the new one, so repeated Shift+click moves the end
  rather than only growing it, and rows selected outside stay. Without an anchor among the shown rows it
  selects the key and makes it the anchor, if selectable. `lead` is set to `key`.
- `set(selected)`: selects exactly the given keys (groups through their leaves, in `single` the last),
  resets anchors, turns the all mode off.
- `clear()`: `set([])`.
- `setAll(value)`: resets anchors; `true` in `single` is a no-op; with the flag mode it sets the flag and
  drops the exceptions; otherwise `mark` over `selectable`.
- `toggleAll()`: `setAll(!isAllSelected.value)`.

Performance notes: `getRange` uses `indexOf` on the keys array twice per call and one pass over the
range, which is O(n) per Shift+click, a user action rather than a per-render path. Reads inside a row
template (`isSelected`, `isPartlySelected`) are O(1) for a leaf.

Used in: `core/src/data-grid/features.ts` (`useGridSelection`, which passes `grid.rows`, `grid.rowKey`
and the tree's `getChildren`). `core` also types `RowSelection`-shaped parameters in
`navigation/use-cell-navigation.ts` and `props/use-grid-props.ts`.

---

## How the pieces fit

Typical pipeline in `@vue-data-grid/core`: rows -> (optional `useRowStream`) -> `useSortedRows` or
`useGroupedRows` -> `useRowTree` (flattening, sorting each level) -> shown rows to the engine;
`useRowSelection` reads the shown rows and the tree's `getChildren`. In `core` the feature composables
(`useGridSorting`, `useGridGrouping`, `useGridTree`, `useGridSelection`) wire these. Everywhere the same
contract holds: **unchanged input returns the previous reference**, built from `stableComputed` plus
reference-comparing resolvers, so the row and column windows and memoized renders downstream do not
wake up.
