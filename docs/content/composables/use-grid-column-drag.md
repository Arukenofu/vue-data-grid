---
title: useGridColumnDrag
description: Reordering columns by dragging their headers, within what the layout allows, with the columns moving apart as you go.
---

# useGridColumnDrag

<Description>
Reordering columns by dragging their headers. The whole column moves apart to show where the
dragged one would go, and the drop moves it in the layout itself: there is nothing for you to apply.
</Description>

<Demo name="api-use-grid-column-drag" />

Drag a header by its label to another place. The chips above follow the order of the layout, and
the reset puts it back. The pinned Symbol column is not `movable` and stays where it is.

## Usage

```ts
import { useDataGrid } from '@vue-data-grid/core';
import { useGridColumnDrag } from '@vue-data-grid/core/drag-and-drop';

const column = defineColumn<Stock>({ movable: true });

const grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 40 });

useGridColumnDrag(grid, {
	onDrop: ({ name, index }) => analytics.track('column-moved', { name, index }),
});
```

Call it in the component that renders the grid: the header cells below register themselves with it.
The `GridColumnDrag` part does the same from the template. Only `movable` columns drag, and only to
the places the layout allows: within their pinned side, and never splitting a `keepTogether` group.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'onDrop', type: '(event: { name, index }) => void', description: 'A column was dropped and moved; `index` is its place among the shown columns.' },
		{ name: 'canDrop', type: '(name: string, index: number) => boolean', description: 'Whether a column may go to a place, on top of what the layout allows.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Whether columns can be dragged now.' },
		{ name: 'bounds', type: '\'grid\' | \'window\' | HTMLElement', default: '\'grid\'', description: 'What neither the pointer nor the ghost leaves.' },
		{ name: 'indicator', type: 'MaybeRefOrGetter<\'gap\' | \'line\' | \'mark\'>', default: '\'gap\'', description: 'How the place is shown: the columns move apart, each a whole column; a line between the headers; or attributes alone.' },
		{ name: 'motion', type: 'MaybeRef<MotionEngine | false>', default: 'webAnimations()', description: 'The engine of the gap and the ghost; `false` for none.' },
		{ name: 'touchDelay', type: 'MaybeRefOrGetter<number>', default: '250', description: 'How long a finger rests on a header before it drags, ms.' },
		{ name: 'autoScroll', type: 'MaybeRefOrGetter<DragAutoScroll | false>', description: 'How the grid scrolls while a column nears its start or end; `margin` keeps the zones clear of pinned columns.' },
		{ name: 'ignore', type: 'MaybeRefOrGetter<string>', description: 'A selector of what inside a header cell never starts a drag, on top of its controls.' },
		{ name: 'getLabel', type: '(column: RuntimeColumn) => string', description: 'The name of a column for screen readers; its label by default.' },
		{ name: 'announcements', type: 'MaybeRefOrGetter<Partial<DragAnnouncements>>', description: 'What screen readers hear about a drag.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'active', type: 'Readonly<Ref<string | null>>', description: 'The name of the column being dragged.' },
		{ name: 'item', type: 'Readonly<Ref<GridDragItem | null>>', description: 'What is dragged: `{ key, label, column, source, own }`.' },
		{ name: 'over', type: 'Readonly<Ref<boolean>>', description: 'Whether the pointer is over the header.' },
		{ name: 'allowed', type: 'Readonly<Ref<boolean>>', description: 'Whether it is over a place the column may go to.' },
		{ name: 'dragging', type: 'Readonly<Ref<DragPayload | null>>', description: 'The payload being dragged that the header takes.' },
		{ name: 'getColumn', type: '(name: string) => RuntimeColumn | undefined', description: 'The declared column with this name.' },
		{ name: 'canDrag', type: '(name: string) => boolean', description: 'Whether a column may be dragged now.' },
		{ name: 'getLabel', type: '(name: string) => string', description: 'The name of a column, as screen readers hear it.' },
		{ name: 'setPreview', type: '(render, options?) => () => void', description: 'Fills the ghost under the pointer, as `GridDragPreview` does.' },
		{ name: 'register', type: '(element: HTMLElement, key: string) => () => void', description: 'Connects the element of a header cell; `GridHeaderCell` calls it.' },
		{ name: 'getItemProps', type: '(key: string) => Props', description: 'The attributes of a header cell: `data-dg-draggable` while it may be dragged.' },
	]"
/>

## Examples

### Hiding a column by dragging it out

A `GridDropZone` that takes columns does anything with a dropped column, such as hiding it. Give the
drag `bounds: 'window'`, so the header can leave the grid to reach it:

```vue
<GridColumnDrag bounds="window">
	<GridHeader>…</GridHeader>
</GridColumnDrag>
<GridDropZone accept="columns" @drop="({ key }) => grid.scope.toggleColumn(key)">
	Drop a column here to hide it
</GridDropZone>
```

### Moving columns from code

The layout is the one source of the order, so a drag, the keys and code all go through the scope:

```ts
grid.scope.moveColumnTo('price', 2);
grid.scope.moveColumnBefore('volume', 'price');
grid.scope.moveColumnBy('price', -1);
```

`useGridMotion` animates each of them, a drop with a `line` or a `mark` too; with the `gap`, the
columns already stand at their places when the drop lands.

## Accessibility

- A column is not dragged with the keyboard: its header moves with <kbd>Alt</kbd>+<kbd>←</kbd> and
  <kbd>Alt</kbd>+<kbd>→</kbd> instead, a key press per place, focus staying on the header. Those are
  the keys of `useHeaderCell`, so `describedBy` is `undefined` here.
- The dragged header stays rendered under the column window while the grid scrolls sideways.
- The default engine plays nothing for a person who prefers reduced motion.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Alt+←', 'Alt+→'], description: 'On a header cell, moves a `movable` column one place, stepping over a `keepTogether` group.' },
	]"
/>

## See also

- [Column drag](/components/column-drag): the `GridColumnDrag` part.
- [Column layout](/guides/column-layout): the order, pins and groups a drag keeps to.
- [useGridRowDrag](/composables/use-grid-row-drag): the same for rows.
