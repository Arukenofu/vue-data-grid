---
title: useColumnResize
description: Resizing columns by a handle — a pointer drag once per frame, a double click that fits the content, and the keys of a separator.
---

# useColumnResize

<Description>
Resizing columns by a handle: a pointer drag applied once per animation frame, a double click that
fits the column to its content, and the keys of a focusable separator that tells the screen reader
the width. `GridResizeHandle` is built on it.
</Description>

<Demo name="api-use-column-resize" />

The handles here are your own elements with `getHandleProps` bound to them, and a bubble that shows
the width while it changes. The first button stretches the columns to the width of the grid, the
last puts the declared widths back; `useGridMotion` animates both.

## Usage

```vue
<script setup lang="ts">
import { useColumnResize } from '@vue-data-grid/core';

const resize = useColumnResize(grid.scope, { step: 10 });
</script>

<template>
	<GridHeaderCell v-for="column in columns" :key="column.key" v-slot="{ column: header }" :column="column">
		<GridHeaderContent />
		<span v-bind="resize.getHandleProps(header.name)" class="grip" />
	</GridHeaderCell>
</template>
```

`getHandleProps` gives the handle everything: its role, the width for the screen reader, the
handlers of the drag and the keys, and `data-dg-part="resize-handle"`, for which the structural styles
make a grab area at the end edge of the header cell. For a column that is not `resizable` it gives
nothing. A click on the handle does not sort the column under it.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'step', type: 'MaybeRefOrGetter<number>', default: '16', description: 'How far ← and → change the width, px.' },
		{ name: 'autosize', type: 'MaybeRefOrGetter<AutosizeOptions | false>', description: 'How a double click fits the column to its content; `false` turns the double click off.' },
		{ name: 'label', type: '(column: { name, label? }) => string', description: 'The accessible name of a handle; the grid\'s `resizeColumn` message, `Resize <label>`, by default.' },
		{ name: 'valueText', type: '(width: number) => string', description: 'The width as the screen reader says it; the `columnWidth` message, `<width> px`, by default.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'getHandleProps', type: '(name: string) => Props', description: '`role=&quot;separator&quot;`, `aria-orientation`, `aria-label`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `tabindex=&quot;0&quot;`, `data-dg-part`, `data-dg-state` of `resizing` or `idle`, and the handlers. Nothing for a column that is not `resizable`.' },
		{ name: 'resizing', type: 'Ref<string | null>', description: 'The column a drag or a key is resizing now.' },
		{ name: 'autosize', type: '(name: string) => void', description: 'Fits the column to its content, as a double click on its handle does.' },
		{ name: 'end', type: '() => void', description: 'Ends a gesture in progress and writes the width to the layout.' },
	]"
/>

## Examples

### Why widths do not render the grid

A drag changes a width many times a frame. The width goes to the DOM through CSS variables, once per
frame, and to the layout only when the pointer is released. No row renders during a drag, which is
why a resize stays smooth on a grid of any size. For the same reason a handle's `aria-valuenow`
holds the width the drag started from until the drag ends.

### Limits

`minWidth` and `maxWidth` of the column hold during a drag, on the keys, and on a double click. Home
and End take the width to them.

```ts
const columns = defineColumns({
	name: column(row => row.name, { label: 'Name', width: 200, minWidth: 120, maxWidth: 360, resizable: true }),
});
```

### Fitting from code

`autosizeColumns(scope)` fits every resizable data column in one layout write, and
`scope.fitColumns()` stretches the columns to the width of the grid. Both write the layout, so
`useGridMotion` animates them.

```ts
import { autosizeColumns } from '@vue-data-grid/core';

autosizeColumns(grid.scope);
grid.scope.fitColumns();
```

## Accessibility

Adheres to the focusable [window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
pattern of WAI-ARIA: the handle is a `separator` with a value.

- The handle is focusable and named after its column, `Resize Price`, and says its width in pixels.
- The keys change the width and update `aria-valuenow` on every press.
- The drag uses pointer capture, so it keeps going when the pointer leaves the handle, and ignores a
  second pointer, such as another finger.
- In a right-to-left grid, and for a column pinned to the end, whose handle is at its start edge,
  the drag and the arrows follow the edge.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['→', '←'], description: 'Widens or narrows the column by `step`.' },
		{ keys: ['Home'], description: 'Sets the column to its `minWidth`.' },
		{ keys: ['End'], description: 'Sets the column to its `maxWidth`, when it has one.' },
	]"
/>

## See also

- [Resize handle](/components/resize-handle): the part built on it.
- [Column layout](/guides/column-layout): widths, autosize and fitting.
- [autosizeColumns](/composables/autosize-columns): `autosizeColumns` and `measureColumnsContent`.
