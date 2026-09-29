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
		'A cell shows whatever your slot renders, the column\'s `GridCellTemplate` or `cell` field, or its text through `format`.',
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

The slots render the content of each cell: the slot named as the cell's column, else the default
slot. When they render nothing for a cell, for example because a `v-if` is false, the cell shows its
own content, just as a `<slot>` shows its fallback: the column's
[`GridCellTemplate`](./column-templates), its `cell` field, else its text through `format`. A
column's `cellFrame`, such as the indent and the toggle of `treeColumn()`, goes around whichever
renders, and around the editor while the cell is edited. The slots are not typed by the columns here; [`defineGridCells`](#definegridcells) gives
them the types.

<PropsTable
	:data="[
		{ name: 'as', type: 'string', default: '\'div\'', description: 'The element of each cell. There is no `asChild`: the part renders many elements.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: '[column name]', scope: 'CellContext', description: 'The content of the cells of that column. A column named `default` has no slot of its own.' },
		{ name: 'default', scope: '{ row: unknown; value: unknown; key: string; index: number; column: RuntimeColumn; node?: RowNode; write?(value): void }', description: 'The cell context of each cell its column slot leaves. `write` is there with the `editing` feature on a cell that can be edited.' },
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

### defineGridCells

`defineGridCells(columns)` gives `GridCells` typed by the columns given: the object of
`defineColumns` passed to `useDataGrid`. `<template #status="{ value }">` gets the values of the
column `status`, and a slot named after no column is an error in the template. The `default` slot
types the row but not the value.

It is the typed override of one body you write yourself. What a column shows wherever it is shown
belongs to its [`GridCellTemplate`](./column-templates), which the slots here come before.

```vue
<script setup lang="ts">
const grid = useDataGrid({ columns, rows, rowKey: 'id' });
const Cells = defineGridCells(columns);
</script>

<template>
	<GridRow v-for="row in rows" :key="row.key" :row="row">
		<Cells>
			<template #status="{ value }">…</template>
		</Cells>
	</GridRow>
</template>
```

`defineGridCells` makes no component: every call gives `GridCells` itself, with the types of the
columns it is given, so call it in `setup` wherever it suits. A list of columns has no names to type
the slots by, and is a type error. A component that takes any grid, typed `DataGrid`, calls it with
columns of its own type, or renders `GridCells`, whose slots are not typed.

## Examples

### Three ways to fill a cell

Every cell of the demo above comes from one of three places, in this order of preference:

1. **A [`GridCellTemplate`](./column-templates) of the column**: the status badge and the assignee.
   Its slot is typed by the column it is given, so `value` is the column's value.
2. **A slot of [`defineGridCells`](#definegridcells)**, named as its column, for markup of this one
   body: the progress bar. The columns given to it name the slots and type them, so `value` is a
   number there.
3. **The fallback**: the column's `cell` field when it has one, else the text of the value through
   `format`, cut to one line. The due date needs nothing more.

```vue
<Cells>
	<template #progress="{ value }">
		<span class="progress">
			<UiProgress :value="value" />
			{{ value }}%
		</span>
	</template>
</Cells>
```

The default slot of `GridCells` does the same for every column at once, with `v-if` on
`column.name`, but it is not typed by the columns: `value` is `unknown` there.

### Classes from the data

`cellClass` returns classes for a cell from its context, such as a date in the past:

```ts
const columns = defineColumns({
	due: column('due', {
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
