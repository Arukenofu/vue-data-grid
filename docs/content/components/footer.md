---
title: Footer
description: The sticky footer of the table, with totals and other aggregates of its columns.
---

# Footer

<Description>
The sticky footer at the bottom of the table: totals, averages and anything else a column can
compute over its rows.
</Description>

<Demo name="part-footer" />

## Features

<Highlights
	:features="[
		'Sticks to the bottom of the table, and is measured so that scrolling to a row never hides it under the footer.',
		'Built-in aggregates: `sum`, `avg`, `min`, `max` and `count`, or a function of your own.',
		'The column\'s `footer` field gets its aggregate typed by the kind of `aggregate`.',
		'Aggregates follow the rows: filter the rows and the totals follow.',
		'In a tree, footers count the leaves, collapsed ones included, never the group rows.',
		'As many footer rows as you want, each counted into `aria-rowcount`.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { TableFooter, TableFooterCell, TableFooterRow } from 'vue-data-grid';
</script>

<template>
	<TableFooter>
		<TableFooterRow v-slot="{ columns }">
			<TableFooterCell v-for="column in columns" :key="column.key" :column="column" />
		</TableFooterRow>
	</TableFooter>
</template>
```

What a footer cell shows is declared with the column: an `aggregate` to compute, and a `footer` to
render it.

```ts
const columns = defineColumns({
	revenue: column(sale => sale.revenue, {
		label: 'Revenue',
		aggregate: 'sum',
		footer: ({ aggregate }) => money.format(aggregate ?? 0),
	}),
});
```

## API reference

### TableFooter

The block of footer rows. It sticks to the bottom of the scroll container and is measured: its
height becomes the engine's `scrollMarginEnd`, so the keyboard and `scrollToRow` keep rows clear of
it.

<PropsTable
	:data="[
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', description: 'The `TableFooterRow`s of the footer.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-tc-part]', values: ['foot'] },
	]"
/>

### TableFooterRow

A footer row. It counts itself into the table's `aria-rowcount` while it is mounted.

<PropsTable
	:data="[
		{ name: 'index', type: 'number', default: '0', description: 'The place of the row among the footer rows.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ columns: RenderedColumn[] }', description: 'The rendered columns, for a `TableFooterCell` each.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-tc-part]', values: ['row'] },
		{ attribute: '[data-tc-grid-section]', values: ['foot'] },
		{ attribute: '[data-tc-grid-row]', values: 'The index of the row among the footer rows.' },
	]"
/>

### TableFooterCell

A footer cell of a column, with the geometry of its column. Without a slot it shows its content as
`TableFooterContent` does. It renders again whenever the rows change.

<PropsTable
	:data="[
		{ name: 'column', type: 'RenderedColumn', required: true, description: 'The column, from the slot of `TableFooterRow`.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ column: RuntimeColumn; rows: unknown[]; aggregate: unknown }', description: '`rows` are the rows the footer counts, the table\'s `leaves`; `aggregate` is the column\'s `aggregate` over them, `undefined` without one.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-tc-column]', values: 'The name of the column.' },
		{ attribute: '[data-tc-pinned]', values: ['start', 'end'] },
		{ attribute: '[data-tc-align]', values: ['center', 'right'] },
	]"
/>

### TableFooterContent

The content of the footer cell it is in: what the column's `footer` field returns. Text is cut to one
line with an ellipsis, a node is shown as it is. It renders no element of its own; put it in the slot
to keep it next to content of your own.

<DataAttributesTable
	:data="[
		{ attribute: '[data-tc-part]', values: ['cell-text'] },
	]"
/>

### Aggregates

What a column's `aggregate` can be, and what its `footer` then gets:

<PropsTable
	label="Aggregate"
	:data="[
		{ name: '\'sum\'', type: 'number | null', description: 'The sum of the finite numbers; `null` when there are none.' },
		{ name: '\'avg\'', type: 'number | null', description: 'Their average; `null` when there are none.' },
		{ name: '\'min\'', type: 'TValue | null', description: 'The smallest value, empty ones skipped, by the column\'s `compare`.' },
		{ name: '\'max\'', type: 'TValue | null', description: 'The largest value, the same way.' },
		{ name: '\'count\'', type: 'number', description: 'The number of rows.' },
		{ name: '(values, rows) => T', type: 'T', description: 'A function of the column\'s values and the rows: a weighted average, a distinct count, a median.' },
	]"
/>

## Examples

### An aggregate of your own

A function gets the values of the column and the rows themselves. The margin in the demo is weighted
by revenue, which an average of the row margins would not be:

```ts
margin: column(sale => (sale.revenue - sale.cost) / sale.revenue, {
	label: 'Margin',
	aggregate: (_margins, rows) => {
		let revenue = 0;
		let profit = 0;

		for (const sale of rows) {
			revenue += sale.revenue;
			profit += sale.revenue - sale.cost;
		}

		return revenue === 0 ? 0 : profit / revenue;
	},
	footer: ({ aggregate }) => `${Math.round(aggregate * 100)}%`,
}),
```

Put `aggregate` before `footer` in the object: TypeScript types the functions of an object literal in
order, so `footer` then knows what the aggregate returns.

### A second row from the slot

A footer row whose cells have a slot computes whatever it wants from `rows`. The demo's second row
averages some columns and leaves the others empty:

```vue
<TableFooterRow v-slot="{ columns }" :index="1">
	<TableFooterCell v-for="column in columns" :key="column.key" v-slot="{ column: declared, rows }" :column="column">
		{{ average(declared, rows) }}
	</TableFooterCell>
</TableFooterRow>
```

## Accessibility

- Footer rows are rows of the grid: `role="row"` with `aria-rowindex` after the last body row, and
  they count into the table's `aria-rowcount` while they are mounted.
- Footer cells are `gridcell`s with `aria-colindex`, so a screen reader reads "Revenue, $1,204,380"
  with the column header of the cell.
- With the `navigation` feature the footer is the last section of the grid: <kbd>↓</kbd> from the
  last body row moves into it, and <kbd>Ctrl</kbd>+<kbd>End</kbd> goes to its last cell.
