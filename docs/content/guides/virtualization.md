---
title: Virtualization
description: Render only the rows and columns in view, so a grid of a hundred thousand rows scrolls as smoothly as one of twenty.
---

# Virtualization

<Description>
A grid only needs the rows and columns people can see. With virtualization it renders those, plus a
few around them, and swaps them as the grid scrolls: a hundred thousand rows cost about as much as
thirty.
</Description>

<Demo name="virtualization" />

The demo holds 100,000 sensors by 32 columns, over three million cells. Scroll it, jump to a row,
or click a cell and hold <kbd>PageDown</kbd>: the stat in the toolbar shows how few cells are in the
DOM at any time.

## Turning it on

Pass `virtual: true`, and the grid windows both rows and columns:

```ts
const grid = useDataGrid({
	columns,
	rows: sensors,
	rowKey: 'id',
	rowHeight: 36,
	virtual: true,
});
```

Nothing changes in the markup: `GridBody` already renders the rows the window gives it, and
`GridCells` the columns. The body is as tall as all the rows together, so the scrollbar is right from
the first frame, and each row is placed at its offset.

The grid needs a height to have a window at all: `GridRoot` is the scroll container, and a grid
that grows with its rows never scrolls itself.

## Fine-tuning the windows

`virtual` also takes an object. Leave out what you do not need:

<PropsTable
	label="Option"
	:data="[
		{ name: 'rows', type: 'boolean', default: 'true', description: 'Window the rows.' },
		{ name: 'columns', type: 'boolean', default: 'true', description: 'Window the columns. Worth it from a few dozen columns on.' },
		{ name: 'overscan', type: 'number', default: '6', description: 'Rows rendered past each edge of the viewport, so a fast scroll does not show blank space.' },
		{ name: 'bufferPx', type: 'number', default: '200', description: 'Width rendered past each edge of the viewport, px. In pixels rather than columns, since columns differ in width.' },
		{ name: 'ssrRows', type: 'number', default: '24', description: 'Rows rendered before the grid is mounted: on the server, and in the frame of hydration.' },
	]"
/>

```ts
virtual: { columns: false, overscan: 10 },
```

`virtual` can be a `ref` too, to turn windowing on only past a number of rows.

## Row heights

The window finds rows by their heights, so it has to know them before they render. `rowHeight` gives
them in one of three ways:

- a number, the same for every row, the fastest case: an offset is a multiplication;
- a function of the row and its index, for rows whose height you know from their data, such as a
  group row that is taller than the rest;
- a number or a function as an estimate, with `measureRows: true`: each row is measured once it
  renders, and the window corrects its offsets. Use it for rows whose height depends on their
  content, such as text that wraps.

```ts
rowHeight: (row, index) => (row.group ? 48 : 36),
```

`rowHeight` has no default on purpose: a made-up height would shift every scroll position against
the real rows.

## Rows added above

When rows come in or go above the ones in view, and the rows in view kept their order, as when a page
is loaded at the top, the grid scrolls by as much as the rows above them grew: the rows people read
stay where they were on the screen. A sort or a filter that changes the rows in view leaves the
scroll alone. A row above the view that changes height, with `measureRows`, is followed the same way.

At the very top rows that come in show there, as new entries of a feed do, unless something holds the
rows in place: `useGridEdge` at the top does, or `grid.holdAnchorAtTop()`. With markup of your own,
give the root `overflow-anchor: none`, as the structural styles do, so that the browser does not
move the rows a second time. See [Pages and infinite scrolling](/guides/paging).

## Scrolling from code

A row or a column outside the window is not in the DOM, so `scrollIntoView` cannot reach it. Ask the
grid instead:

```ts
grid.scope.scrollToRow(49_999, 'center');
grid.scope.scrollToColumn('day17', 'center');
```

Both take `'start'`, `'center'`, `'end'` or `'auto'`, which scrolls only as far as needed. Both keep
clear of what sticks: the header, the footer and pinned columns never cover the row or the column you
scrolled to.

## What stays rendered

Some rows and columns must stay in the DOM wherever the grid scrolls: the cell that has focus, a row
being dragged, a column being resized. The parts of the grid take care of their own, so a focused
cell scrolled far away keeps its focus. For your own needs:

- `keepRows` and `keepColumns` options keep rows, by index, and columns, by name, rendered;
- `grid.scope.keepRendered({ rows, columns })` does the same from a component, until the function it
  returns is called or the component unmounts.

```ts
const release = grid.scope.keepRendered({ rows: () => [editedIndex.value] });
```

A column marked as a [row header](/guides/columns#service-columns-and-row-headers) is always rendered,
so a row keeps its accessible name while it is scrolled sideways.

## Rendering on a server

Before the scroll container exists there is no viewport to measure. The grid then renders the first
`ssrRows` rows, on the server and in the first frame in the browser alike, so hydration matches, and
windows properly from the next frame on.

## Accessibility

- `aria-rowcount` and `aria-colcount` give the size of the whole grid, and every rendered row and
  cell carries its `aria-rowindex` and `aria-colindex`. A screen reader says "row 50,000 of 100,000"
  although only thirty rows exist in the DOM.
- With the `navigation` feature, as in the demo, the arrow keys, <kbd>PageUp</kbd>,
  <kbd>PageDown</kbd>, <kbd>Ctrl+Home</kbd> and <kbd>Ctrl+End</kbd> move through all of the rows, not
  only the rendered ones: the grid scrolls the target into view, renders it and focuses it.
- The focused cell stays rendered while it is out of view, so focus is never lost to the window.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['PageUp', 'PageDown'], description: 'Moves focus by as many rows as fit between the header and the footer.' },
		{ keys: ['Ctrl+Home', 'Ctrl+End'], description: 'Moves focus to the first or the last cell of the grid, rendering it first.' },
		{ keys: ['Ctrl+↑', 'Ctrl+↓'], description: 'Moves focus to the first or the last row of the column.' },
	]"
/>

## See also

- [Performance](/overview/performance): why a large grid stays cheap.
- [A million cells](/examples/big-data): a larger grid with sorting and live stats.
- [Keyboard navigation](/guides/keyboard-navigation): the keys of the grid.
