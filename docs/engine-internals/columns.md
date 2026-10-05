# `src/columns`

The column model and the state around it: what a column declaration looks like, how it is
normalized and kept reference-stable, where columns may be moved, how a stored layout is laid over
the declarations, how a header click changes the sort, and the one object that holds all of this
user-changeable state (and optionally persists it). Everything here is about **declarations and
state**; turning them into windows, widths and CSS is the job of `render/` and `engine/`.

The folder sits above `shared` and `persist` (it uses `useModelRef` and `usePersistedState`) and
below everything else.

```
columns/
  index.ts                   public surface of the folder
  column.ts                  column types, normalizeColumn, reconcileColumns, row headers, cell text
  column-order.ts            moveColumn, keepsFixedColumns: pure reordering rules
  define-columns.ts          defineColumns, defineColumn: the typed declaration helpers
  layout.ts                  GridLayout, resolveLayout: a stored layout over the declared columns
  sort.ts                    GridSort, toggleSort: the header-click sort cycle
  use-grid-columns-state.ts  useGridColumnsState: layout + sort + multiSort, models and persistence
```

Everything except `use-grid-columns-state.ts` is a pure file: no Vue, tested without it.

**Root API** (`src/index.ts`): the types `AggregateName`, `AggregateResult`, `AnyColumn`,
`AnyColumnInput`, `ColumnAggregate`, `ColumnAggregateResult`, `ColumnAggregates`, `ColumnAlign`,
`ColumnBuilder`, `ColumnBuilderAggregate`, `ColumnBuilderFields`, `ColumnDefaults`,
`ColumnExtension`, `ColumnInput`, `ColumnKey`, `ColumnKind`, `ColumnName`, `ColumnPinSide`,
`ColumnRights`, `Columns`, `ColumnsInput`, `GridColumnsState`, `GridColumnsStateOptions`,
`GridLayout`, `GridSort`, `RememberField`, `RenderedColumn`, `RuntimeColumn`, `SortDirection`; and
the values `defineColumn`, `defineColumns`, `getCellText`, `resolveLayout`, `toColumnList`,
`useGridColumnsState`.

**Internals** (`src/internals.ts`): the types `ColumnGeometry`, `ColumnLayout`, `ColumnOrder`; and
the values `clampColumnWidth`, `DEFAULT_COLUMN_WIDTH`, `DEFAULT_SORT_ORDER`, `getChangedFields`,
`isFunctionOnlyChange`, `keepsFixedColumns`, `moveColumn`, `normalizeColumn`, `reconcileColumns`,
`resolveRowHeaders`, `toggleSort`, `toRuntimeColumn`.

`toggleSort` is internal even though `GridSort` is public: users change the sort through the
`toggleSort` action on the engine scope, not by calling the pure function.

---

## `column.ts`

The biggest file. It holds the type vocabulary of a column in three stages, and the functions that
move a column between them.

### The three stages of a column

| Stage | Type | Meaning |
| --- | --- | --- |
| Declaration | `ColumnInput<TRow, TValue, TMeta, TAggregate>` | what the user writes; everything optional except `value`; fully typed by row and value |
| Declaration, type erased | `AnyColumnInput` | the same with `never` in argument positions, so that a `ColumnInput<Row, number>` and a `ColumnInput<Row, string>` are both assignable to it and fit one object |
| Normalized | `AnyColumn` | defaults filled in, `name` set; the value type erased |
| Callable | `RuntimeColumn` | `AnyColumn` with `unknown` instead of `never`, so its functions can be called |

Why the erasure: a grid has columns of many value types in one list. A `(value: number) => string`
is not assignable to `(value: unknown) => string` (parameters are contravariant), but it **is**
assignable to `(value: never) => string`. So the storage types use `never`, which accepts anything,
and the types you call through use `unknown`. `toRuntimeColumn` is the single cast between the two
(see below).

### Small unions

```ts
type ColumnAlign = 'left' | 'center' | 'right';
type ColumnPinSide = 'start' | 'end';
type AggregateName = 'sum' | 'avg' | 'min' | 'max' | 'count';
type ColumnKind = 'data' | 'service';
```

`ColumnKind` separates `'data'` (a value of the row) from `'service'` (the grid's own furniture: a
checkbox, a row number, actions). CSV, cell ranges, cell changes and autosize skip service columns
unless told otherwise; `resolveRowHeaders` skips them too.

### Aggregate types

- `ColumnAggregate<TRow, TValue>`: a built-in by name, or `(values, rows) => unknown`.
- `AggregateResult<TValue, TAggregate>`: a conditional type that says what an `aggregate` gives:
  `number | null` for `'sum'`/`'avg'`, `TValue | null` for `'min'`/`'max'`, `number` for `'count'`,
  the return type for a function, `undefined` when there is none.
- `ColumnAggregateResult<TColumn>`: the same, read off a whole column type (its `value` and
  `aggregate`); `never` for a column without `aggregate`. The `unknown extends TAggregate` branch
  handles a type that has no `aggregate` key at all (then the inferred `TAggregate` is `unknown`).
