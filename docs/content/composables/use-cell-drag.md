---
title: useCellDrag
description: A pointer drag across the body cells of a grid — each cell reported once, the grid scrolling near its edges, past its edges too.
---

# useCellDrag

<Description>
A pointer drag across the body cells of a grid, for gestures of your own. Each cell the pointer
reaches is reported once, the grid scrolls near its edges over the sticky header and pinned
columns, and the drag goes on past the edges of the grid.
</Description>

<Demo name="api-use-cell-drag" />

This gesture is not part of the library: press on a row and drag, and every row between the press
and the pointer is selected. Fifty lines on top of `useCellDrag`, and it scrolls a virtual grid of
three hundred rows as the pointer nears its edge.

## Usage

Start the drag from a press on a cell; the rest follows the pointer on the window until it is
released.

```ts
import { readGridPosition, useCellDrag } from '@vue-data-grid/core';

const drag = useCellDrag(grid, {
	getColumns: () => ['name', 'role', 'team'],
	onCell: cell => paintTo(cell.index, cell.column),
	onEnd: ({ cancelled }) => finish(cancelled),
});

function onPointerdown(event: PointerEvent) {
	const element = event.target instanceof Element ? event.target.closest('[data-dg-column]') : null;
	const position = element ? readGridPosition(element) : null;

	if (position?.section === 'body') {
		event.preventDefault();
		drag.start(event, { index: position.row, column: position.cell });
	}
}
```

The row under the pointer is found by the heights of the rows, and its cell by the element there,
else by the nearest cell of that row. A point past an edge, or over a column the drag does not
reach, gives the nearest cell. `useRangeSelection` and the fill handle are built on it.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'getColumns', type: '() => readonly string[]', required: true, description: 'The columns a drag reaches, in display order. Read when a drag starts.' },
		{ name: 'onCell', type: '(cell: CellPosition) => void', required: true, description: 'The pointer reached another cell, `{ index, column }`, or the rows moved under a still pointer.' },
		{ name: 'onEnd', type: '(end: { cancelled: boolean }) => void', description: 'The drag ended: the pointer went up, or the browser or `cancel` cancelled it.' },
		{ name: 'autoScroll', type: 'AutoScrollOptions | false', description: 'How the grid scrolls near its edges; the sticky header, footer and pinned columns are its margins. `false` turns it off.' },
	]"
/>

The grid it takes is anything with `scope`, `root` and `body`, and `headHeight` and `footHeight`
when it has sticky blocks: the grid of `useDataGrid` fits.

## Returns

<ReturnsTable
	:data="[
		{ name: 'start', type: '(event: PointerEvent, from?: CellPosition) => void', description: 'Starts following the pointer from a press. `from`, the cell of the press, counts as reached and is not reported again.' },
		{ name: 'cancel', type: '() => void', description: 'Ends a drag at once, as cancelled.' },
		{ name: 'dragging', type: 'Readonly<Ref<boolean>>', description: 'Whether a drag is in progress.' },
	]"
/>

## Examples

### Cancelling when rows change

A drag that points at cells by index should stop when the rows under it change, as the fill handle
does:

```ts
watch(grid.scope.rowKeys, () => {
	if (drag.dragging.value) {
		drag.cancel();
	}
});
```

### A calmer scroll

`autoScroll` takes the options of [useAutoScroll](/composables/use-auto-scroll): a slower speed and a
soft start suit a gesture that paints cells one by one.

```ts
useCellDrag(grid, {
	getColumns,
	onCell,
	autoScroll: { speed: 400, smoothing: 120 },
});
```

## Accessibility

A pointer gesture is never the only way: give the same result to the keyboard, as ranges do with
Shift and the arrows, and the fill handle with Ctrl+D and Ctrl+R. In the demo the checkboxes of the
selection column select the same rows from the keyboard.

## See also

- [useRangeSelection](/composables/use-range-selection) and [useGridFill](/composables/use-grid-fill): the gestures built on it.
- [useAutoScroll](/composables/use-auto-scroll): the scrolling under it.
