---
title: Header
description: The sticky header of the grid, its row of column headers and the header cells that sort, move and resize their columns.
---

# Header

<Description>
The sticky header of the grid: a row of column headers whose cells sort, move and resize their
columns, from the pointer and from the keyboard.
</Description>

<Demo name="part-header" />

## Features

<Highlights
	:features="[
		'Sticks to the top of the grid, and is measured so that scrolling to a row never leaves it under the header.',
		'A click or Enter sorts a `sortable` column; Shift adds it to a multi-sort.',
		'Alt with ← and → moves a `movable` column, Shift with ← and → resizes a `resizable` one.',
		'Renders the column\'s `header` field or its label, or anything you put in the slot.',
		'Keeps the geometry of the column, its width and its pin, in step with the body without a render.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import {
	GridHeader,
	GridHeaderCell,
	GridHeaderContent,
	GridHeaderRow,
	GridResizeHandle,
	GridSortIndicator,
} from '@vue-data-grid/core';
</script>

<template>
	<GridHeader>
		<GridHeaderRow v-slot="{ columns }">
			<GridHeaderCell v-for="column in columns" :key="column.key" :column="column">
				<GridHeaderContent />
				<GridSortIndicator />
				<GridResizeHandle />
			</GridHeaderCell>
		</GridHeaderRow>
	</GridHeader>
</template>
```

Group rows of [column groups](/components/column-groups) go into the same `GridHeader`, above the
`GridHeaderRow`.

## API reference

### GridHeader

The block of header rows. It sticks to the top of the scroll container and is measured with a
`ResizeObserver`: its height becomes the engine's `scrollMargin`, so `scrollToRow` and the keyboard
never leave a row hidden under it.

<PropsTable
	:data="[
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ groups: RenderedGroup[][]; columns: RenderedColumn[] }', description: 'The cells of each group row, from the top, for a `GridGroupRow` each, and the rendered columns.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['head'] },
	]"
/>

### GridHeaderRow

The row of column headers. Its slot gets the rendered columns: the shown columns in display order,
and with a column window the spacers that stand for the columns out of view.

<PropsTable
	:data="[
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ columns: RenderedColumn[] }', description: 'The columns to render a `GridHeaderCell` for, each with a `key` for `v-for`.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['row'] },
		{ attribute: '[data-dg-grid-section]', values: ['head'] },
		{ attribute: '[data-dg-grid-row]', values: 'The index of the row in its section, `0`: where the keyboard navigation finds it.' },
	]"
/>

### GridHeaderCell

A column header. It carries the width and the pin of its column, sorts on a click or Enter, and
gives the parts inside, such as a sort indicator or a resize handle, their column. Inside a
[`GridColumnDrag`](/components/column-drag) it also registers itself, so the column can be dragged
by its header.

Without a slot the cell shows its content as `GridHeaderContent` does. A spacer of the column
window renders an empty cell with `role="presentation"`.

<PropsTable
	:data="[
		{ name: 'column', type: 'RenderedColumn', required: true, description: 'The column, from the slot of `GridHeaderRow`.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ column: RuntimeColumn; direction?: SortDirection; sortIndex?: number }', description: 'The declared column, its sort direction, and its place in a multi-sort, from `1`; `sortIndex` is `undefined` while one column sorts.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-column]', values: 'The name of the column.' },
		{ attribute: '[data-dg-pinned]', values: ['start', 'end'] },
		{ attribute: '[data-dg-align]', values: ['center', 'right'] },
		{ attribute: '[data-dg-rowspan]', values: 'How many rows the header spans: set for a column without a group in the group rows right above it, which it reaches up over.' },
		{ attribute: '[data-dg-draggable]', values: 'Present while the column can be dragged, inside a `GridColumnDrag`.' },
	]"
/>

<CssVariablesTable
	:data="[
		{ name: '--dg-head-background', default: 'var(--dg-background, Canvas)', description: 'The background of the header and of its pinned cells.' },
		{ name: '--dg-cell-padding', default: '0 8px', description: 'The padding of every cell, header cells included.' },
	]"
/>

### GridHeaderContent

The content of the header cell it is in: the column's `header` field when it has one, else its
`label` (or name) on one line, cut with an ellipsis. It renders no element of its own. You need it
only when the cell has a slot, to keep the default content next to parts of your own.

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['cell-text'] },
	]"
/>

## Examples

### Content next to the label

The slot of a cell replaces its content. Put `GridHeaderContent` in it to keep the label, and
anything else around it, such as an icon:

```vue
<GridHeaderCell v-for="column in columns" :key="column.key" :column="column" v-slot="{ column: declared }">
	<component :is="icons[declared.name]" class="header-icon" aria-hidden="true" />
	<GridHeaderContent />
	<GridSortIndicator />
</GridHeaderCell>
```

### A header declared with the column

When a header is the same wherever the column is shown, declare it with the column instead. The
`header` field gets the same context as the slot and returns what to render:

```ts
import { h } from 'vue';

const columns = defineColumns({
	price: column(stock => stock.price, {
		label: 'Price',
		header: () => h('span', { title: 'Last trade, USD' }, ['Price ', h('small', 'USD')]),
	}),
});
```

`GridHeaderContent` renders this field, so the slot and the default content stay in agreement.

### Columns that move and resize

A header cell does what the column's rights allow. Turn them on in the column, or in the defaults
of the builder for every column:

```ts
const column = defineColumn<Stock>({ sortable: true, resizable: true, movable: true });
```

The pinned `symbol` column in the demo says `movable: false`: it stays first.

## Accessibility

Adheres to the column header of the [Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/).

- Every header cell has `role="columnheader"` and `aria-colindex`, and the row of headers counts
  into `aria-rowindex` of the rows below it.
- The first column of the sort gets `aria-sort` of `ascending` or `descending`. ARIA has no sort
  levels, so the full multi-sort is announced by the live region of [`GridRoot`](/components/root)
  instead.
- Without the `navigation` feature, a header that sorts, moves or resizes is a Tab stop of its own
  (`tabindex="0"`). With it, header cells are cells of the grid, reached with the arrow keys.
- Clicks and keys of a control inside the cell, a menu button or the resize handle, stay with that
  control and do not sort.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'Space'], description: 'Sorts by the column: its next direction, or no sort after the last one.' },
		{ keys: ['Shift+Enter', 'Ctrl+Enter', 'Shift+Space'], description: 'Adds the column to the sort, or changes its direction there, with `multiSort` on.' },
		{ keys: ['Alt+←', 'Alt+→'], description: 'Moves a `movable` column one place, over a group that keeps together.' },
		{ keys: ['Shift+←', 'Shift+→'], description: 'Makes a `resizable` column narrower or wider by 16 px; the width is saved when the key is released.' },
	]"
/>

In a right-to-left grid ← and → swap, so they follow the reading direction.
