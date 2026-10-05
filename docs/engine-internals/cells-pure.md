# `src/cells` (pure functions)

The lower half of the cells folder: the files with no `ref`, `computed` or `watch`. They answer
questions such as "which cell is next", "which cells does this range cover", "what does a paste
write" from plain arguments, so each can be tested without Vue or a DOM. The `use-*.ts` composables
of the same folder (focus, ranges, editing, changes, history) sit on top of them and are described on
the composables page.

```
cells/
  index.ts          public surface of the folder (also exports the use-* files)
  cell-address.ts   the vocabulary: addresses, positions, the grid of keys and columns
  cell-edit.ts      edit types, "may this cell be edited / is it the same / is it valid", applying edits to rows
  cell-focus.ts     one keyboard move in a plain rows x columns grid
  cell-range.ts     range types, range -> index bounds, rectangle algebra
  csv.ts            rows -> CSV text
  fill.ts           the fill handle: target rectangle and the writes of a fill
  grid-move.ts      a keyboard move across stacked sections (header, body, footer) with spans
  paste.ts          CSV/TSV text -> rows of fields; fields -> writes over a selection
```

Entry points. The root API (`@vue-data-grid/engine`) exports every type of these files and these
functions: `isDataColumn`, `getCellColumns`, `isCellAddress`, `canEditCell`, `resolveCellMove`,
`getRangeBounds`, `isInRangeBounds`, `isSameRangeBounds`, `getRangeCells`, `toCsv`, `getFillTarget`,
`resolveFill`, `resolveGridMove`, `parseDelimited`, `resolvePaste`. Only seven functions go to
`internals.ts`: `applyCellEdits`, `containsRangeBounds`, `getEdgeRow`, `isSameCellValue`,
`replaceRows`, `subtractRangeBounds`, `validateCell`. They are building blocks of the composables
(and are tested there), not something an application is expected to call.

Dependencies inside the folder go one way: `cell-address` is imported by `cell-edit`, `cell-range`,
`fill` and `paste`; `cell-focus` by `grid-move`. Only `cell-address`, `cell-edit` and `csv` reach out of
the folder, to `../columns/column` (types and `getCellText`).

---

## `cell-address.ts`

Three small shapes that every other file shares, plus three helpers about columns.

### `CellAddress`, `CellPosition`

```ts
interface CellAddress  { key: string;   column: string }  // by row key
interface CellPosition { index: number; column: string }  // by row index
```

Two ways to name a cell, for two different questions:

- `CellAddress` is a cell **in the data**. The row key moves with its row through sorting, inserted
  rows and streaming, and the column name survives column reordering. Use it for anything that must
  stay on "the same" cell: a pending edit, a range corner that should follow its row.
- `CellPosition` is a cell **on screen**: the index of the row in `rows` and the column name. It stays
  in its place while the data under it changes. Use it for things tied to the place, such as a range
  that must not jump when a stream inserts a row above.

Neither carries a column index: column names are stable, indexes depend on the current display order
and are only computed where needed (see `CellGrid`, `RangeBounds`).

### `CellGrid`

```ts
interface CellGrid {
	keys: readonly string[];     // row keys in the order of `rows`
	columns: readonly string[];  // column names in display order
}
```

The cells that a range, a paste or a fill counts in. It is the bridge between indexes and names:
`RangeBounds` hold indexes, and `grid.keys[row]` / `grid.columns[column]` turn them into a
`CellAddress`. The caller decides which columns count (usually data columns, via `getCellColumns`),
so these functions never look at column kinds themselves.

### `isDataColumn(column)`

`column.kind !== 'service'`. Service columns (selection checkbox, row number, expander) are drawn like
columns but hold no data, so they are not focus targets of the cell models, not copied, not written
into and not exported. Used as the default `include` of `getCellColumns`; `csv.ts` tests `kind !== 'service'` inline
instead of calling it.

### `getCellColumns(columns, include = isDataColumn)`

```ts
function getCellColumns(
	columns: readonly RenderedColumn[],
	include?: (column: RuntimeColumn) => boolean,
): RuntimeColumn[]
```

