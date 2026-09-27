---
title: The core
description: What @vue-stack/table re-exports from @vue-stack/table-core — the engine, the column state, the row and cell models — and when to use them directly.
---

# The core

<Description>
Under the parts and composables of `@vue-stack/table` lies `@vue-stack/table-core`: the engine, the
column state, and models of rows and cells with no markup at all. The table re-exports its stable
API, so everything on this page is imported from `@vue-stack/table` too.
</Description>

## When to use it

`useDataTable` assembles the core for you, and most tables never touch it directly. Reach for it
when you need a piece on its own:

- a model without a table, such as `useRowSelection` over a list of cards, or `toCsv` in an export;
- a row pipeline of your own order, such as filtering between grouping and sorting;
- live data, with `useRowStream` and `useCellChanges`;
- a table on markup that `useDataTable` does not fit, with `useTableEngine` and your own markup.

The core is headless in the strict sense: no components, no templates, no roles. It gives numbers,
states and CSS variables; the markup, the keys and the ARIA are the table's.

## The engine

`useTableEngine` turns columns and rows into what markup renders from: the shown and rendered
columns, the row window, and the geometry of every cell as CSS variables.

```ts
import { createTableScopeContext, useTableEngine, useTableGeometry } from '@vue-stack/table';

const root = shallowRef<HTMLElement | null>(null);

const engine = useTableEngine({
	columns,
	rows,
	root,
	rowKey: 'id',
	rowHeight: 36,
	virtual: true,
});

createTableScopeContext(engine.scope);
useTableGeometry(root, engine.layers);
```

<ReturnsTable
	:data="[
		{ name: 'scope', type: 'TableScope', description: 'Everything the markup renders from, and what changes the layout.' },
		{ name: 'state', type: 'TableColumnsState', description: 'The column state: the one passed in, or its own.' },
		{ name: 'items', type: 'ComputedRef<VirtualItem[]>', description: 'The row window: `{ key, index, start, end, size }` of each row to render.' },
		{ name: 'totalSize', type: 'ComputedRef<number>', description: 'The height of all rows, px.' },
		{ name: 'measureElement', type: '(element) => void', description: 'Measures a row, with `measureRows`.' },
		{ name: 'layers', type: 'ComputedRef<GeometryLayer[]>', description: 'The geometry to write with `useTableGeometry`: widths, grow factors and pin offsets as CSS variables.' },
		{ name: 'windowed', type: 'ComputedRef<boolean>', description: 'Whether the column window leaves columns out.' },
		{ name: 'contentWidth', type: 'ComputedRef<number>', description: 'The width of the shown columns, px.' },
	]"
/>

### TableScope

The scope is the one object the markup reads. The main members:

| Group | Members |
| --- | --- |
| Rows | `rows`, `rowKeys`, `getRowKey`, `getRowIndex`, `rowRange`, `visibleRange`, `getRowOffset`, `getPageStep` |
| Columns | `columns`, `renderedColumns`, `orderedColumns`, `headerGroups`, `offsets`, `getColumn`, `getWidth`, `getPin`, `isColumnHidden`, `getColumnSpan` |
| Layout | `toggleColumn`, `pinColumn`, `moveColumnTo`, `moveColumnBefore`, `moveColumnBy`, `canMoveColumnTo`, `batch` |
| Sort | `sort`, `multiSort`, `getSortDirection`, `getSortIndex`, `toggleSort` |
| Groups | `isGroupCollapsed`, `toggleGroup` |
| Widths | `resize`, `commitResize`, `previewWidths`, `setWidths`, `fitColumns` |
| Scrolling | `scrollToRow`, `scrollToColumn`, `keepRendered` |

A `RenderedColumn` carries `cellProps` and `headerProps`: one frozen object per column with its
`data-tc-column`, pin, alignment and geometry, shared by every row. That sharing is what lets a
thousand cells of a column cost Vue one comparison each.

## The column state