- `ColumnAggregates<TColumns>`: a record of results by column name, with columns that have no
  `aggregate` dropped via a key-remapping (`as ... never`). For columns given as an array there are no
  names to type by, so it is `Readonly<Record<string, unknown>>`.

These exist so that a group row built from `defineColumns(...)` has typed aggregates. They are type
level only; no runtime code.

### Facets: `ColumnGeometry`, `ColumnLayout`, `ColumnOrder`

Three narrow interfaces, each listing only the fields that one concern reads:

```ts
interface ColumnGeometry { name; width; minWidth; maxWidth?; flex; align; resizable }
interface ColumnLayout   { name; hiddenByDefault; pinned?; pinnable }
interface ColumnOrder    { name; movable }
```

`AnyColumn` extends all three. The point is to let pure functions take **exactly what they read**:
`resolveLayout` takes `ColumnLayout[]`, `moveColumn` takes `ColumnOrder[]`, `render/geometry.ts`
takes `ColumnGeometry`. Tests then build tiny literals instead of full columns, and a function
cannot accidentally depend on a field outside its facet. They are exported from `internals`, not the
root, because they are a typing convenience for engine code.

### `ColumnRights`

```ts
interface ColumnRights { sortable?; resizable?; movable?; hideable?; pinnable? }
```

The five switches a user can be given over a column. All are **off by default**
(`normalizeColumn` writes `false`), so an unconfigured column is inert. `AnyColumn` takes them as
`Required<ColumnRights>`; `ColumnDefaults` lets a builder set them for all its columns.

### `ColumnExtension<TRow, TValue, TAggregate>`

An **empty interface on purpose**. It is the extension point for layers on top of the engine:
`@vue-data-grid/core` augments it with render fields (`cell`, header, footer templates, and so on)
by declaration merging, and from then on those fields type-check in `defineColumn(s)` and arrive
typed on `RenderedColumn.column`. The rules in its JSDoc matter:

- fields must be optional (the engine itself declares none, and a column without them is valid);
- `TRow` and `TValue` belong in argument positions (so they are contravariant and the `never`
  erasure in `AnyColumnInput` works);
- `TAggregate` is passed so a field can read the aggregate's result through `AggregateResult`.

The engine never reads these fields. It only **keeps** them (the `...input` spread in
`normalizeColumn`) and **compares** them (`reconcileColumns`), which is why that comparison must be
over every key rather than a fixed list.

### `ColumnInput`

The declaration. Field notes that are not obvious from the names:

- `value(row)` is the only required field. Sorting, grouping, aggregation, text and render
  memoization all read it.
- `width` is also the basis a `flex` column grows from. `minWidth` is what a resize cannot go below.
  The defaults are linked, see `normalizeColumn`.
- `equals` is for values that arrive as objects (`Object.is` otherwise).
- `format(value, row)` gives text for CSV, copying, search and autosize by text.
- `compare(a, b)` orders values; the direction is applied by the caller. Empty values (`null`,
  `undefined`, `NaN`) never reach it: they sort last.
- `sortOrder` is the sequence of directions a header click steps through (`toggleSort`).
- `editable`, `parse`, `setValue`, `validate` are the editing contract. `setValue` returns a **new**
  row so memoized rows, row streams and incremental sorting notice the change.
- `meta` is the user's own data. The engine never reads it; `reconcileColumns` compares it one level
  deep (see below).
- `rowHeader` marks the column that names the row for assistive technology; see `resolveRowHeaders`.

`ColumnInput` extends `ColumnRights` and `ColumnExtension`. The fourth type parameter `TAggregate`
exists so the builder (see `define-columns.ts`) can infer the aggregate and pass it to
`ColumnExtension` fields.

### `AnyColumnInput`, `AnyColumn`, `RuntimeColumn`

`AnyColumnInput` and `AnyColumn` repeat the field list with `never` in argument positions and a
`(values: readonly never[], rows: readonly never[]) => unknown` aggregate. They are written out
rather than derived with mapped types so that the declaration order, JSDoc and the interface
merging with `ColumnExtension<never, never, never>` stay readable in editors.

`RuntimeColumn` is `Omit<AnyColumn, RuntimeFunctionField | ExtensionField>` plus the same function
fields with `unknown` arguments, plus `ColumnExtension<unknown, unknown, ColumnAggregate<unknown,
unknown>>`. The `Omit` removes the `never` versions (including whatever fields the extension
adds), and the replacements are callable. This is what sort, CSV and group code receive.

Internal helper types: `RuntimeFunctionField` (the nine function-valued fields) and
`ExtensionField` (`keyof ColumnExtension<never, never, never>`, so augmented fields are omitted
automatically).

### `RenderedColumn`

What the column window hands to rendering, one per shown column plus spacers:

