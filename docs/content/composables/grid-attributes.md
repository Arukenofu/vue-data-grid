---
title: Grid attributes
description: The attributes the keyboard finds rows and cells by, and the column index props of cells under the column window.
---

# Grid attributes

<Description>
The grid navigation finds rows and cells by attributes, not by their place in the DOM, and a cell
says its column position with <code>aria-colindex</code>. The prop-getters put all of this on the parts; these
helpers are for markup of your own.
</Description>

## Usage

A row of your own, such as a summary row inside the body, joins the grid with its section and index,
and a cell of it that is not a column cell with its key:

```vue
<script setup lang="ts">
import { getGridCellAttributes, getGridRowAttributes } from '@vue-stack/table';
</script>

<template>
	<div role="row" v-bind="getGridRowAttributes('summary', 0)">
		<div role="gridcell" tabindex="-1" v-bind="getGridCellAttributes('total')">Total</div>
	</div>
</template>
```

A column cell needs none of this: it is found by its `data-tc-column`, which the core puts on
`cellProps` and `headerProps`.

## Grid attributes

<ReturnsTable
	:data="[
		{ name: 'getGridRowAttributes', type: '(section: string, row: number) => Record<string, string | number>', description: 'The section a row belongs to and its index there: `data-tc-grid-section` and `data-tc-grid-row`.' },
		{ name: 'getGridCellAttributes', type: '(key: string) => Readonly<Record<string, string>>', description: 'The key of a cell that is not a column cell, `data-tc-grid-cell`: one frozen object per key.' },
		{ name: 'readGridPosition', type: '(cell: Element) => GridPosition | null', description: 'The position of a cell element, `{ section, row, cell }`, from its attributes and its row\'s; `null` for an element that is not a cell of the grid.' },
		{ name: 'findGridRow', type: '(grid: ParentNode, section: string, row: number) => HTMLElement | null', description: 'The element of a row; `null` while it is not rendered.' },
		{ name: 'findGridCell', type: '(grid: ParentNode, position: GridPosition) => HTMLElement | null', description: 'The element of a cell; `null` while it is not rendered.' },
		{ name: 'BODY_SECTION', type: '\'body\'', description: 'The name of the section of body rows, as the prop-getters name it.' },
	]"
/>

`useTableProps` returns the sections it puts rows in as `sections`, ready for `useGridNavigation`:
the rows of the header, `body` for the rows of the scope, and `foot` for the footer rows. A row of
your own joins one of them, or a section you add to the list.

## Index props

<ReturnsTable
	:data="[
		{ name: 'getColumnIndexProps', type: '(index: number) => Readonly<Record<string, number>>', description: '`aria-colindex` of a column cell from its index among the shown columns: one frozen object per position, shared by all rows and tables. Nothing for a spacer, `-1`.' },
		{ name: 'getGroupIndexProps', type: '(cell: { index: number; span: number }) => Readonly<Record<string, number>>', description: '`aria-colindex` and `aria-colspan` of a group cell: one frozen object per pair. Nothing for a spacer.' },
	]"
/>

```ts
import { getColumnIndexProps, getGroupIndexProps } from '@vue-stack/table';

getColumnIndexProps(2); // { 'aria-colindex': 3 }
getGroupIndexProps({ index: 1, span: 3 }); // { 'aria-colindex': 2, 'aria-colspan': 3 }
```

Cells need them wherever their order in the DOM differs from the logical one, such as under the
column window, where the first rendered column may be the twelfth. `getCellProps` and
`getHeaderCellProps` include them already.

## Examples

### Details on a click

`readGridPosition` turns any element inside a cell into its place in the grid:

```ts
import { readGridPosition } from '@vue-stack/table';

function onPointerdown(event: PointerEvent) {
	const cell = event.target instanceof Element ? event.target.closest('[data-tc-column]') : null;
	const position = cell ? readGridPosition(cell) : null;

	if (position?.section === 'body') {
		showDetails(table.rows.value[position.row], position.cell);
	}
}
```

### Focusing a cell yourself

With the navigation feature, prefer `table.navigation.focusCell`, which scrolls the cell into view
and renders it first. Without it, `findGridCell` finds a rendered one:

```ts
findGridCell(table.root.value, { section: 'body', row: 0, cell: 'name' })?.focus();
```

## Accessibility

- The keyboard of the grid depends on these attributes: a row or cell of your own without them is
  skipped by the arrow keys, and focus cannot land on it.
- `aria-colindex` keeps the position of a cell right for a screen reader when the column window
  leaves columns out of the DOM; without it, "column 3" would be read for what is column 12.
- A cell of your own in the grid needs `tabindex="-1"`, as the prop-getters give with navigation, so
  it can take focus without becoming a Tab stop.

## See also

- [useTableProps](/composables/use-table-props): the prop-getters that apply these.
- [useGridNavigation](/composables/use-grid-navigation): the keyboard that reads them.
- [Your own markup](/guides/custom-markup)
