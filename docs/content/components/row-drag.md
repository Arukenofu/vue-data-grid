---
title: Row drag
description: Dragging rows to reorder them, into groups of a tree and between grids, with a pointer, a finger or the keyboard.
---

# Row drag

<Description>
Dragging rows to a new place: within the grid, into and out of the groups of a tree, and between
grids, with a pointer, a finger or the keyboard.
</Description>

<Demo name="part-row-drag" />

## Features

<Highlights
	:features="[
		'Rows make room where the dragged one would go, or a line shows the place: `indicator` of `gap` or `line`.',
		'The grid never touches your rows: `drop` says which row goes where, and you move it.',
		'Drag by the whole row, or only by a handle, which also drags with the keyboard.',
		'Alt with ↑ and ↓ moves the row of the focused cell one place, with or without a handle.',
		'The grid scrolls near its edges, and the dragged row stays rendered under the row window.',
		'`canDrag`, `canDrop` and `canNest` decide what moves and where; places you refuse are never shown.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { GridBody, GridCells, GridRow } from '@vue-data-grid/core';
import { GridDragHandle, GridDragPreview, GridRowDrag } from '@vue-data-grid/core/drag-and-drop';
</script>

<template>
	<GridRowDrag handle @drop="drop">
		<GridBody v-slot="{ rows }">
			<GridRow v-for="row in rows" :key="row.key" :row="row">
				<GridCells v-slot="{ column }">
					<GridDragHandle v-if="column.name === 'grip'" />
				</GridCells>
			</GridRow>
		</GridBody>
		<GridDragPreview />
	</GridRowDrag>
</template>
```

Dragging lives in the subpath `@vue-data-grid/core/drag-and-drop`, over the optional peer
`@vue-data-grid/drag-and-drop`. Install it next to the grid:

<InstallTabs packages="@vue-data-grid/core @vue-data-grid/drag-and-drop" />

`GridRowDrag` renders no element: put it around the `GridBody`, inside the `GridRoot`. The rows
under it register themselves, and a [`GridDragPreview`](/components/drag-preview) inside it is the
ghost under the pointer.

## API reference

### GridRowDrag

`useGridRowDrag` as a part. Its props are the options of the composable, and its `drop` event is
`onDrop`.

<PropsTable
	:data="[
		{ name: 'handle', type: 'boolean', default: 'false', description: 'Drags start only on a `GridDragHandle`, which also drags with the keyboard. Without it the whole row drags, and controls in its cells keep their clicks.' },
		{ name: 'indicator', type: '\'gap\' | \'line\' | \'mark\'', default: '\'gap\'', description: 'How the place is shown: the rows move apart, a line slides between them, or only attributes mark it.' },
		{ name: 'enabled', type: 'boolean', description: 'Whether rows can be dragged now. By default a grid that reorders drags while its rows are not sorted, since their order is then the sort\'s; one with `reorder` off always.' },
		{ name: 'group', type: 'string', description: 'A name shared by grids that take each other\'s rows.' },
		{ name: 'reorder', type: 'boolean', default: 'true', description: 'Whether the grid takes its own rows at new places. `false` for rows that only leave, for the grids of the `group` and for drop zones: the grid keeps its order, still takes the rows of the group, and has no keyboard drag and no step keys.' },
		{ name: 'bounds', type: '\'grid\' | \'window\' | HTMLElement', description: 'What neither the pointer nor the ghost leaves: the grid by default, the window in a `group`.' },
		{ name: 'canDrag', type: '(row, key) => boolean', description: 'Whether a row can be dragged; every row by default.' },
		{ name: 'canDrop', type: '(target: GridRowDropTarget) => boolean', description: 'Whether a row may be dropped at a place: `{ key, row, parent, index, over, position }`.' },
		{ name: 'canAccept', type: '(offer: { row, source }) => boolean', description: 'Whether to take a row from another grid of the group; any by default.' },
		{ name: 'canNest', type: '(row, key) => boolean', description: 'In a tree: whether a row takes children dropped inside it; a group row by default.' },
		{ name: 'stepKeys', type: 'boolean', default: 'true', description: 'Alt with ↑ and ↓ on a cell moves its row one place among its siblings.' },
		{ name: 'getLabel', type: '(row, key) => string', description: 'The name of a row for screen readers; the text of its row header cell by default.' },
		{ name: 'motion', type: 'MotionEngine | false', description: 'The engine of the gap, the ghost and the drop; `webAnimations()` by default, `false` for none.' },
		{ name: 'autoScroll', type: 'DragAutoScroll | false', description: 'How the grid scrolls near its top and bottom: `{ threshold, speed, curve, smoothing, margin }`.' },
		{ name: 'touchDelay', type: 'number', default: '250', description: 'How long a finger rests on a row before it drags, ms.' },
		{ name: 'ignore', type: 'string', description: 'A selector of what inside a row never starts a drag, on top of links, buttons and fields.' },
		{ name: 'announcements', type: 'Partial<DragAnnouncements>', description: 'What screen readers hear during a keyboard drag; English by default.' },
	]"
/>

<EmitsTable
	:data="[
		{ name: 'drop', payload: 'GridRowDropEvent', description: 'A row was dropped on the grid: `{ key, row, parent, index, external, source }`. Move it in your data, such as with `moveRow`. `index` is the place among the children of `parent`, counted once the row is taken out.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ active, dragging, over, allowed, target, item }', description: 'The key of the row dragged from this grid, whether a row the grid takes is dragged, whether it is over the body and at an allowed place, where it would go, and what it is. Read only what you show: each read follows the drag.' },
	]"
/>

While a row is dragged the elements carry the attributes of `@vue-data-grid/drag-and-drop`:

<DataAttributesTable
	:data="[
		{ attribute: '[data-drag-source]', values: 'The row being dragged: it stays in place, faded, or stands in the gap.' },
		{ attribute: '[data-drop-target]', values: ['before', 'after', 'inside'] },
		{ attribute: '[data-drop-indicator]', values: ['before', 'after', 'inside'] },
		{ attribute: '[data-dg-draggable]', values: 'On a row while it can be dragged; `steps` when Alt with the arrows moves it too.' },
	]"
/>

<CssVariablesTable
	:data="[
		{ name: '--dg-drop-color', default: 'Highlight', description: 'The line of the place a row goes to, and the outline of a row it goes inside.' },
		{ name: '--drop-level', description: 'Set on the line and the target: the level of the place in a tree, which indents the line.' },
	]"
/>

### GridDragHandle

The handle of a row: a `button` that drags its row with a pointer or a finger, and with `handle` on
the row drag, with the keyboard too. The row is its `row` prop, else the `GridRow` around it.

<PropsTable
	:data="[
		{ name: 'row', type: 'string | GridBodyRow', description: 'The row: its key or its body row. The row of the `GridRow` around by default.' },
		{ name: 'label', type: 'string', description: 'The accessible name; the `dragRow` message with the name of the row, &quot;Drag Tides of Glass&quot;, by default.' },
		{ name: 'as', type: 'string | Component', default: '\'button\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ dragging: boolean; disabled: boolean }', description: 'The content of the handle; `⠿` without it.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['drag-handle'] },
		{ attribute: '[data-dg-state]', values: ['dragging', 'idle'] },
		{ attribute: '[data-dg-disabled]', values: 'Present while its row may not be dragged.' },
	]"
/>

## Examples

### Moving the row in your data

The event says where the row goes; `moveRow` returns your rows with it moved, every other row the
same object:

```ts
import { moveRow } from '@vue-data-grid/core';
import type { GridRowDropEvent } from '@vue-data-grid/core/drag-and-drop';