`scope.columns` is the **rendered** list, which in a column window contains spacer entries (`item.column`
is empty) next to real columns. This function walks it once, drops the spacers, drops what `include`
refuses, and returns the runtime columns in order. Passing `() => true` keeps service columns too.

Where it is used (checked): `use-cell-changes.ts`, `use-cell-editing.ts`, `use-cell-ranges.ts` (with
the `canSelectColumn` option as `include`), `use-grid-focus.ts` (with `() => true`: service cells take
focus there); in core `use-grid-editing.ts` and `use-grid-props.ts`; in the `showcase` demo.

### `isCellAddress(cell)`

```ts
function isCellAddress(cell: CellAddress | CellPosition): cell is CellAddress
```

A type guard: `'key' in cell`. It is the single place that tells the two shapes apart. Used by
`cell-range.ts` (`getEdgeRow`) and `use-cell-ranges.ts`.

---

## `cell-edit.ts`

The vocabulary and the small rules of editing. The composable `useCellEditing` owns the flow
(drafts, commit, events); this file owns the questions it asks of a column and of rows.

### Types

| Type | Meaning |
| --- | --- |
| `CellEditSource` | where an edit came from: `'edit' \| 'paste' \| 'fill' \| 'clear' \| 'cut' \| 'undo' \| 'redo'` or any string. `(string & {})` keeps the literals in autocomplete while accepting custom sources. `'undo'`/`'redo'` are the writes of `useChangeHistory`, which it does not record as new steps. |
| `CellWrite` | `CellAddress` + `value`: a value to put into a cell. `expected` (optional) means "write only while the cell still holds this value, compared by the column's `equals`"; a cell that changed meanwhile is skipped. Undo writes with it, so it never overwrites a newer change. |
| `CellTextWrite` | `CellAddress` + `text`: text that goes through the column's `parse` first. Paste and clearing produce these. |
| `CellEdit<TRow>` | a cell that a commit **did** change: `row` (the row object before the commit), `before`, `after`. `after` is what the cell holds in the *new* row as the column's `value` reads it, not the raw input, so a `setValue` that trims or rounds is visible. |

Writes are "what to do" (input), edits are "what happened" (output).

### `canEditCell(column, row)`

Returns true only when all hold: `column.kind === 'data'`, `column.setValue` exists, and `editable` is
`true` or a function that returns truthy for this row. Without `setValue` there is no way to write the
value back into an immutable row, so such a column is never editable even with `editable: true`.
`editable === true` is checked strictly: other truthy non-function values do not count. Used by
`use-cell-editing.ts` (three places) and in core by `grid-body.ts`.

### `isSameCellValue(column, current, next)`

Uses the column's `equals` when it has one, otherwise `Object.is`. `Object.is` rather than `===`
so `NaN` equals `NaN` (no endless "changes") and `-0` differs from `0`. Columns with object or date
values supply `equals`. Used by `use-cell-editing.ts` for three decisions: `expected` check, "is this
write a no-op", and filtering edits whose `after` equals `before`.

### `validateCell(column, value, row)`

Calls `column.validate?.(value, row)` and normalises the answer: a non-empty string is the error
text, anything else (including `''`, `undefined`, `null`, `false`) means valid and gives `null`. So a
validator may return `''` for success. Used by `use-cell-editing.ts` for the draft and for each edit
before applying.

### `applyCellEdits(edits, getColumn)`

```ts
function applyCellEdits<TRow>(
	edits: readonly CellEdit<TRow>[],
	getColumn: (name: string) => RuntimeColumn | undefined,
): Map<string, TRow>
```

Problem: a commit may change several cells of one row (a paste across columns). `setValue(row, value)`
returns a **new** row, so the second cell must be applied to the result of the first.

Steps:

1. Walk the edits in order; for each find the column's `setValue` (an unknown column or one without
   `setValue` is skipped silently).
2. Take the row built so far for this key (`rows.get(edit.key)`), or `edit.row` for the first edit of
   that row.
3. Store `setValue(thatRow, edit.after)` under the key.

