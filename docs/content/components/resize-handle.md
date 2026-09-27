---
title: Resize handle
description: The edge of a header cell that resizes its column with a pointer, a finger or the keyboard.
---

# Resize handle

<Description>
The edge of a header cell that resizes its column: drag it, press the arrow keys on it, or double-click
it to fit the column to its content.
</Description>

<Demo name="part-resize-handle" />

## Features

<Highlights
	:features="[
		'Drags with pointer capture, and follows the reading direction in a right-to-left table.',
		'The width reaches the cells once per animation frame through CSS variables: no row renders during a drag.',
		'A double click fits the column to its content.',
		'Focusable, with ← and → to resize and Home and End for the limits.',
		'A `separator` with the width in `aria-valuenow`, so a screen reader hears it.',
		'Keeps within the column\'s `minWidth` and `maxWidth`, and renders nothing for a column that is not `resizable`.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { TableHeaderCell, TableHeaderContent, TableResizeHandle } from 'vue-data-grid';
</script>

<template>
	<TableHeaderCell :column="column">
		<TableHeaderContent />
		<TableResizeHandle />
	</TableHeaderCell>
</template>
```

The column says whether it resizes and how far:

```ts
const column = defineColumn<Person>({ resizable: true, minWidth: 80, maxWidth: 360 });
```

## API reference

### TableResizeHandle

A thin grab area at the end edge of the header cell it is in, at the start edge for a column pinned
to the end. The structural styles place it; the element is empty without a slot. A click on the
handle does not sort the column under it.

<PropsTable
	:data="[
		{ name: 'step', type: 'number', default: '16', description: 'How far an arrow key changes the width, px.' },
		{ name: 'autosize', type: 'AutosizeOptions | false', description: 'How a double click fits the column to its content, such as `{ rows: \'all\' }` to measure rows outside the row window too; `false` turns the double click off.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ width: number; resizing: boolean }', description: 'The width of the column, px, live during a drag, and whether this handle is resizing now. With a slot the handle renders on every frame of a drag, so keep it small.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-tc-part]', values: ['resize-handle'] },
		{ attribute: '[data-tc-state]', values: ['resizing', 'idle'] },
	]"
/>

<CssVariablesTable
	:data="[
		{ name: '--tc-resize-handle-width', default: '8px', description: 'The width of the grab area.' },
	]"
/>

## Examples

### Showing the width while dragging

The slot gets the width and whether the handle is being dragged. The demo shows a badge with the
width only during a drag:

```vue
<TableResizeHandle v-slot="{ width, resizing }">
	<span v-if="resizing" class="width">{{ Math.round(width) }} px</span>
</TableResizeHandle>
```

### Fitting columns from a button

The same autosize a double click runs is a function, and the scope stretches columns to the width of
the view:

```ts
import { autosizeColumns } from 'vue-data-grid';

autosizeColumns(table.scope);
table.scope.fitColumns();
```

Both write every width in one change of the layout. Widths are kept in the column state with the
order and the pins: persist it with the `persist` option of `useDataTable`, and the widths come back
on the next visit.

### Animating a fit

A drag follows the pointer and is never animated. A width that jumps, from a double click, a fit or a
reset of the layout, can glide instead: `useTableMotion` animates every change of the widths in the
layout, frame by frame through CSS variables, without rendering a row. The demo above does just this:

```ts
import { useTableMotion } from 'vue-data-grid';

useTableMotion(table);
```

Its `widths` option sets the duration and the easing, or `false` turns the widths off while rows and
columns still move. A user who asks for reduced motion gets the new widths at once. See
[Animation](/guides/animation).

### A visible grip

The handle is empty and invisible by default; the look is yours. A line that shows on hover and
while dragging:

```css
[data-tc-part='resize-handle']::after {
	position: absolute;
	inset-block: 8px;
	inset-inline-end: 3px;
	width: 2px;
	background: currentColor;
	opacity: 0;
	content: '';
}

[role='columnheader']:hover [data-tc-part='resize-handle']::after,
[data-tc-part='resize-handle'][data-tc-state='resizing']::after {
	opacity: 0.5;
}
```

## Accessibility

Adheres to the focusable [Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
pattern.

- The handle is a `separator` with `aria-orientation="vertical"`, `aria-valuenow`, `aria-valuemin`
  and `aria-valuemax` of the width, and `aria-valuetext` as the screen reader should say it, "180 px"
  by default. Change the words with the `columnWidth` message.
- It is named after its column, "Resize Name", from the `resizeColumn` message.
- During a pointer drag `aria-valuenow` keeps the width the drag started from, and updates when the
  drag ends: the width changes every frame, and the header should not render every frame. The keys
  update it on every press.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['←', '→'], description: 'Makes the column narrower or wider by `step`.' },
		{ keys: ['Home', 'End'], description: 'Takes the column to its `minWidth`, or to its `maxWidth` when it has one.' },
	]"
/>

In a right-to-left table ← and → swap. With the header cell focused, <kbd>Shift</kbd>+<kbd>←</kbd>
and <kbd>Shift</kbd>+<kbd>→</kbd> resize the column without reaching the handle.
