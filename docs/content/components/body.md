---
title: Body
description: The rows of the grid and their cells, rendered from the row window with one component per row.
---

# Body

<Description>
The rows of the grid and their cells. One component per row, however many columns it has, and a row
renders again only when its own data changes.
</Description>

<Demo name="part-body" />

## Features

<Highlights
	:features="[
		'Renders only the rows in the row window, each placed at its offset.',
		'A row keeps the same object while its data, place and tree node hold: this is the row memo.',
		'All the cells of a row come from one part, as plain elements: a wide row costs one component.',
		'A cell shows the column\'s `cell` field, or its text through `format`, or whatever your slot renders.',
		'`aria-selected` of cells in a range is written straight to the DOM, without rendering a row.',
		'The cell being edited renders its editor; every other cell stays as it is.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { GridBody, GridCells, GridRow } from '@vue-data-grid/core';
</script>

<template>
	<GridBody v-slot="{ rows }">
		<GridRow v-for="row in rows" :key="row.key" :row="row">
			<GridCells />
		</GridRow>
	</GridBody>
</template>
```

Overlays that draw over the rows, such as the [range overlay](/components/range-overlay), go inside
`GridBody` after the rows.

## API reference

### GridBody

The block of body rows. With positioned rows, the default, it is as tall as all the rows together,
so the scrollbar is right even when only the rows in view are rendered. It also binds the grid's
`body` element, which dragging rows and selecting cells work on.

<PropsTable
	:data="[
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ rows: GridBodyRow[] }', description: 'The rendered rows, for a `GridRow` each. A row is `{ key, index, item, original, node }`: its key, its index in `rows`, its place in the row window, the row itself and its tree node.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['body'] },
		{ attribute: '[data-dg-row-layout]', values: ['positioned', 'flow'] },
	]"
/>

### GridRow

A body row, placed at its offset under the row window, with the role and the attributes of its
index, tree level and selection. With `measureRows` it is measured, so rows of any height work. It
gives the parts inside, such as a selection checkbox or a drag handle, their row. Inside a
[`GridRowDrag`](/components/row-drag) it also registers itself, so the row can be dragged.

<PropsTable
	:data="[
		{ name: 'row', type: 'GridBodyRow', required: true, description: 'The row, from the slot of `GridBody`.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ row: GridBodyRow; columns: RenderedColumn[] }', description: 'The row and the rendered columns. Put a `GridCells` here.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['row'] },
		{ attribute: '[data-dg-index]', values: 'The index of the row in `rows`, by which rows are measured; the `indexAttribute` option renames it.' },
		{ attribute: '[data-dg-grid-section]', values: ['body'] },
		{ attribute: '[data-dg-grid-row]', values: 'The index of the row in its section, for the keyboard navigation.' },
		{ attribute: '[data-dg-draggable]', values: 'Present while the row can be dragged, inside a `GridRowDrag`; `steps` when Alt with the arrows moves it too.' },
	]"
/>

### GridCells

The cells of the row it is in: one plain element per rendered column, with its role,
`aria-colindex`, width and pin, and the column's `cellClass`. Attributes you put on the part go to
every cell. There is no component per cell on purpose: mounting and updating a body of components
per cell costs about twice as much, and a grid is mostly cells.

The default slot renders the content of each cell. When it renders nothing for a cell, for example
because its `v-if` is false, the cell shows its own content, just as a `<slot>` shows its fallback:
the column's `cell` field, else its text through `format`.

<PropsTable
	:data="[
		{ name: 'as', type: 'string', default: '\'div\'', description: 'The element of each cell. There is no `asChild`: the part renders many elements.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ row: unknown; value: unknown; key: string; index: number; column: RuntimeColumn; node?: RowNode; write?(value): void }', description: 'The cell context of each cell. `write` is there with the `editing` feature on a cell that can be edited.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-column]', values: 'The name of the column.' },
		{ attribute: '[data-dg-pinned]', values: ['start', 'end'] },
		{ attribute: '[data-dg-align]', values: ['center', 'right'] },
		{ attribute: '[data-dg-state]', values: ['editing'] },
	]"
/>

<CssVariablesTable
	:data="[
		{ name: '--dg-background', default: 'Canvas', description: 'The background of rows, and of pinned cells, which must hide what scrolls under them.' },
		{ name: '--dg-pinned-background', default: 'var(--dg-background)', description: 'The background of pinned cells of the body.' },
		{ name: '--dg-selected-background', default: 'color-mix(in srgb, Highlight 18%, Canvas)', description: 'The background of the cells of a selected row.' },
		{ name: '--dg-line-color', default: 'color-mix(in srgb, CanvasText 15%, Canvas)', description: 'The line under every row.' },
		{ name: '--dg-line-width', default: '1px', description: 'Its width.' },
		{ name: '--dg-cell-padding', default: '0 8px', description: 'The padding of every cell.' },
	]"
/>

## Examples

### Three ways to fill a cell

Every cell of the demo above comes from one of three places, in this order of preference:

1. **The column's `cell` field**, typed by the row: the status badge and the assignee. It is the same
   wherever the column is shown, and the type of `row` and `value` comes from the column.
2. **The slot of `GridCells`**, for markup that belongs to this one grid: the progress bar. The
   slot is typed loosely, since the parts find the grid through `inject` and do not know its rows,
   so read `value` rather than the row.
3. **The fallback**: the text of the value through `format`, cut to one line. The due date needs
   nothing more.

```vue
<GridCells v-slot="{ column, value }">
	<span v-if="column.name === 'progress'" class="progress">
		<UiProgress :value="Number(value)" />
		{{ value }}%
	</span>
</GridCells>
```

### Classes from the data

`cellClass` returns classes for a cell from its context, such as a date in the past:

```ts
const columns = defineColumns({
	due: column(task => task.due, {
		label: 'Due',
		cellClass: ({ row }) => (row.due < today && row.status !== 'done' ? 'overdue' : undefined),
	}),
});
```

### Rows that render only when they change

`GridBody` hands out the same row object while the row's data, place and node hold, and
`GridRow` renders again only when that object changes. Update your rows immutably, a new object
for a changed row and the old object for the rest, and a change touches one row:

```ts
rows.value = rows.value.map(task => (task.id === id ? { ...task, progress } : task));
```

The **Advance a task** button in the demo does exactly this: one row renders, the other eleven do not.

## Accessibility

- Rows have `role="row"` and `aria-rowindex` counted from the top of the header, so a screen reader
  knows where a row is even while most rows are not rendered.
- Cells are `gridcell`, or `cell` in a static `table`, with `aria-colindex`. The first data column,
  or every column with `rowHeader: true`, is a `rowheader`: it names the row, and the column window
  always keeps it rendered.
- In a tree a row has `aria-level`, `aria-posinset`, `aria-setsize` and, for a group, `aria-expanded`;
  with a selection, `aria-selected`.
- A spacer of the column window, which stands for columns out of view, has `role="presentation"`.

### Keyboard interactions

The body is where the [keyboard navigation](/guides/keyboard-navigation) moves. With the
`navigation` feature every cell has `tabindex="-1"` and takes focus from the keys:

<KeyboardTable
	:data="[
		{ keys: ['↑', '↓', '←', '→'], description: 'Moves focus to the next cell in that direction.' },
		{ keys: ['PageUp', 'PageDown'], description: 'Moves focus by as many rows as fit in view.' },
		{ keys: ['Enter', 'F2'], description: 'Moves into the content of the cell; a cell whose only content is a button presses it.' },
		{ keys: ['Escape'], description: 'Comes back from the content of the cell to the cell.' },
	]"
/>