The result is a `Map` of row key to the final row. It does not touch the rows list; see
`replaceRows`. Used once, in `use-cell-editing.ts`.

### `replaceRows(rows, replaced)`

```ts
function replaceRows<TRow>(rows: readonly TRow[], replaced: ReadonlyMap<TRow, TRow>): readonly TRow[]
```

Maps old row **object** to new row object (the map is keyed by row identity, not key). It maps `rows`,
and if no row was in `replaced` it returns the **same array** (`rows`), not a copy. That is the stable
reference rule from `CLAUDE.md`: a commit that changes nothing must not wake everything that watches
the rows. The `replaced === undefined` check means a replacement can never be `undefined`.
Used in `use-cell-editing.ts` (`apply: list => replaceRows(list, replaced)`).

---

## `cell-focus.ts`

One keyboard move in a rectangular grid. No sections, no spans; the sectioned version is
`grid-move.ts`, which calls this one.

### `CellIndex`, `CellGridSize`, `CellMove`

```ts
interface CellIndex    { row: number; column: number }
interface CellGridSize { rows: number; columns: number }
type CellMove = 'up' | 'down' | 'left' | 'right'
	| 'rowStart' | 'rowEnd' | 'columnStart' | 'columnEnd' | 'first' | 'last';
```

`rowStart`/`rowEnd` go to the ends of the **row** (Home, End), `columnStart`/`columnEnd` to the ends of
the **column** (Ctrl+Up, Ctrl+Down), `first`/`last` to the corners (Ctrl+Home, Ctrl+End). The engine
only names the moves; mapping keys to them is core's job.

### `resolveCellMove(from, move, size, step = 1)`

```ts
function resolveCellMove(from: CellIndex, move: CellMove, size: CellGridSize, step?: number): CellIndex | null
```

How it works:

1. An empty grid (`rows === 0` or `columns === 0`) gives `null`.
2. `from` is first clamped into the grid (`clamp(value, max)` is `min(max(value, 0), max)`), so a stale
   focus after rows were removed still resolves to a real neighbour.
3. A `switch` over the move computes the new cell. `up`/`down` shift by `step` (a page of rows for
   PageUp/PageDown), `left`/`right` by one; each result is clamped again.

Invariants: moves **stop at the edge** and never wrap (no jump from the end of a row to the next row).
The other axis is preserved for vertical and horizontal moves, and reset only by the "end" moves.

Where it is used: `use-range-selection.ts` in core (extending a range with Shift+arrow) and
`grid-move.ts` here (which feeds it a flattened grid). Note that `use-cell-focus.ts` does not call
it (verified by grep).

---

## `cell-range.ts`

Ranges are stored as two corners and turned into index rectangles on demand.

### `RangeEdge`, `CellRange`, `RangeBounds`

- `RangeEdge = CellAddress | CellPosition`: a corner can follow its row by key or stay in its screen
  place by index. An index past the last row stands on the last row (this is applied in
  `getRangeBounds` by clipping).
- `CellRange { anchor, focus }`: where selection started and the corner being dragged. They are not
  sorted, so a range can run in any direction and the direction is kept for the UI.
- `RangeBounds { rowStart, rowEnd, columnStart, columnEnd }`: **half-open** intervals
  (`end` excluded) in indexes of a `CellGrid`. Half-open makes width `end - start`, makes an empty
  rectangle representable and makes adjacent rectangles share no cells.

### `getEdgeRow(edge, getRowIndex)`

Row index of a corner: `getRowIndex(edge.key)` for an address, `edge.index` for a position. `-1` means
the row key is gone. Used by `getRangeBounds` and `use-cell-ranges.ts`.

### `getRangeBounds(range, columns, rowCount, getRowIndex = () => -1)`

```ts
function getRangeBounds(range: CellRange, columns: readonly string[], rowCount: number,
	getRowIndex?: (key: string) => number): RangeBounds | null
```

Turns a range into a normalised rectangle.

1. Find the column index of both corners in `columns` (display order); `-1` if hidden.
2. Find both row indexes with `getEdgeRow`.
3. `top = max(min(first, second), 0)`, `bottom = min(max(first, second), rowCount - 1)`: order the
   corners and clip to the existing rows.