`useTableColumnsState` holds the order, widths, pins, hidden columns, collapsed groups and the sort,
and can keep them between visits. Create one yourself to share it between two tables, or to own it
in a store:

```ts
import { localStorageStore, useTableColumnsState } from '@vue-stack/table';

const state = useTableColumnsState({
	sort: [{ name: 'created', direction: 'desc' }],
	multiSort: true,
	persist: localStorageStore('orders'),
});

const table = useDataTable({ columns, rows, rowKey: 'id', rowHeight: 40, state });

state.reset();
```

### Keeping any state

`usePersistedState(state, store, { parse, serialize })` keeps any ref in a store: it restores it once
after mount, writes every change, and follows writes from other tabs. The stores are
`localStorageStore(key)`, `sessionStorageStore(key)` and `memoryStore()`; a store of your own is an
object with `read`, `write` and, to follow other writers, `subscribe`.

```ts
import { localStorageStore, usePersistedState } from '@vue-stack/table';

const density = ref<'comfortable' | 'compact'>('comfortable');

usePersistedState(density, localStorageStore('density'), {
	parse: stored => (stored === 'compact' || stored === 'comfortable' ? stored : undefined),
});
```

## Rows

Each step of the row pipeline is a composable of its own. The features of `useDataTable` are built on
them, in this order.

| Composable | Does |
| --- | --- |
| `useGroupedRows` | Groups rows by levels into group rows with children and aggregates. |
| `useSortedRows` | Sorts by a sort model; with `delta`, re-sorts only rows that arrived as new objects. |
| `useRowTree` | A tree from `parentKey` or `childrenField`, flattened into the shown rows, with a node per row. |
| `useRowSelection` | Selection by key, with ranges, `single` mode, `canSelect`, and the "all selected" mode. |
| `useRowStream` | Rows updated by a stream, applied in one batch per frame. |

And the pure functions under them: `sortRows`, `groupRows`, `aggregateColumn`, `aggregateRows`,
`compareValues`, `isEmptyValue`, `moveRow`, `createRowKeyResolver`, `getRowChildren`.

### Streaming rows

`useRowStream` collects changes and applies them once per animation frame, or per `wait`. A row that
no change touched stays the same object, which keeps its row from rendering and lets `delta` sorting
re-sort only what moved.

```ts
import { useRowStream } from '@vue-stack/table';

const stream = useRowStream({ rows: initial, rowKey: 'id' });

socket.on('quote', quote => stream.patch(quote.id, { price: quote.price }));
socket.on('listing', row => stream.apply({ add: [row] }));
socket.on('delisting', id => stream.apply({ remove: [id] }));

const table = useDataTable({
	columns,
	rows: stream.rows,
	rowKey: 'id',
	rowHeight: 36,
	features: { sorting: sorting({ delta: true }) },
});
```

### Moving rows

`moveRow(rows, move, options)` returns the rows with one row taken out and put at `index` among the
children of `parent`: exactly what a drop of `useTableRowDrag` gives. Every other row keeps its
reference.

## Cells

| Composable | Does |
| --- | --- |
| `useGridFocus` | Where focus is in a grid of sections, a body cell held by row key, kept rendered and scrolled to. |
| `useCellFocus` | The same for a grid of body cells only, addressed by row key and column. |
| `useCellRanges` | Cell ranges: corners, bounds, rectangles to draw, `aria-selected` per row, the text for the clipboard. |
| `useCellEditing` | Rights, parsing, validation, immutable writes with a source, `onBeforeCommit`. |
| `useChangeHistory` | Undo and redo of the commits of an editing. |
| `useCellChanges` | Recent changes of cell values and their direction, for a flash or an arrow. |

And the pure functions: `toCsv`, `parseDelimited`, `resolvePaste`, `resolveFill`, `getFillTarget`,
`resolveGridMove`, `resolveCellMove`, `getRangeBounds`, `getRangeCells`, `isInRangeBounds`,
`isSameRangeBounds`, `canEditCell`, `getCellColumns`, `isDataColumn`, `isCellAddress`.