function drop({ key, index }: GridRowDropEvent<unknown>) {
	const row = rows.value.find(track => track.id === key);

	if (row) {
		rows.value = moveRow(rows.value, { key, row, parent: null, index }, { rowKey: 'id' });
	}
}
```

In a tree, pass the `parent` of the event and `parentKey`, and the row moves under its new parent.

### Rows that stay put

The playlist keeps its opening and closing tracks: `canDrag` refuses them, and `canDrop` keeps every
other track between them.

```vue
<GridRowDrag :can-drag="(_row, key) => !locked.has(key)" :can-drop="({ index }) => index > 0 && index < rows.length - 1">
```

### Rows that only leave

A grid whose order is not the user's, such as a sorted list of files, can still give its rows to
other grids and to drop zones. With `:reorder="false"` an own row has no place in its grid: a drop
over it puts the row back. The grid still takes the rows of its `group`, and drags whatever the
sort:

```vue
<GridRowDrag group="files" :reorder="false" @drop="receive">
```

### Saving on a server

Move the row at once, and move it back if the server refuses: the grid animates both.

```ts
async function drop({ key, index }: GridRowDropEvent<unknown>) {
	const before = rows.value;
	const row = before.find(track => track.id === key);

	if (!row) {
		return;
	}

	rows.value = moveRow(before, { key, row, parent: null, index }, { rowKey: 'id' });

	try {
		await saveOrder(key, index);
	} catch {
		rows.value = before;
	}
}
```

## Accessibility

- A handle is a `button` named after its row, "Drag Tides of Glass". With `handle` it is described
  by hidden instructions, "To move, press Space or Enter, then the arrow keys…", through
  `aria-describedby`.
- During a keyboard drag a live region says where the row is: "Picked up Tides of Glass, position 2
  of 9", then each move, and the drop or the cancel. Change the words with `announcements`.
- A handle of a row that may not be dragged is `aria-disabled`, not removed, so the column keeps its
  rhythm and the reason can be seen.
- The row being dragged stays rendered under the row window, so focus never lands on a row that is
  not there.
- With `reorder` off there is no keyboard drag, which moves a row within its grid alone: offer the
  move to another grid or a zone another way too, such as a menu item on the row.

### Keyboard interactions

With `handle`, on a focused handle:

<KeyboardTable
	:data="[
		{ keys: ['Space', 'Enter'], description: 'Picks the row up; again, drops it at its new place.' },
		{ keys: ['↑', '↓'], description: 'Moves the row to the previous or the next place, into and out of groups in a tree.' },
		{ keys: ['Home', 'End'], description: 'Moves the row to the first or the last place.' },
		{ keys: ['Escape', 'Tab'], description: 'Cancels: the row goes back.' },
	]"
/>

On any cell, with the `navigation` feature, handle or not:

<KeyboardTable
	:data="[
		{ keys: ['Alt+↑', 'Alt+↓'], description: 'Moves the row one place among its siblings at once.' },
	]"
/>
