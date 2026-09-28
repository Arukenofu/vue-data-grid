---
title: Performance
description: Why a grid built from the parts stays fast, and the few habits that keep it that way.
---

# Performance

<Description>
A grid's cost grows with rows times columns. The library keeps it proportional to two much smaller
numbers instead: what is in view, and what changed. This page explains how, and the few habits on
your side that keep it so.
</Description>

<Demo name="render-count" />

The buttons change the data the way an app would: a new price for one stock, for ten, or for all of
them, a sort, a selection. Under the grid, each update shows how long it took, from the change to
the rendered DOM, and how many rows it rendered. The cells whose values changed flash, and every
row counts its own renders in the last column:

- a new price for one stock renders one row, and flashes its price and volume;
- selecting five rows renders those five rows;
- resizing a column, by dragging a header edge, renders none: widths are CSS variables;
- a sort renders the rows that moved, since their place changed.

The figures come from `performance.now()` around the change and Vue's `nextTick`, in your browser, on
this page.

## Render only what is in view

With `virtual: true` the grid renders a window of rows and a window of columns around the viewport,
plus a few for smooth scrolling. A hundred thousand rows by fifty columns renders about as much as
thirty rows by ten.

```ts
const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 36,
	virtual: true,
});
```

Rows are positioned by their heights, not by the layout of the ones above, so jumping to row 80,000
costs nothing more than jumping to row 80. With a fixed `rowHeight` every offset is a
multiplication; with `measureRows` the real heights replace the estimate as rows render. See
[Virtualization](/guides/virtualization).

## One component per row, not per cell

`GridCells` renders all the cells of a row as plain elements, in one render function. A row of
twenty columns is one component, not twenty-one. Measured on the body of a grid, a component per
cell costs about twice as much to mount and to update; that is why there is no `GridCell` part.

The props of every cell of a column are **one frozen object**, shared by all the rows. When a row
renders again, Vue compares each cell's props by reference and stops at once: the object is the same.

## The row memo

`GridBody` gives each row an object that stays the same while the row's data, place and tree node
hold. `GridRow` renders again only when that object changes, so:

- scrolling mounts the rows that come into view and leaves the others alone;
- a new array of rows with one changed object renders that one row;
- selecting a row renders that row: `isSelected` is reactive per key, so the others are not asked;
- focus and cell ranges are reactive per row too, and `aria-selected` of cells in a range is written
  to the DOM directly, so a range dragged across a hundred rows renders none of them.

## Geometry without renders

Widths, pins and the offsets of pinned columns are not in the render at all. The core writes them as
CSS variables, `--dg-width-*` and `--dg-pin-*`: the ones that rarely change on the grid element,
and the ones a gesture changes on exactly the cells that read them. Dragging a resize handle writes
the width of one column once per frame, and the browser lays the cells out again without Vue doing
anything. The same path animates widths under [`useGridMotion`](/composables/use-grid-motion).

## Streams of changes

For data that changes all the time, such as prices, `useRowStream` collects changes and applies them
once per animation frame. Rows no change touched stay the same objects, and a `sorting` feature with
`delta: true` re-sorts only the rows that arrived as new objects. `useCellChanges`, which flashes
changed cells, compares only those rows, too. See [Live data](/guides/live-data).

## Habits that keep it fast

Most of the speed is automatic. These habits make sure nothing undoes it:

### Declare columns once

Columns are compared by reference. Declare them at the top of `<script setup>` or in a module. A
`computed` that rebuilds them builds new functions every time, and every cell of those columns
renders again. In development the grid warns when a column is rebuilt with nothing but new
functions.

When columns must follow state, such as a label in the user's currency, keep the functions outside
the `computed`, so only what really differs changes:

```ts
const readPrice = (stock: Stock) => stock.price;

const columns = computed(() => defineColumns({
	price: column(readPrice, { label: `Price, ${currency.value}` }),
}));
```

### Replace rows, do not mutate them

A row that changes should arrive as a new object, and a row that does not should stay the same one.
`map` with a spread does exactly that:

```ts
rows.value = rows.value.map(row => (row.id === id ? { ...row, status: 'done' } : row));
```

Mutating a row in place leaves its object the same: the grid cannot know it changed.

### Keep keys stable and unique

`rowKey` is how rows are recognized between renders. Use an id from your data, never an index. A
development build warns once when two rows share a key.

### Read per-row state per row

When you render cells yourself, read state by key, such as `selection.isSelected(key)` inside the
row. Reading `selectedKeys` in a template that renders every row makes every row depend on the whole
selection.

## Accessibility

Speed and accessibility do not pull against each other here:

- windowing keeps `aria-rowcount`, `aria-rowindex` and `aria-colindex` about the whole grid, so
  screen readers hear the real size and position;
- the focused row and column stay rendered however far the window moves, so focus is never dropped;
- the live region re-renders alone when it announces, not the grid.

## See also

- [Virtualization](/guides/virtualization)
- [Live data](/guides/live-data)
- [Body](/components/body): the row memo in detail.
