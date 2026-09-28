---
title: Service columns
description: Ready columns for row selection, row numbers, trees and drag handles.
---

# Service columns

<Description>
Ready columns for the furniture of a grid: a checkbox to select rows, row numbers, the indent and
toggle of a tree, and a handle to drag rows by.
</Description>

<Demo name="part-service-columns" />

## Features

<Highlights
	:features="[
		'Real columns: they pin, resize and move like any other, and take part in the layout.',
		'`kind: \'service\'`: CSV, cell ranges, cell changes and autosize leave them out.',
		'Each renders its parts in its cells, so the parts find the grid and the row themselves.',
		'Change their label, width, pin and rights; the rest is theirs.',
	]"
/>

## Anatomy

```ts
import { rowNumberColumn, selectionColumn, treeColumn } from '@vue-data-grid/core';
import { dragHandleColumn } from '@vue-data-grid/core/drag-and-drop';

const columns = defineColumns({
	drag: dragHandleColumn(),
	select: selectionColumn(),
	title: treeColumn(column(item => item.title, { label: 'Work item', flex: 1 })),
	owner: column(item => item.owner, { label: 'Owner' }),
});

const leaderboard = defineColumns({
	place: rowNumberColumn(),
	name: column(person => person.name, { label: 'Name' }),
});
```

Each factory returns a column declaration to put among your columns. They need their feature on the
grid: `selectionColumn()` the `selection` feature, `treeColumn()` the `tree` feature, and
`dragHandleColumn()` a [`GridRowDrag`](/components/row-drag) with `handle`.

## API reference

### selectionColumn

The checkbox column of the row selection: a [`GridSelectAllCheckbox`](/components/selection-checkbox)
in the header and a `GridSelectionCheckbox` in every cell. Pinned to the start by default, 40 px wide,
centred.

```ts
selectionColumn(options?: ServiceColumnOptions): ColumnInput<TRow, null>
```

### rowNumberColumn

The number of each row among the shown rows, from `1`, aligned right. With `rowHeader: true` the
number names the row for assistive technology, as in a spreadsheet.

```ts
rowNumberColumn(options?: ServiceColumnOptions & { rowHeader?: boolean }): ColumnInput<TRow, null>
```

The number is the row's place, not a fact about the row: sort the grid and the column still counts
from 1, top to bottom.

<Demo name="part-row-numbers" />

::: tip Numbers that travel with their rows
In a grid whose rows are dragged, such as the one at the top of this page, a place number changes
under every row a drag passes. When the number belongs to the row, an id, a track number, a line of
an order, it is data: show it with a column of your own that reads it from the row, and it moves
with the row.
:::

### treeColumn

Turns a data column into the column of the tree: each cell starts with an indent of
`--dg-tree-indent` per level and a [`GridTreeToggle`](/components/tree-toggle), then the column's own
content. It stays a data column, and it is marked `tree`, so → and ← expand and collapse rows in it.

```ts
treeColumn(column: ColumnInput<TRow, TValue>): ColumnInput<TRow, TValue>
```

### dragHandleColumn

The column of drag handles: a [`GridDragHandle`](/components/row-drag) in every cell. The header
holds the column's `label`, `'Drag'` by default, as visually hidden text, so the column header has
a name for screen readers; pass `label` in the language of the page. Pinned to the start by default,
32 px wide. Import it from `@vue-data-grid/core/drag-and-drop`.

```ts
dragHandleColumn(options?: ServiceColumnOptions): ColumnInput<TRow, null>
```

### ServiceColumnOptions

What a service column lets you change:

<PropsTable
	label="Option"
	:data="[
		{ name: 'label', type: 'string', description: 'The name of the column, for a columns menu and CSV headers.' },
		{ name: 'width', type: 'number', description: 'The width, px.' },
		{ name: 'minWidth', type: 'number', description: 'The narrowest width, px.' },
		{ name: 'maxWidth', type: 'number', description: 'The widest width, px.' },
		{ name: 'pinned', type: '\'start\' | \'end\'', description: 'The side the column is pinned to; `selectionColumn` and `dragHandleColumn` pin to the start.' },
		{ name: 'align', type: '\'left\' | \'center\' | \'right\'', description: 'How the content is aligned.' },
		{ name: 'pinnable', type: 'boolean', description: 'Whether the user may pin and unpin it.' },
		{ name: 'movable', type: 'boolean', description: 'Whether the user may move it.' },
		{ name: 'resizable', type: 'boolean', description: 'Whether the user may resize it.' },
		{ name: 'hideable', type: 'boolean', description: 'Whether the user may hide it.' },
	]"
/>

The data attributes of the parts inside are on their own pages: the
[selection checkbox](/components/selection-checkbox), the [tree toggle](/components/tree-toggle)
and the [drag handle](/components/row-drag). A cell of `treeColumn()` has an indent element, and the
header of `dragHandleColumn()` a hidden label:

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['tree-indent', 'hidden-label'] },
	]"
/>

<CssVariablesTable
	:data="[
		{ name: '--dg-tree-indent', default: '16px', description: 'The indent of one level in a cell of `treeColumn()`.' },
		{ name: '--dg-level', description: 'Set inline on the indent: the level of the row, from which its width is computed.' },
	]"
/>

## Examples

### A service column of your own

Any column with `kind: 'service'` is furniture: an actions menu, a status light. Declare it as a
column, and CSV, ranges and autosize leave it out:

```ts
const columns = defineColumns({
	actions: column(() => null, {
		kind: 'service',
		label: 'Actions',
		width: 48,
		pinned: 'end',
		cell: ({ row }) => h(RowMenu, { invoice: row }),
	}),
});
```

### Row numbers that name the rows

In a grid of numbers the row number is what names a row, as in a spreadsheet:

```ts
const columns = defineColumns({
	number: rowNumberColumn({ rowHeader: true, pinned: 'start' }),
});
```

### Dragging a tree by its handles

The demo reorders the tree with `moveRow`, which puts the row under its new parent:

```ts
import { moveRow } from '@vue-data-grid/core';

function drop({ key, parent, index }: GridRowDropEvent<unknown>) {
	const row = rows.value.find(item => item.id === key);

	if (row) {
		rows.value = moveRow(rows.value, { key, row, parent, index }, { rowKey: 'id', parentKey: 'parent' });
	}
}
```

## Accessibility

- Service columns are columns of the grid: their cells have roles and `aria-colindex` like any other,
  so a screen reader counts them.
- The first data column names each row, `role="rowheader"`, never a service column, unless you mark
  one with `rowHeader: true`. A row of a checkbox, a number and a title is named by its title.
- The checkboxes, toggles and handles inside are named by the grid's messages: "Select row",
  "Expand", "Drag Build the landing page".
- With the `navigation` feature, <kbd>Enter</kbd> or <kbd>Space</kbd> on a cell whose only content is
  a checkbox or a button presses it, so a selection column is used without leaving the grid.