4. Return `null` if any column is `-1`, any row is `-1`, or `top > bottom` (the range lies wholly past
   the end).
5. Otherwise `rowEnd = bottom + 1`, `columnEnd = max(anchor, focus) + 1`.

Edge cases worth knowing:

- Clipping is done *before* the `-1` check, and `-1` is tested on `first`/`second` themselves, so a
  missing key is never hidden by the `max(…, 0)` clamp.
- The default `getRowIndex` always says "gone", so a range with only index corners works without
  passing a lookup, and one with key corners needs it.
- `null` means "this range does not exist in the current grid" (a hidden column, a deleted row). The
  caller keeps the `CellRange`, so it can come back if the column is shown again.

Used by `use-cell-ranges.ts` (`getBounds`). Root export.

### `isSameRangeBounds(a, b)`, `isInRangeBounds(bounds, row, column)`, `containsRangeBounds(outer, inner)`

Plain comparisons over the four numbers; `isInRangeBounds` is a point-in-rectangle test with the
half-open rule (`row < rowEnd`), `containsRangeBounds` is rectangle-in-rectangle (every cell of
`inner` is in `outer`). `isSameRangeBounds` is used by `use-cell-ranges.ts` (to keep the previous
reference when bounds did not change) and core's `use-grid-fill.ts`; `containsRangeBounds` by
`use-cell-ranges.ts` (drop ranges that a new one swallows). `isInRangeBounds` has no caller in the
packages other than tests and the public API (checked by grep in `engine/src`, `core/src` and docs
demos); it exists for custom markup that decides per cell whether it is selected.

### `subtractRangeBounds(bounds, cut)`

```ts
function subtractRangeBounds(bounds: RangeBounds, cut: RangeBounds): RangeBounds[]
```

Problem: Ctrl+click on a cell that is already inside a selected range should *deselect* it, which
means cutting a rectangle out of another and keeping the rest as rectangles.

Steps:

1. Intersect: `rowStart = max(starts)`, `rowEnd = min(ends)`, same for columns.
2. If the intersection is empty (`start >= end` on either axis), return `[bounds]`: they do not meet.
3. Otherwise emit up to four pieces in this order:
   1. rows above the cut, **full width** of `bounds`;
   2. cells left of the cut, only in the rows of the intersection;
   3. cells right of the cut, only in the rows of the intersection;
   4. rows below the cut, full width.
4. A cut that covers everything pushes nothing, so the result is `[]`.

Why this split: top and bottom take the full width, left and right take only the middle band, so the
pieces never overlap and together hold exactly the cells outside the cut, each once (the test checks
that cell by cell). Used by `use-cell-ranges.ts`.

### `getRangeCells(bounds, grid)`

```ts
function getRangeCells(bounds: readonly RangeBounds[], grid: CellGrid): CellAddress[]
```

Expands one or more rectangles into addresses, row by row, column by column, using `grid.keys` /
`grid.columns` for names. For several rectangles a `Set` of `key + '\u0000' + column` ids removes
duplicates (overlapping ranges would otherwise write or clear a cell twice). The set is only created
when `bounds.length > 1`, so the common single-range case allocates nothing extra. The `\u0000`
separator cannot occur in practice in a key or column name, so ids do not collide
(`('a','bc')` vs `('ab','c')`). The function assumes the bounds are inside the grid (no clipping).
Used by `use-cell-ranges.ts` and core's `use-grid-editing.ts` (clear, cut).

---

## `csv.ts`

### `toCsv(options)`

```ts
function toCsv<TRow>(options: CsvOptions<TRow>): string
```

`CsvColumn = AnyColumn | RuntimeColumn`: both a declared column and an engine column fit, because the
text comes from `getCellText(column, row)` (`format(value, row)` if the column has one, else
`String(value)`, and `''` for `null`/`undefined`).

Options and defaults:

| Option | Default | Notes |
| --- | --- | --- |
| `columns`, `rows` | required | `columns` in display order, usually shown ones from `scope.columns` |
| `includeService` | `false` | service columns are filtered out by `kind !== 'service'` |
| `delimiter` | `','` | `'\t'` for the clipboard |
| `headers` | `true` | `true`: `column.label ?? column.name`; a function gives your own text; `false`: none |
| `newline` | `'\r\n'` | RFC 4180 |
| `escapeFormulas` | `true` | set `false` for text that goes back into a grid |

Steps: filter service columns, optionally push a header line, then one line per row, each field
passed through `escapeField`, join lines with `newline`.

`escapeField(text, delimiter, escapeFormulas)`, two stages:

1. **Formula guard.** If enabled and the text starts with one of `= + - @ \t \r` (`FORMULA_START`) and
   is **not** a number (`NUMBER = /^[+-]?[\d\s.,]+%?$/`), prefix `'`. This is the CSV-injection
   defence: a spreadsheet would execute `=HYPERLINK(...)`. Numbers, negative ones included, are left
   alone, otherwise every `-5` would turn into `'-5`. The number pattern is deliberately loose
   (digits, spaces, dots, commas, optional `%`).
2. **Quoting.** If the text contains the delimiter, a quote, `\r` or `\n`, wrap it in `"` and double
   inner quotes. The delimiter is tested with `includes`, so multi-character delimiters work.
   The formula `'` is added before quoting, so it ends up inside the quotes.

The last-line rule: if the final line is exactly `''` (a single empty field, for example a
one-column export whose last row is empty), `join` would lose the row, because `a\r\nb\r\n` and
`a\r\nb` read the same. So a trailing `newline` is appended to keep it as a row. An empty field is not
quoted. `parseDelimited` is the matching reader (see `paste.ts`), and the paste tests check the
round trip.

Not done here, by design (the JSDoc says so): the file, the `Blob` and the BOM are up to the caller.

Used by `use-cell-ranges.ts` (text of the selection, for copy), core's `use-clipboard.ts`, and several
docs demos (`downloadCsv(toCsv(...))`). Root export.

---

## `fill.ts`

The spreadsheet fill handle: drag the small square of a selection to continue its values.

### `FillOptions`

`series?: boolean`, default `true`. With it, numbers continue as a linear series (`1, 2` goes on
`3, 4`); without it they repeat. A lone number and non-numbers repeat either way.

### `getFillTarget(source, row, column)`

```ts
function getFillTarget(source: RangeBounds, row: number, column: number): RangeBounds
```

Given the source rectangle and the cell under the pointer, give the rectangle the fill would cover.

1. `getDistance(index, start, end)` measures how far the pointer cell is outside the source on one
   axis: `start - index` before it, `index - end + 1` after it (so the first cell past the end has
   distance 1), `0` inside.
2. Both zero: return `source` itself (the pointer is inside).
3. Otherwise stretch along the axis with the **larger** distance (`rows >= columns` wins ties, so
   ties go vertical). The other axis keeps the source's range. The stretched axis extends to include
   the pointer cell: `min(start, index)`, `max(end, index + 1)`.

Why "the axis the pointer is farther out on": a fill is always a straight line out of the source, as in
spreadsheets, even when the pointer wanders diagonally. Used by core's `use-grid-fill.ts`.

### `resolveFill(source, target, grid, getValue, options)`

```ts
function resolveFill(source: RangeBounds, target: RangeBounds, grid: CellGrid,
	getValue: (cell: CellPosition) => unknown, options?: FillOptions): CellWrite[]
```

Returns writes only for the cells of `target` outside `source`.

1. **Direction.** `vertical` is true when `target`'s rows differ from `source`'s. Otherwise it is a
   horizontal fill (including `target === source`, which gives no writes).
2. **Lines and axis.** Each *line* is a column (vertical fill) or a row (horizontal), filled
   independently. `along` is the source's extent on the fill axis and the target's `from`/`to`.
   `length = along.end - along.start`; a non-positive length returns no writes.
3. **For each line** read the source values with `getValue` (it receives a `CellPosition`, row index +
   column name), then compute `getTrend(values)` when `series` is on.
