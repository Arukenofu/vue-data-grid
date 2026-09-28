---
title: A million cells
description: Fifty thousand rows by twenty columns, windowed both ways, with pinned columns, sorting and keyboard navigation that stay smooth.
pageClass: site-wide
aside: false
---

# A million cells

<Description>
Fifty thousand rows of device readings by twenty columns: a million cells, of which only the few
hundred in view are in the DOM. Scroll both ways, sort any column, jump to a row, or switch to a
hundred thousand rows and watch the counters below the grid stay small.
</Description>

<Demo name="example-big-data" />

## What it shows

- **A row window and a column window** with `virtual: true`: only the rows and columns in view, plus
  a small margin, are rendered. See [Virtualization](/guides/virtualization).
- **Pinned columns on both sides**: the row number stays at the start and the health badge at the
  end while the metrics scroll between them, and both windows keep them rendered.
- **Sorting a large set** with the `sorting` feature: the "Last sort" counter shows how long a sort
  and the render after it take.
- **Keyboard navigation over rows that are not there**: <kbd>PageDown</kbd>, <kbd>Ctrl</kbd>+<kbd>End</kbd>
  or "Go to row" move focus to a row far outside the window; the grid scrolls to it and renders it
  first. See [Keyboard navigation](/guides/keyboard-navigation).
- **A kit grid**: the toolbar, the counters and `UiDataGrid` are the demo's design system; the
  grid itself is one `useDataGrid` call.

## How it works

### Twenty columns from a list

Fifteen of the columns are metrics that differ only in their label and unit, so they are made from a
list and spread between the named columns. `defineColumn` gives every one of them the same defaults:
sortable, resizable, right-aligned.

```ts
const column = defineColumn<Reading>({ sortable: true, resizable: true, width: 124, align: 'right' });

const metrics = Object.fromEntries(METRICS.map((metric, index) => [
	`metric${index}`,
	column(reading => reading.values[index], {
		label: metric.label,
		format: value => `${value.toFixed(metric.digits)}${metric.unit}`,
	}),
]));

const columns = defineColumns({
	id: column('id', { label: '#', width: 88, pinned: 'start' }),
	time: column('time', { label: 'Time', width: 136, align: 'left' }),
	...metrics,
	health: column('health', { label: 'Health', pinned: 'end' }),
});
```

### Both windows, one option

```ts
const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 36,
	virtual: true,
	features: { sorting: sorting(), navigation: navigation() },
});
```

`virtual: true` turns on both windows. With a fixed `rowHeight`, where a row stands is a
multiplication, so the row window costs the same for ten thousand rows as for a hundred thousand.
Columns differ in width, so the column window works in pixels: it renders what is in view plus
`bufferPx` on each side, and puts spacers in place of the rest, so the row keeps its full width and
the scrollbar its true length.

### Counting what is rendered

The counters read the scope of the grid. `rowRange` is the half-open range of rendered rows, and
`renderedColumns` the columns after the column window, spacers included:

```ts
const { scope } = grid;

const renderedRows = computed(() => scope.rowRange.value.end - scope.rowRange.value.start);
const renderedColumns = computed(() => scope.renderedColumns.value.filter(rendered => rendered.column !== null).length);
```

They change as you scroll, and only the counters render for it: the rows that stay in the window
keep their objects, so Vue skips them.

### Going to a row

"Go to row" asks the navigation to focus a cell. The cell is held rendered while the grid scrolls
to it, then focused, so the screen reader lands on it too:

```ts
function goToRow() {
	const row = Math.min(Math.max(target.value, 1), rows.value.length) - 1;

	void grid.navigation.focusCell({ section: 'body', row, cell: 'id' });
}
```

The arrow buttons only scroll, with `scope.scrollToRow(index, align)`, which knows the sticky header
and footer and leaves the row clear of them.

### Why it stays fast

- A row is one component: `GridCells` renders the cells of a row as plain elements, so a render of a
  row does not create twenty components.
- A cell's props are one frozen object per column, shared by every row, so Vue stops comparing at the
  reference.
- Widths live in CSS variables: dragging a resize handle rewrites one variable per frame and renders
  no row at all.

See [Performance](/overview/performance) for the whole list.

## Accessibility

- `aria-rowcount` and `aria-colcount` give the size of the whole grid, and every rendered row and
  cell carries its `aria-rowindex` and `aria-colindex`. A screen reader says "row 31,204 of 50,001"
  even though only thirty rows exist in the DOM.
- The row number column is the row header, so each cell is announced with the row it belongs to. The
  column window always renders the row header, wherever you scroll sideways.
- Focus is held by row key and column name: a focused cell scrolled out of view stays rendered, and
  sorting keeps focus on the same reading rather than the same position.
- "Go to row" moves focus into the grid, as a keyboard user expects of it; the scroll buttons do
  not move focus.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['↑', '↓', '←', '→'], description: 'Moves one cell; the grid scrolls under pinned columns and the sticky header as needed.' },
		{ keys: ['PageUp', 'PageDown'], description: 'Moves by as many rows as fit in view.' },
		{ keys: ['Home', 'End'], description: 'Moves to the first or the last cell of the row.' },
		{ keys: ['Ctrl+Home', 'Ctrl+End'], description: 'Moves to the first or the last cell of the grid, fifty thousand rows away.' },
		{ keys: ['Enter'], description: 'On a header, sorts by the column.' },
	]"
/>
