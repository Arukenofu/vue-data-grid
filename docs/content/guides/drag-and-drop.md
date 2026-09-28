---
title: Drag and drop
description: Reorder rows and columns, nest rows in a tree, move rows between grids and drop them on areas of your own.
---

# Drag and drop

<Description>
Reorder rows with a handle or by the whole row, with the pointer, a finger or the keyboard; move
columns by their headers; pass rows between grids, and drop them on areas of your own.
</Description>

<Demo name="row-drag" />

Grab a track by its handle and move it. The other rows make room where it would land, and each
track keeps its number: the number is data of the track, read by a column like any other, so it
travels with its row. Focus a handle and press <kbd>Space</kbd> to do the same from the keyboard:
the arrows move the track, <kbd>Space</kbd> drops it, <kbd>Escape</kbd> puts it back.

## Installation

Dragging lives in its own entry point, `@vue-data-grid/core/drag-and-drop`, on top of the
`@vue-data-grid/drag-and-drop` package. It is an optional peer dependency, so a grid that never drags
never downloads it. Install it next to the grid:

<InstallTabs packages="@vue-data-grid/drag-and-drop" />

## Reordering rows

Put a `GridRowDrag` around the body. Its rows can then be dragged, and when one is dropped it
tells you where, as a key, a parent and an index. Moving the row in your data is yours, and
`moveRow` does it in one line:

```vue
<script setup lang="ts">
import { moveRow, GridBody, GridCells, GridRoot, GridRow, useDataGrid } from '@vue-data-grid/core';
import { type GridRowDropEvent, GridRowDrag } from '@vue-data-grid/core/drag-and-drop';

const playlist = shallowRef(tracks);

const grid = useDataGrid({ columns, rows: playlist, rowKey: 'id', rowHeight: 44 });

function reorder(event: GridRowDropEvent<unknown>) {
	const track = playlist.value.find(item => item.id === event.key);

	if (track) {
		playlist.value = moveRow(playlist.value, { ...event, row: track }, { rowKey: 'id' });
	}
}
</script>

<template>
	<GridRoot :grid="grid" label="Playlist">
		<GridRowDrag @drop="reorder">
			<GridBody v-slot="{ rows }">
				<GridRow v-for="row in rows" :key="row.key" :row="row">
					<GridCells />
				</GridRow>
			</GridBody>
		</GridRowDrag>
	</GridRoot>
</template>
```

`index` is the place among the siblings **once the row is taken out**: remove the row, then insert
it at `index`. `moveRow` does exactly that, keeps every other row as the same object, and handles
trees by a `parentKey` field. The row in the event is `unknown`, since the part does not know the
type of your rows; looking it up by key, as above, keeps everything typed.

`GridRowDrag` renders no element of its own. Rows are dragged while the grid is not sorted: the
order of a sorted grid belongs to the sort, not to the rows. `enabled` changes that.

### A handle, and the keyboard

By default the whole row drags with the pointer, and buttons, links and fields in its cells keep
their clicks. With `handle`, a drag starts only on a `GridDragHandle`, which is a button, so it
also drags with the keyboard. `dragHandleColumn()` is a ready column of handles:

```ts
import { dragHandleColumn } from '@vue-data-grid/core/drag-and-drop';

const columns = defineColumns({
	handle: dragHandleColumn(),
	title: column('title', { label: 'Title' }),
});
```

```vue
<GridRowDrag handle @drop="reorder">
```

Without a handle, <kbd>Alt</kbd>+<kbd>↑</kbd> and <kbd>Alt</kbd>+<kbd>↓</kbd> on any cell move its row
one place, through the same `drop` event; `:step-keys="false"` turns that off.

### What can move where

Three functions decide what a drag may do; each is asked while the drag goes on, so a place that is
not allowed is simply never shown:

```vue
<GridRowDrag
	:can-drag="(row, key) => key !== 'pinned-note'"
	:can-drop="target => target.index > 0"
	:can-nest="row => isFolder(row)"
	@drop="reorder"
>
```

- `canDrag(row, key)`: whether a row can be picked up at all.
- `canDrop(target)`: whether it may land at a place: `{ key, row, parent, index, over, position }`.
- `canNest(row, key)`: in a tree, whether a row takes children dropped inside it; group rows do by
  default.

### Trees

With the `tree` feature, a row can go between rows at any level or inside a group. The event's
`parent` is the new parent, `null` for the top level, and `moveRow` writes it into the field you
name:

```ts
function reorder(event: GridRowDropEvent<unknown>) {
	const file = files.value.find(item => item.id === event.key);

	if (file) {
		files.value = moveRow(files.value, { ...event, row: file }, { rowKey: 'id', parentKey: 'parent' });
	}
}
```

A group closes while it is dragged, so it moves as one row, and opens again where it lands. A group
that receives a row opens to show it.

## Reordering columns

A `GridColumnDrag` around the header lets `movable` columns be dragged by their headers. The grid
moves them in its own layout, so there is nothing to write back; `drop` only tells you it happened.

<Demo name="column-drag" />

```vue
<GridRoot :grid="grid" label="Stocks">
	<GridColumnDrag>
		<GridHeader>
			<!-- … -->
		</GridHeader>
		<GridDragPreview />
	</GridColumnDrag>
	<GridBody>
		<!-- … -->
	</GridBody>
</GridRoot>
```

A column stays within its pinned side, and never splits a column group that keeps its columns
together. `canDrop(name, index)` narrows it further. Columns move with the keyboard without any drag
at all: <kbd>Alt</kbd>+<kbd>←</kbd> and <kbd>Alt</kbd>+<kbd>→</kbd> on a header. Add
[`useGridMotion`](/guides/animation) and the cells of the moved column slide into place after the
drop, as the demo does.