4. **For each target position** outside the source (`position >= along.start && < along.end` are
   skipped), `offset = position - along.start`. The value is `trend(offset)` or, without a trend, the
   source value at `((offset % length) + length) % length`. The double modulo makes negative offsets
   (a fill up or left) wrap backwards, so filling up repeats the source in reverse order of
   distance.
5. Writes are `{ key, column, value }` (`CellWrite`, no `expected`).

`getTrend(values)` (private):

- `null` unless there are at least two values and all are finite numbers (`isFiniteNumber` excludes
  `NaN` and `Infinity`). This is why a single number repeats and why one text in a line disables the
  series for that line only.
- Least-squares line: `step = covariance / variance`, `start = meanValue - step * meanIndex`, returned
  as `offset => start + step * offset`. For two points this is exactly the line through them, so
  `1, 2` goes on `3, 4`. For uneven numbers it is a regression, like Excel's trend.
- Exactness: when both `step` and `start` are integers, the raw value is returned (integers of 13+
  digits, such as timestamps and ids, stay exact; the test covers this). Otherwise the result is
  rounded to `SIGNIFICANT_DIGITS = 15` through `toPrecision` and `parseFloat`, which removes
  floating-point noise (`0.1 + 0.2` style) as spreadsheets do.

Used by core's `use-grid-fill.ts`. Root export for both functions.

---

## `grid-move.ts`

A keyboard move across **stacked sections**: header rows (possibly with column groups whose cells
span several columns), pinned rows, the body, a footer. `resolveCellMove` knows only a flat rectangle;
this file adapts the real structure to it. This is the most intricate of the pure files.

### Types

```ts
interface SectionCell  { key: string; span?: number; skip?: boolean }
interface GridSection  { name: string; rows: number; cells: readonly SectionCell[] }
interface GridPosition { section: string; row: number; cell: string }
```

- `SectionCell.span` (default 1): how many columns it covers; a group header covers several.
- `SectionCell.skip`: focus passes over the cell, for example the empty cell of a group row over a
  column that has no group (the header below covers that column).
- `GridSection.rows`: rows in the section; each row of a section has **the same cells**. A section
  with no rows (or no cells) is skipped. Sections should cover the same columns, so a group row fills
  columns without a group with cells of its own.
- `GridPosition`: section name, row inside the section, cell key inside the row. A position, not an
  index, because sections have different cells.

### Helpers (private)

- `countRows(section)`: `0` if the section has no cells, else `max(rows, 0)`. This is what "a section
  without rows or cells is skipped" means.
- `toFlatRow(sections, position)`: the row number counted across all sections from the top. The row
  inside the section is clamped to the section (`min(max(row, 0), rows - 1)`), so a stale row index
  still resolves. `null` for an unknown section or one with no rows.
- `fromFlatRow(sections, flat)`: the inverse; walks sections subtracting their row counts. `null` past
  the end.
- `getStartColumn(cells, index)`: the column number where cell `index` starts, by summing spans.
- `findCellAtColumn(cells, column)`: the cell covering a column number; past the end it returns the
  last cell.
- `alignCell(from, index, to)`: the cell of row `to` that corresponds to the cell `from[index]`.
  First by **key** (`to.find(cell.key === key)`), then, if `to` has no such key, by **column
  position** (`findCellAtColumn(to, getStartColumn(from, index))`). That is how a column cell and the
  group cell over it lead to each other: moving up from a column with no matching key lands on the
  group whose span covers it, and moving down from a group lands on the first column of its span.
- `findInRow(cells, from, backward)`: scan from index `from` in one direction for the first cell that
  does not `skip`; `null` if none.
- `findInColumn(sections, flat, backward, pick)`: from flat row `flat`, move one row at a time
  towards the start or end, and return the first row where `pick(cells)` finds a cell, as a
  `GridPosition`; `null` when the grid ends first.
- `skipCell(cell)`: the cell, or `null` if it skips.
- `BACKWARD_MOVES` (`left`, `rowEnd`, `up`, `columnEnd`, `last`) says which moves go towards the
  start. `ROW_MOVES` (`left`, `right`, `rowStart`, `rowEnd`) are moves that stay in the row.