| Field | Meaning |
| --- | --- |
| `column` | `RuntimeColumn`, or `null` for a column-window **spacer** (which has no declaration) |
| `key` | the column name, or a spacer key; unique in the row, meant for `v-for` |
| `index` | position among the shown columns from `0`; `-1` for a spacer; `aria-colindex` is `index + 1` |
| `pin` | `'start'`/`'end'` when pinned |
| `spacer` | which side of the window a spacer stands on |
| `rowHeader` | the column is a row header (the window always renders it) |
| `cellProps` | frozen props for the column's body cells: `key`, `data-dg-column`, `data-dg-pinned`, `data-dg-align`, a geometry `style` string |
| `headerProps` | the same for the header cell |

`cellProps` and `headerProps` are **one frozen object per column shared by every row**. That is the
reference-stability contract: render code patches props by `===`, so identical objects short-circuit
the diff for thousands of cells. It is built in `engine/use-grid-columns.ts`; this folder only
declares the shape.

### `ColumnsInput`

`Readonly<Record<string, AnyColumn>>`: the shape `defineColumns` returns, columns by name.

### `DEFAULT_COLUMN_WIDTH`

`120` (px). Internal.

### `clampColumnWidth(column, width)`

```ts
function clampColumnWidth(column: Pick<ColumnGeometry, 'minWidth' | 'maxWidth'>, width: number): number
```

`Math.min(maxWidth ?? Infinity, Math.max(minWidth, Math.round(width)))`.

Order matters and is tested: **round first, then clamp** (so rounding can never push a width past a
limit), and the maximum is applied **last**, so a `maxWidth` below `minWidth` wins. Negative widths
rise to `minWidth`. Without `maxWidth` there is no upper bound.

Used by `engine/use-grid-columns.ts` (initial sizes and width writes) and
`engine/use-grid-engine.ts` (the width an action finally applies).

### `toRuntimeColumn(column)`

`column as unknown as RuntimeColumn`. The single, documented place where the erased type becomes the
callable one. It returns the same object (tested), so it costs nothing and preserves references.
Used by `engine/use-grid-columns.ts` (building `RenderedColumn`), `rows/sort-rows.ts` and
`cells/use-cell-changes.ts`.

### `getCellText(column, row)`

The cell value as text, shared by CSV, copy and anything else that needs "what the cell says":

1. `value = column.value(row)`;
2. if the column has `format`, return `format(value, row)`;
3. otherwise `''` for `null`/`undefined`, else `String(value)`.

Accepts `AnyColumn | RuntimeColumn` and casts to `RuntimeColumn` inside, so callers can pass
whichever they hold. It lives here, not in `cells/`, because text is a fact about the column and the
data, true under any markup (an engine concern by the architecture rule). Exported at the root.
Used by `cells/csv.ts` and, in `@vue-data-grid/core`, by `components/cell-content.ts` (fallback cell
content) and `drag/use-grid-row-drag.ts` (drag label).

### `normalizeColumn(name, input)`

Turns a declaration into an `AnyColumn`. The name is an **argument**, not read from the input,
because in `defineColumns` it comes from the object key.

Steps:

1. `width = input.width ?? getDefaultWidth(input)`, where `getDefaultWidth` is
   `min(maxWidth ?? Infinity, max(120, minWidth ?? 0))`: the default 120, raised to `minWidth` if
   that is wider, capped by `maxWidth`.
2. Build the result: `...input` **first** (so unknown fields, such as `ColumnExtension` ones,
   survive), then every known field explicitly.
3. `minWidth = input.minWidth ?? Math.min(width, 120)`: a narrow column (`width: 40`) gets a
   `minWidth` of 40, not 120, so a resize can't be wider than what it started as by default.
4. Defaults: `kind: 'data'`, `flex: 0`, `align: 'left'`, `hiddenByDefault: false`, every right
   `false`, `editable: false`.

Non-obvious points:

- Defaults use `??`, so `0` and `''` given explicitly are kept (tested: "zero and empty values are
  not replaced by defaults").
- Optional fields (`label`, `rowHeader`, `maxWidth`, `pinned`, `equals`, `format`, ...) are written
  out as keys with `undefined` when absent. This keeps the object shape uniform across columns (a
  stable hidden class) and makes the field-by-field comparison in `reconcileColumns` see the same
  key set on both sides.
- `meta` passes through as the same reference.
- Every call creates **new objects**. That is expected: `reconcileColumns` is what restores stable
  references afterwards.

Internal; used by `defineColumns` in this folder.

### Reconciliation: the reference-stability machinery

The problem: users build columns in a `computed` or in a template, so every re-evaluation produces
fresh objects with the same content. Anything keyed by column reference (column windows, render
memo, `cellProps`) would rebuild.

#### Private helpers

| Helper | Role |
| --- | --- |
| `Fields` | `Readonly<Record<string, unknown>>`, the view of a column as a bag of fields |
| `isPlainObject(value)` | `true` for objects whose prototype is `Object.prototype` or `null`; arrays, class instances, `Date`, `Map` are not plain |
| `getFieldNames(current, next)` | the union of both objects' keys, as a `Set`; so a field present on one side only counts as a difference |
| `isSameMeta(current, next)` | `Object.is` first; if both are plain objects, compares every key with `Object.is` (**one level deep**); anything else is different |
| `isSameField(name, current, next)` | `meta` goes through `isSameMeta`, every other field through `Object.is` |
| `isSameColumn(column, other)` | `===` shortcut, then `isSameField` over the union of keys |

Why `Object.is` and key union rather than a list of known fields: layers add fields through
`ColumnExtension`, and the engine cannot know them. Comparing every key means an added render
function is noticed without the engine changing. Functions are compared by reference, which is
right: a new function is a new behaviour, and the cell must re-render.

Why `meta` gets one level of depth: users put literals there (`meta: { currency: 'USD' }`). A
literal rebuilt in a `computed` has a new identity but the same values; reference equality would
make every column "change" on each evaluation. One level is the compromise: a nested object inside
`meta` is still compared by reference (tested).

#### `reconcileColumns(current, next)`

```ts
function reconcileColumns(current: readonly AnyColumn[], next: readonly AnyColumn[]): readonly AnyColumn[]
```

1. Index `current` by name in a `Map`.
2. For each column in `next`, look up the previous one **by name**; if it exists and `isSameColumn`,
   use the previous object, else the new one.
3. Track `same`: the lengths are equal and every resolved column is `===` the one at the same index
   in `current`.
4. Return `current` itself when `same`, otherwise the new array.

Consequences, all covered by tests:

- Unchanged content: same array, same objects (the whole pipeline downstream stays asleep).
- One changed column: a new array, the other columns keep their references.
- Reordering: a new array of the **previous objects** (the order is a change, the columns are not).
- Added or removed column: a new array; the others keep references.
- A renamed column gets no inherited reference (matching is by name).
- Empty on top of empty: the previous array.
- A function recreated on each evaluation (`value`, `format`) is a change.

Lookup is by `Map`, so the cost is O(columns), not O(columns²).

Used only by `engine/use-grid-engine.ts`, inside a `stableComputed` whose resolver is
`reconcileColumns(previous, toColumnList(toValue(options.columns)))`; that gives `columnList` its
stable identity.

#### `getChangedFields(column, other)`

The names of the fields in which `other` differs from `column`, by exactly the rules of
`reconcileColumns` (same helpers). Used by the dev-only recreation watcher in
`engine/use-grid-engine.ts`.

#### `isFunctionOnlyChange(column, other, fields)`

`true` when `fields` is non-empty and every listed field is a function on both sides. It answers "was
this column rebuilt with nothing but new arrows?", the typical mistake of declaring columns inside a
`computed`. The same watcher counts such recreations per column and, on reaching its limit, warns in
development with the `[@vue-data-grid/engine]` prefix that all the cells re-render each time.

### `resolveRowHeaders(columns)`

```ts
function resolveRowHeaders(columns: readonly Pick<AnyColumn, 'name' | 'kind' | 'rowHeader'>[]): Set<string>
```

Which columns name the row for assistive technology. Rules:

1. Every column with `rowHeader === true`; if there is at least one, that is the answer (the default
   is off).
2. Otherwise the first `data` column, unless it says `rowHeader: false`, in which case none.

Takes the **shown** columns in display order (the caller passes `visible`), so hiding or moving the
first column moves the default row header. Service columns never become the default. Returns a
`Set<string>` of names for O(1) lookup per column. The engine only decides *which* column; the
`role="rowheader"` itself is set in `@vue-data-grid/core`. Used by `engine/use-grid-columns.ts`
when it builds `RenderedColumn.rowHeader`; the column window keeps those columns rendered.

### `toColumnList(columns)`

```ts
function toColumnList(columns: ColumnsInput | readonly AnyColumn[]): readonly AnyColumn[]
```

Accepts an object by name or an array. An array is returned as the **same reference** (no copy);
an object becomes `Object.values(...)` in key order. Exported at the root. Used by
`engine/use-grid-engine.ts`, `useGridColumnsState` (for the set of known names) and by the rows
folder (`row-groups.ts`, `sort-rows.ts`, `use-grouped-rows.ts`, `use-row-tree.ts`,
`use-sorted-rows.ts`) so each accepts both forms.

---

## `column-order.ts`

Pure rules for moving a column. They know nothing about hidden columns, pins or groups; the engine
layers those on.

### `moveColumn(columns, name, before)`

```ts
function moveColumn<TColumn extends ColumnOrder>(
	columns: readonly TColumn[],
	name: string,
	before: string | null,
): TColumn[] | null
```

Moves column `name` to stand before column `before`, or to the end if `before` is `null`. Returns a
**new array**, or `null` for "no move".

Steps:

1. Find the column; `null` if it is missing, not `movable`, or `before === name`.
2. `rest` = the list without the column.
3. Target index: `rest.length` for `null`, else the index of `before` **in `rest`** (so the target is
   counted without the moved column, which is what makes left-to-right moves land correctly).
   `null` if `before` is not found.
4. Insert the same column object at that index in a copy.
5. If the result is element-for-element identical to the input, return `null`.

The `null` in the last step is the "nothing would change" signal, e.g. moving a column before its
next neighbour, or the last one to the end. Callers then skip a state write and a re-render. Generic
over `TColumn extends ColumnOrder` so it returns the caller's own type. The input is never mutated.

### `keepsFixedColumns(columns, next)`

`columns.every((column, index) => column.movable || next[index]?.name === column.name)`.

A column that is not `movable` must keep its exact **position**. `moveColumn` only checks that the
*moved* column is movable; moving a movable column over a fixed one would shift the fixed one. This
second check catches that (tested: "a movable column cannot jump over a fixed one: the check catches
it, not the move itself"). A fixed column missing from `next` fails, since `next[index]?.name`
cannot match. An empty list passes.

Both are used together in `engine/use-grid-columns.ts` (`moveColumn` on the ordered columns, then
`keepsFixedColumns(view.visible, after)` together with the column-groups check) before a move is
accepted.

---

## `define-columns.ts`

The typed way to declare columns. Almost all of the file is types; the runtime is a few lines.

### `defineColumns(input)`

```ts
function defineColumns<TInput extends Record<string, AnyColumnInput>>(input: TInput): Columns<TInput>
```

For each key of `input`, `normalizeColumn(key, input[key])`; the result is `Object.freeze`d and cast
to `Columns<TInput>`. The key becomes the column name, so names are unique by construction and typed
as string **literals** (this is what lets `GridSort<ColumnName<TColumns>>` and typed
aggregates work). Key order is preserved and defines the declared order. Unknown fields are kept
(`normalizeColumn` spreads the input). An empty object gives an empty frozen object.

Each call returns new objects; stable references come from `reconcileColumns` in the engine, not
from here.

### `Columns<TInput>`

```ts
type Columns<TInput> = {
	readonly [TName in keyof TInput]: TInput[TName] & ResolvedFields & { name: TName & string };
};
```

The return type: the user's input type **intersected** with the defaults the function fills in
(`ResolvedFields`: `kind`, `width`, `minWidth`, `flex`, `align`, `hiddenByDefault`, and the five
rights) typed as present, and a literal `name`. Intersecting rather than mapping keeps the original
declaration types, so `ColumnAggregateResult` can still read each column's `value` and `aggregate`.

### `ColumnDefaults`

```ts
type ColumnDefaults = ColumnRights & Pick<ColumnInput<unknown, unknown>,
	'kind' | 'width' | 'minWidth' | 'maxWidth' | 'flex' | 'align' | 'sortOrder' | 'editable'>;
```

What a builder may preset for all its columns: the rights, geometry, kind, sort order and
editability.

### `ColumnKey<TRow>`

`keyof TRow & string`: the keys of a row a column can read by name.

### `ColumnBuilderAggregate`, `ColumnBuilderFields`

Type plumbing that lets the builder **infer** the `aggregate`:

- `ColumnBuilderFields<TRow, TValue, TMeta, TName, TResult>` is `ColumnInput` without `value` and
  `aggregate`, plus an `aggregate?: TName | ((values, rows) => TResult)` written out directly. If it
  were taken from `ColumnInput`, TypeScript could not infer the aggregate's name or the function's
  return type as separate type parameters.
- `ColumnBuilderAggregate<TRow, TValue, TName, TResult>` converts what was inferred back into the
  `aggregate` type of the resulting `ColumnInput`: `undefined` when neither was given, the literal
  name when a built-in was, a function returning `TResult` when a function was. The check
  `[TResult] extends [never]` is how "no function given" is detected (the default of `TResult` is
  `never`).

The inferred aggregate then types `ColumnExtension` fields (for example a footer reading the
result), and a function `aggregate` does so for the fields **after** it in the object literal.

### `ColumnBuilder<TRow, TMeta>`

An interface with **two call signatures**:

1. `(key: TKey, rest?)` where `TKey extends ColumnKey<TRow>`: the value is the row field's type,
   optionally widened by `TValue` (`TValue | TRow[TKey]`). The widening exists because other fields
   may accept more than the field holds (e.g. an editor that can clear a number cell gives
   `number | null`).
2. `(value: (row) => TValue, rest?)`: the value is a function of the row.

Both return a `ColumnInput` whose `TAggregate` is wrapped in `NoInfer`, so the aggregate is
inferred from the `rest` argument and not back from the result type.

### `defineColumn(defaults?)`

```ts
function defineColumn<TRow, TMeta = unknown>(defaults?: ColumnDefaults): ColumnBuilder<TRow, TMeta>
```

Returns a builder bound to a row type: `const column = defineColumn<Row>()`, then
`column('price', { ... })` or `column(row => row.price * row.quantity, { ... })`.

The runtime is one inner function `build(value, rest)` that returns
`{ ...defaults, ...rest, value: toValue(value) }`. Order of the spread: `defaults` are overridden by
the call's `rest`, and `value` always comes last. `toValue` turns a key into `row => row[key]` once,
at declaration time, and passes a function through unchanged (functions are kept by reference, so a
function passed in stays the very same reference reconcile compares).

The overloads are one function at runtime; `build as ColumnBuilder<TRow, TMeta>` is the single cast,
commented in the source, because each overload types its own call. Declarations from a builder fit
into `defineColumns` (tested), and keys and functions mix in one object.

A builder is how the "rights for the whole grid" are written once: `defineColumn<Row>({ sortable:
true, resizable: true })`.

Both `defineColumns` and `defineColumn` are exported at the root. Within this repo, `defineColumns`
is used by `@vue-data-grid/core` (`components/grid-body.ts`, `grid-templates.ts`,
`data-grid/features.ts`, `data-grid/use-data-grid.ts`) among others.

---

## `layout.ts`

The **user-changeable** part of the column state, as one serializable object, and the function that
reconciles it with the current declarations.

### `GridLayout`

```ts
interface GridLayout {
	order: string[];                       // column names in display order
	hidden: string[];                      // names of hidden columns
	widths: Record<string, number>;        // widths the user set (px); a column without an entry uses its own
	pinned: Record<string, ColumnPinSide>; // pin side by name
	collapsed?: Record<string, boolean>;   // column groups the user collapsed or expanded
}
```

It is plain JSON on purpose: this is what gets persisted and what `v-model:layout` carries.
`collapsed` is optional; groups without an entry follow their `collapsedByDefault`.

### Private helpers

- `getDefaultPins(columns)`: `{ name: side }` for columns that are both `pinnable` **and** declare
  `pinned`. A `pinned` on a non-pinnable column is not a user-movable pin; `use-grid-columns.ts`
  (`resolvePins`) treats it separately as a fixed pin.
- `createLayout(columns)`: the layout from declarations alone: `order` from the declared order,
  `hidden` from `hiddenByDefault`, empty `widths`, default pins. No `collapsed`.
- `mergeOrder(columns, order)`: see below.

### `mergeOrder(columns, order)`

Puts columns the stored order does not know **where they are declared** instead of dumping them at
the end:

1. Walk `columns` in declared order, keeping `anchor`: the last column seen that **is** in the stored
   order (`null` before any).
2. A column not in the stored order is added to a `trailing` map under its current `anchor`
   (`Map<anchor | null, names[]>`), in declaration order.
3. Result: the names trailing `null` first (new columns declared before every known one), then for
   each name in the **stored** order: that name, followed by its trailing names.

So a new column declared between B and C appears right after B even if the user has since moved C
to the front. The anchor is chosen by the *declared* order but placed by the *stored* order (tested:
"the stored order serves as the anchor, not the declared one"). Several consecutive new columns keep
their relative order. Names in the stored order that are no longer declared stay in the result
(tested: "a column no longer declared stays in the order"); dropping them is the consumer's job
(`orderColumns` in `use-grid-columns.ts` ranks by the order and works over declared columns, so they
simply don't render).

### `resolveLayout(columns, layout)`

```ts
function resolveLayout(columns: readonly ColumnLayout[], layout: GridLayout | null): GridLayout
```

"Lays a stored layout over the declared columns; without one, builds it from the declarations."

1. `layout === null`: `createLayout(columns)`.
2. `added` = declared columns not in `layout.order`.
3. `pinned` = `layout.pinned`, or, for a record that has none (an old schema or a partial one),
   `getDefaultPins(columns)`. The stored layout is read through `Partial<GridLayout>` for exactly
   this.
4. **If nothing was added and `pinned` is the stored one, return `layout` itself.**
5. Otherwise return a new object: merged `order`; `hidden` = old hidden plus the *added* columns that
   are `hiddenByDefault`; `widths` and `collapsed` carried over by reference; `pinned` = the pins
   plus the default pins of the *added* columns only.

Invariants and edge cases:

- **Reference-stable in the common case.** The engine runs this in a `computed`; returning the stored
  object means a layout that needs no changes does not wake dependents.
- **User choices win over declarations.** A column the user has shown does not become hidden again
  (it is in `order`, so it is not `added`, so `hiddenByDefault` is not re-applied). Pins of existing
  columns are not touched when a new column arrives.
- A record without `pinned` is rebuilt, never returned as is (tested), because step 4's identity check
  fails.
- `widths` are not validated or pruned; names that no longer exist are harmless.

Exported at the root. Used by `engine/use-grid-columns.ts` (`resolved = computed(() =>
resolveLayout(columns, layout))`). The resolved layout is derived, not written back to the model
until an action changes something (`{ ...resolved.value, ...next }`).

---

## `sort.ts`

### Types and `DEFAULT_SORT_ORDER`

```ts
type SortDirection = 'asc' | 'desc';
interface GridSort<TName extends string = string> { name: TName; direction: SortDirection }
const DEFAULT_SORT_ORDER: readonly SortDirection[] = ['desc', 'asc'];
```

The sort is a list of `GridSort`, one per sorted column, in priority order. `TName` lets
`useGridColumnsState` type names from the columns. Header clicks **start with descending**
(`['desc', 'asc']`), then ascending, then off; a column overrides this with `sortOrder`.

### `getNextSort` (private)

`order[current ? order.indexOf(current.direction) + 1 : 0]`: the direction after the current one in
`order`, or the first direction if the column is not sorted. Returns `{ name, direction }`, or
`null` when it runs off the end of `order` (clear). Edge cases tested: a direction missing from
`order` has `indexOf` of `-1`, so it is replaced by the first one; an empty `order` never sorts; a
single-direction order turns on and then off.

### `toggleSort(sort, name, additive, order = DEFAULT_SORT_ORDER)`

The sort after a header click on `name`.

- **Not additive** (a plain click): the column becomes the **only** sort key, or the sort becomes
  empty if the cycle is over. Other columns are dropped.
- **Additive** (shift-click with multi-sort):
  - column not yet sorted: appended to the end (unless the cycle gives `null`);
  - column already sorted: changes direction **in place** (keeping its priority), or is removed when
    the cycle ends, keeping the order of the others.

Always returns a new array and never mutates `sort` (there is a test for immutability; even the
"nothing happens" case returns a copy: `[...sort]`). The caller decides whether `additive` applies;
the engine passes `additive && multiSort.value`.

Internal export. Used by `engine/use-grid-engine.ts`, in its `toggleSort` action:
`state.sort.value = toggleSort(activeSort.value, name, additive && multiSort.value, column.sortOrder)`.
In `@vue-data-grid/core` the header click goes through the scope's `toggleSort`
(`header/use-header-cell.ts`), not through this function.

---

## `use-grid-columns-state.ts`

The only reactive file in the folder. It owns the state that a user changes at run time and that
may outlive the page: the `layout`, the `sort`, and the `multiSort` switch. The engine
(`useGridEngine`) and `useDataGrid` in core take it as `state`; if the caller gives none, the engine
creates a default one (`useGridColumnsState()`).

### Types

```ts
type RememberField = 'order' | 'hidden' | 'widths' | 'pinned' | 'collapsed' | 'sort';
type ColumnName<TColumns> = TColumns extends readonly unknown[] ? string : Extract<keyof TColumns, string>;
```

`RememberField` names what `persist` keeps. `ColumnName` is the union of column names for columns
from `defineColumns`, and plain `string` for an array (an array has no literal names).

#### `GridColumnsStateOptions<TColumns>`

| Option | Meaning |
| --- | --- |
| `columns` | columns from `defineColumns`; types the names in `sort` at compile time, and a **restored** sort drops names not among them |
| `sort` | the initial sort, or a ref used as a model (`v-model:sort`); the state writes to it and follows it |
| `layout` | a `Ref<GridLayout \| null>` as a model (`v-model:layout`); `null` means the declared layout |
| `multiSort` | boolean or ref; whether a header click may add a column to the sort; a ref is used as is |
| `persist` | a `PersistStore`; read once |
| `remember` | which `RememberField`s `persist` keeps; everything by default |

#### `GridColumnsState<TName>`

| Member | Meaning |
| --- | --- |
| `layout: Ref<GridLayout \| null>` | writes also go to the `layout` model if there is one |
| `sort: Ref<readonly GridSort<TName>[]>` | writes also go to the `sort` model; **replaced as a whole, never mutated** (a change in place reaches no reader) |
| `multiSort: Ref<boolean>` | can be switched at any time; the engine reads it reactively |
| `reset()` | back to the initial values, and removes the stored record |
| `ready` | `false` until the stored state is read and applied; always `true` without `persist` |

### `useGridColumnsState(options = {})`

```ts
function useGridColumnsState<TColumns extends ColumnsInput = ColumnsInput>(
	options?: GridColumnsStateOptions<TColumns>,
): GridColumnsState<ColumnName<TColumns>>
```

#### Setup

1. **Sort source.** If `options.sort` is a ref it is the model and the initial value is a copy of its
   current content; if it is an array it is only the initial value (copied, so the caller's array
   is never aliased); otherwise empty.
2. **Initial layout** is `options.layout?.value ?? null`, captured once for `reset`.
3. `layout` and `sort` are `useModelRef`s over the models (see `shared`): local copy for
   read-after-write inside one tick, writes to both. This is why two header clicks in one handler
   build on each other even when `v-model` has not yet come back from the parent.
4. `multiSort` is `options.multiSort` when it is a ref (**the same ref**, tested), otherwise
   `ref(options.multiSort ?? false)`. Multi-sort is off by default.
5. `remember` is a `Set`, defaulting to every field. `known` is the set of declared names from
   `toColumnList(options.columns)`, or `null` when no `columns` were given.

#### Persistence, only if `options.persist` is given

The two values are wrapped in one computed `stored`:

```ts
const stored = computed<StoredState>({
	get: () => ({ layout: layout.value ?? undefined, sort: sort.value }),
	set: (restored) => { layout.value = mergeLayout(restored.layout); if (restored.sort) sort.value = restored.sort; },
});
```

and handed to `usePersistedState(stored, persist, { parse, serialize })` (see the Persist page for
restore, write, echo handling, the `ready` flag and the hydration-safe start). This file supplies
only the two pieces that know the shape of the data.

**`serialize(value)`** produces the record:
`{ version: 1, layout: pickLayout(value.layout, remember, identity), sort: remember has 'sort' ? value.sort : undefined }`.
`undefined` fields vanish in JSON. Only remembered fields are written. The storage key is whatever
the store was created with, with no prefix added.

**`parse(value)`** validates a record that may have been written by older or hostile code, and
returns `undefined` (reject) unless it is a record whose `version` equals `STORAGE_VERSION` (`1`).
So a record of another version, or none, is ignored whole. Then field by field:

| Field | Reader | Drops |
| --- | --- | --- |
| `order`, `hidden` | `readNames` | non-arrays are dropped as a field; non-string items are filtered out |
| `widths` | `readMap(value, isWidth)` | entries whose value is not a finite number greater than `0` |
| `pinned` | `readMap(value, isPinSide)` | values other than `'start'`/`'end'` |
| `collapsed` | `readMap(value, isFlag)` | non-boolean values |
| `sort` | `readSort(value, known)` | item by item: needs a record with a string `name`, a `direction` of `asc`/`desc`, and, when `known` exists, a declared column name |

A broken field is dropped but the rest of the record still applies (tested: "`order` that is not an
array is dropped, the rest applies"). Fields that are not in `remember` are ignored on read too, so
narrowing `remember` later does not resurrect old stored data.

`pickLayout(layout, remember, read)` is shared by both directions. It loops over `LAYOUT_FIELDS`,
applies `read` (a validating reader on parse, identity on serialize) to the remembered ones, and
returns the object of the fields present, or `undefined` when none is. That `undefined` is what lets
a record with no usable layout leave the current layout alone.

`mergeLayout(restored)` is the `set` side: if nothing was restored it returns the current layout
unchanged; otherwise it merges over `layout.value ?? { order: [], hidden: [], widths: {}, pinned: {} }`,
taking each restored field when present and the current one otherwise. Because only some fields may
be remembered, a restored layout can be partial and must not blank the others.

The sort is applied only if the record had a (validated, possibly empty) sort, so a record that does
not remember the sort leaves the initial sort untouched. Since the restored `sort` array can be empty
(all entries dropped), an invalid sort restores to "no sort", not to the initial one.

Private type guards (`isRecord`, `isName`, `isWidth`, `isPinSide`, `isFlag`) and the constants
`ALL_FIELDS`, `LAYOUT_FIELDS`, `STORAGE_VERSION`, `DIRECTIONS`, `LAYOUT_READERS` are local to the
file.

#### `reset()`

```ts
layout.value = initialLayout;
sort.value = [...initialSort];
persisted?.forget();
```

Back to what the state started with: the `layout` model's value at creation (or `null`) and a fresh
copy of the initial sort. `forget()` removes the stored record without the writing watcher bringing
it back (that guarantee is in `usePersistedState`). Works without storage too. `multiSort` is not
reset: it is a setting, not user state.

#### Return value

```ts
{ layout, sort: sort as unknown as Ref<readonly GridSort<ColumnName<TColumns>>[]>, multiSort, reset,
  ready: persisted?.ready ?? shallowRef(true) }
```

The cast on `sort` is the typing boundary: internally names are `string`, outwardly they are the
literal union taken from `columns`. `ready` is the persist state's flag, or a constant `true`.

### Reference stability

- `layout` and `sort` are replaced wholesale, never mutated; readers use the ref identity.
- An echo of our own write (another tab, or a `memoryStore` notifying the writer) does not
  recreate the layout (tested: "our own change does not come back as an echo: the layout stays the
  same object", and "the same write again does not recreate the layout, or the whole grid would
  re-render"); that comes from `usePersistedState`'s `synced` comparison.
- Because `resolveLayout` returns its input when nothing changed, the engine's derived layout keeps
  its identity across such events.

### Where it is used

- `engine/use-grid-engine.ts`: `options.state ?? useGridColumnsState()`; then reads `state.layout`,
  `state.sort`, `state.multiSort` and writes `state.sort` in the `toggleSort` action.
- `@vue-data-grid/core`, `data-grid/use-data-grid.ts`: creates it from `sort`, `layout`, `multiSort`,
  `persist` and `remember` of the data grid options when no `state` is passed, and warns in
  development if both `state` and those options are given.
- `@vue-data-grid/core` also hands it on to feature factories as the `state` field of the `RowsGrid`
  object built in `data-grid/use-data-grid.ts`.

Exported at the root, together with `GridColumnsState`, `GridColumnsStateOptions`, `RememberField`
and `ColumnName`.