## Showing the place

`indicator` picks how the place is shown, for rows and for columns alike:

- `'gap'`, the default: the rows or columns move apart where the dragged one would go, and the
  dragged one stands in the gap. Nothing is laid out again: they move by `translate`, so a drop
  lands exactly where the gap was drawn.
- `'line'`: one line that slides from place to place, `[data-drop-indicator]`, drawn by the
  structural styles in `--dg-drop-color`.
- `'mark'`: attributes alone, `data-drop-target="before"`, `"after"` or `"inside"` on the row next
  to the place, for your own CSS.

The dragged row itself gets `data-drag-source`, and is faded by the structural styles.

### The ghost

`GridDragPreview` is what follows the pointer. Its slot is rendered into the ghost through a
`Teleport`, so it is an ordinary part of your template, with your components and styles:

```vue
<GridDragPreview v-slot="{ label, row }" placement="outside">
	<IconMusic aria-hidden="true" />
	{{ label }}
</GridDragPreview>
```

It stands `placement` from the pointer, `'outside'` it by default, `'center'` under it, or
`'source'` where the row was grabbed, and goes as `exit` says: it fades by default, and
`exit="land"` flies it into the row at its new place, for a ghost that looks like the row.

## Between grids

Grids that share a `group` take each other's rows. The drop reaches the grid the row lands on,
with `external: true` and the `source` grid, so you move the row between your lists:

<Demo name="drag-between-grids" />

```vue
<GridRowDrag group="tasks" @drop="event => place('sprint', event)">
	<GridBody />
	<GridDragOverlay v-slot="{ label }">Drop “{{ label }}” here</GridDragOverlay>
</GridRowDrag>
```

In a group the drag may leave its grid, `bounds="window"` by default, so the row can travel to the
other one. `canAccept(offer)` decides which rows a grid takes from the others.
`GridDragOverlay` shows a message over a grid while a row it would take is on its way; its
`data-dg-state` is `ready`, then `over`, or `refused` over a place that is not allowed.

### Drop zones

`GridDropZone` is an area that takes rows, or columns with `accept="columns"`, without being a
grid: a bin, a "favourites" box, a column chooser. It emits `drop` with the key, the label, the row
and the grid it came from:

```vue
<GridDropZone v-slot="{ ready, over }" group="tasks" @drop="archive">
	{{ over ? 'Release to archive' : ready ? 'Drop here to archive' : 'Archive' }}
</GridDropZone>
```

## Saving the order on a server

`drop` has no veto: a synchronous "no" belongs in `canDrop`, where the place is never offered. For a
server that may refuse, move the row at once and move it back if the request fails. With
`useGridMotion`, both moves animate:

```ts
async function reorder(event: GridRowDropEvent<unknown>) {
	const before = playlist.value;
	const track = before.find(item => item.id === event.key);

	if (!track) {
		return;
	}

	playlist.value = moveRow(before, { ...event, row: track }, { rowKey: 'id' });

	try {
		await api.moveTrack(track.id, event.index);
	} catch {
		playlist.value = before;
	}
}
```

## Movement

The gap, the ghost and the rows after a drop move with the engine in `motion`: the Web Animations
API by default, `false` for none, or an engine of GSAP, Motion or your own, as described in
[Animation](/guides/animation). A user who prefers reduced motion gets none.

```vue
<GridRowDrag :motion="gsapEngine" @drop="reorder">
```

## Accessibility

- With `handle`, every row has a real button to drag it with. It is named after the row, "Drag
  Northern Lights" from the grid's `dragRow` message, and described by the keyboard instructions.
- A keyboard drag is announced through a live region: when a row is picked up, every place it passes
  as "position 3 of 10", the drop and a cancel. `announcements` translates them.
- Without a handle, <kbd>Alt</kbd>+<kbd>↑</kbd> and <kbd>Alt</kbd>+<kbd>↓</kbd> move a row from any
  cell, and columns always move with <kbd>Alt</kbd>+<kbd>←</kbd> and <kbd>Alt</kbd>+<kbd>→</kbd> on
  their headers, so no gesture needs a pointer.
- A drag scrolls the grid near its edges, clear of the sticky header and footer, and a finger has to
  rest for a moment, `touchDelay`, before a drag starts, so the grid still scrolls by touch.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Space', 'Enter'], description: 'On a drag handle: picks the row up; while dragging, drops it.' },
		{ keys: ['↑', '↓'], description: 'While dragging: moves the row to the next place up or down, in a tree at every level it can go to.' },
		{ keys: ['Home', 'End'], description: 'While dragging: moves the row to the first or the last place.' },
		{ keys: ['Escape', 'Tab'], description: 'While dragging: puts the row back where it was.' },
		{ keys: ['Alt+↑', 'Alt+↓'], description: 'On any cell: moves its row one place among its siblings.' },
		{ keys: ['Alt+←', 'Alt+→'], description: 'On a column header: moves the column one place.' },
	]"
/>

## See also

- [Row drag](/components/row-drag), [Column drag](/components/column-drag),
  [Drag preview and overlay](/components/drag-preview) and [Drop zone](/components/drop-zone): every
  prop of the parts.
- [`useGridRowDrag`](/composables/use-grid-row-drag) and
  [`useGridColumnDrag`](/composables/use-grid-column-drag): the same without the parts.
- [Task board](/examples/task-board) and [File explorer](/examples/file-explorer): drag and drop in
  complete grids.