### Flashing changed cells

`useCellChanges` compares a row that arrives as a new object with the one before, column by column,
and keeps each change for a moment with its direction. It is reactive per row: a change wakes only
the row it is in.

```ts
import { useCellChanges, useDataTable } from '@vue-stack/table';

const columns = defineColumns({
	price: column(stock => stock.price, {
		label: 'Price',
		cellClass: ({ key }) => `flash-${changes.getChange(key, 'price')?.direction ?? 'none'}`,
	}),
});

const table = useDataTable({ columns, rows: stream.rows, rowKey: 'id', rowHeight: 36 });

const changes = useCellChanges(table.scope, { duration: 900, columns: ['price'] });
```

The cells read `changes` when they render, after setup, so it may be declared after the columns.

### Text in and out

```ts
import { parseDelimited, toCsv } from '@vue-stack/table';

const shown = table.scope.columns.value.flatMap(item => (item.column ? [item.column] : []));
const csv = toCsv({ columns: shown, rows: table.rows.value });
const cells = parseDelimited(clipboardText, { delimiter: '\t' });
```

`toCsv` goes through each column's `format`, leaves service columns out and guards formulas;
`parseDelimited` reads quoted fields, line breaks inside them and a byte order mark as a spreadsheet
writes them.

## Geometry

The core lays a row out as a flex line: a width and a grow factor per column, `position: sticky` and
an offset for pinned ones, all as CSS variables written by `useTableGeometry`. The helpers name them,
for CSS or layers of your own:

| Helper | Gives |
| --- | --- |
| `getWidthVariable(name)` | the variable of a column's width |
| `getGrowVariable(name)` | the variable of its grow factor |
| `getPinVariable(side, name)` | the variable of its pin offset |
| `getInsetVariable(side)` | the variable of an inset's width |
| `getColumnCellSelector(name)` | the cells of a column, by `data-tc-column` |
| `getColumnSelector(name)` | the cells and the group cells over them |
| `compileCellStyle`, `compileGroupStyle`, `getFlexSpacerStyle`, `FLEX_CELL_STYLES` | the default styles, for a `cellStyles` of your own |

A resize writes widths through these variables once per frame, so a drag reaches the DOM without a
render of any row.

## Internals

`@vue-stack/table-core/internals` exposes the building blocks `useTableEngine` is made of: column
reconciliation, the row and column windows, the stream queue, incremental sorting, `stableComputed`.
It is for building an engine of your own, and it is **not covered by semver**: its signatures change
with the engine, in minor releases too. Import it from the core package, added to your dependencies:

```ts
import { reconcileColumns, useVirtualRows } from '@vue-stack/table-core/internals';
```

Nothing of the stable API is repeated there, and nothing there is re-exported by `@vue-stack/table`.

## Animation engines

`@vue-stack/table` also re-exports `@vue-stack/flip`, the engines its motion plays with:
`webAnimations`, `defineMotionEngine`, `captureLayout`, `playMotion`, `slide`, `fadeIn`, `fadeOut`.
The [Animation](/guides/animation) guide and [useTableMotion](/composables/use-table-motion) show them
at work, with GSAP and Motion too.

## Accessibility

The core sets no role and no `aria-*` attribute: it computes the numbers they are made of. Row
indexes that stay right under the row window, the place of a row among its siblings for
`aria-posinset`, the rows that fit a page for PageDown, the cell focus that survives sorting — all
of these live here, so a table of any markup can say the right thing. The table's prop-getters turn
them into attributes; markup of your own on the engine alone must do the same.

## See also

- [useDataTable](/composables/use-data-table): the core, assembled.
- [Live data](/guides/live-data): streaming rows and flashing cells.
- [Your own markup](/guides/custom-markup): rendering from the scope.