### `resolveGridMove(sections, from, move, step = 1)`

```ts
function resolveGridMove(sections: readonly GridSection[], from: GridPosition,
	move: CellMove, step?: number): GridPosition | null
```

Steps:

1. **Locate.** `flat = toFlatRow(sections, from)`; `origin = fromFlatRow(sections, flat)`. Either
   missing: `null` (unknown section, empty grid).
2. **Column index.** The index of `from.cell` in the origin section's cells; an unknown key becomes
   index `0` (`Math.max(findIndex, 0)`), so it starts from the first cell of its row.
3. **Delegate.** Call `resolveCellMove` on the flattened grid: `rows` = total across sections,
   `columns` = the number of cells in the **origin** row. This gives the target flat row and a
   column *index in the origin row*. Rows are counted across sections, so `up` from the first body
   row lands in the header and `down` from the last row in the footer; a page `step` runs across
   sections and stops at the last row.
4. **Choose the cell** in the target row:
   - row moves (`left/right/rowStart/rowEnd`): `cells[next.column]` of the same row, so a move along
     a row stays inside its section (a group row moves by whole groups, since cells are groups);
   - `first`/`last`: the first or last cell of the target row;
   - every other move: `alignCell(cells, index, targetCells)`.
5. If the chosen cell does not `skip`, return it.
6. **Skipped target.** `stay` is the origin position (returned when nothing better exists). Then:
   - a row move scans along the row with `findInRow`, in the move's direction, from the landed
     index; if nothing takes focus it stays;
   - `first`/`last`/`columnStart`/`columnEnd` ("a jump to an edge") search from the target row **back
     into the grid** (`findInColumn` with direction `BACKWARD_MOVES.has(move)`), so the jump to the
     top of a column lands on the first row whose cell takes focus, below skipped ones; failing
     that, stay;
   - `up`/`down` ("a move of a row or a page") search first **in their direction** (`upward =
     next.row < flat`), so a move up from a column without a group goes on to a group a level
     higher; only if nothing further takes focus does it try the opposite direction, and then stay.

`pick` differs by move: for `first`/`last` it is `findInRow` from the edge of the row; for the others
it is `skipCell(alignCell(...))`, the same-column cell if it takes focus.

Why it is shaped like this: the core question ("which cell next") is a rectangle problem, and the
irregular parts (different cells per section, spans, skipped cells) are all repaired *after* the
rectangle move, in `alignCell` and the skip search. That keeps `resolveCellMove` simple and the keyboard
rules identical in both models.

The tests in `tests/cells/grid-move.spec.ts` cover each of these cases (group rows, skip, page moves,
unknown cell and section).

Used by `use-grid-focus.ts` (engine) and core's `use-cell-navigation.ts`, which passes
`step = getPageStep(...)` for PageUp/PageDown. Root export.

---

## `paste.ts`

Two independent functions: reading text, and laying a block of text over a selection.

### `DelimitedOptions`

`delimiter?: string`, not empty, `','` by default. A spreadsheet puts tabs on the clipboard, so
clipboard code passes `'\t'` (core's `use-grid-editing.ts` does).

### `parseDelimited(text, options)`

```ts
function parseDelimited(text: string, options?: DelimitedOptions): string[][]
```

A hand-written single-pass RFC 4180 reader. It is not a regex or `split`, because quoted fields can
contain delimiters and line breaks.

Behaviour:

- Lines break at `\r\n`, `\n` or `\r`.
- A field in double quotes may hold delimiters and line breaks; `""` stands for one `"`.
- A byte order mark (`﻿`) at the start is skipped.
- A line break at the very end **ends the last row** instead of starting an empty one; but a delimiter
  at the very end leaves an empty last field (`a,` is `['a', '']`).
- An empty text gives `[]` (no rows).
- An empty `delimiter` throws a `TypeError` with the package prefix: with an empty delimiter nothing
  would split and the loop could never move on. This is a programmer error validated at the entry,
  as `code-quality.md` asks.

Algorithm: an index walks the text. Each turn reads one field: if it begins with `"`, try
`readQuoted`; otherwise (or if that fails) `readPlain`. Push the field. Then look at what ended it: end
of text (push the row, return), a delimiter (skip it and read the next field), or a line break (skip
`\r\n` as one, push the row, start a new one; if the text ends there, return).

- `isFieldEnd(text, index, delimiter)`: true at end of text, `\r`, `\n`, or where the delimiter starts.
- `readQuoted(text, start, delimiter)`: loops with `indexOf('"')`; adds the text between quotes; a
  doubled quote adds `"` and continues; a single quote must be followed by a field end, otherwise
  the field is **not** quoted. Returns `[value, endIndex]` or `null`.
- `readPlain`: advances to the next field end.

The permissive rule is the important design decision: when quotes do not close right before a
delimiter, line break or the end (`"Hello" world`, a lone `"`, a quote that never closes), the field
is read as **plain text, quotes included**, and the rest parses on. A spreadsheet pastes such text
as it is, and a strict parser would throw away or merge the rest of the clipboard. Quotes inside a
plain field are plain text too. The paste tests list the Excel and Google Sheets cases (Excel ends
each row with `\r\n` including the last; Sheets omits the last break; a cell with quotes but no line
break comes unquoted), and check that `toCsv` output reads back, and that a large paste is read in
one pass (no recursion, no per-character array growth).

Used by core's `use-grid-editing.ts` (with `'\t'`). Root export.

### `PasteResult`, `resolvePaste(target, matrix, grid)`

```ts
interface PasteResult { writes: CellTextWrite[]; bounds: RangeBounds | null }
function resolvePaste(target: RangeBounds, matrix: readonly (readonly string[])[], grid: CellGrid): PasteResult
```

Where do pasted rows of text go, the way a spreadsheet lays them.

1. `height = matrix.length`; `width` is the length of the **longest** row (found by a loop, because
   `Math.max(...rows.map(...))` would overflow the call arguments on a paste of many rows). If either
   is `0`, return no writes and `bounds: null`.
2. `targetHeight`/`targetWidth` are the selection's size. `tiles` is true when the selection is a
   multiple of the block in **both** directions (`% height === 0 && % width === 0`).
3. The paste area goes from the selection's top-left corner. With `tiles` it covers the whole
   selection (one value pasted over a column fills the column); without it, only one block
   (`height` x `width`), possibly bigger than the selection, since a single selected cell and a
   block larger than the selection both paste whole. Both ends are clipped to the grid
   (`grid.keys.length`, `grid.columns.length`).
4. For each cell of the area, the text is `matrix[(row - rowStart) % height][(column - columnStart) %
   width] ?? ''`. A row shorter than the block pastes empty text in the rest, which overwrites those
   cells (as spreadsheets do).
5. If nothing falls inside the grid (the corner is past the last row/column), `writes` is empty and
   `bounds` is `null`. Otherwise `bounds` is the pasted area, so the caller can select it after.

A selection that is a multiple in one direction only takes the block once (the `tiles` check needs
both), by design and by test.

The writes are `CellTextWrite` (text, not values): they go through each column's `parse` when
`useCellEditing` applies them. The function never reads the data and never checks `canEditCell`;
that is the composable's job.

Used by core's `use-grid-editing.ts` (checked). Root export.

---

## How the files fit together

```
text on clipboard --parseDelimited--> matrix --resolvePaste(target, grid)--> CellTextWrite[] + bounds
selection corners --getRangeBounds--> RangeBounds --getRangeCells--> CellAddress[]   (copy, clear)
RangeBounds --toCsv (via composable)--> text
RangeBounds + pointer --getFillTarget--> RangeBounds --resolveFill--> CellWrite[]
key press --resolveGridMove (uses resolveCellMove)--> GridPosition
CellWrite / CellTextWrite --useCellEditing (canEditCell, validateCell, isSameCellValue, applyCellEdits, replaceRows)--> rows
```

Every function returns new data or the previous reference when nothing changed (`replaceRows`,
`getFillTarget` returning `source`, `subtractRangeBounds` returning `[bounds]`); none mutates its
inputs, so the composables can compare results by reference.
