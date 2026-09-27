---
title: Columns
description: Declare columns once, with types that flow from your rows into every cell, header and footer.
---

# Columns

<Description>
A column is a function that reads a value from a row, plus the few facts the table needs to show it:
a label, a width, an alignment, and how to render its cells when plain text is not enough.
</Description>

<Demo name="columns" />

## Defining columns

`defineColumn` binds a column builder to your row type. Every column the builder makes knows what a
row is, and infers its value type from the function you give it:

```ts
import { defineColumn, defineColumns } from '@vue-stack/table';

const column = defineColumn<Invoice>();

const columns = defineColumns({
	number: column(invoice => invoice.number, { label: 'Invoice', width: 116 }),
	customer: column(invoice => invoice.customer, { label: 'Customer', flex: 1 }),
	amount: column(invoice => invoice.amount, { label: 'Amount', align: 'right' }),
});
```

`defineColumns` takes an object: its keys become the names of the columns, typed as literals, so a
sort or a layout that names a column that does not exist fails to compile. The value of `amount` is
a `number` from here on: its `format`, `compare`, `cell` and `footer` all receive a number without a
single type annotation.

Columns can also be an array, or a `ref` or getter of either, when the set of columns changes at
run time. The table then reconciles the new set against the old one field by field, and keeps every
column that did not change as the same object, so its cells do not render again.

::: warning Declare columns outside of `computed`
A `computed` that builds columns makes new arrow functions every time it runs. The table can only
compare functions by reference, so it sees every column as changed and renders all of their cells.
It warns about it in development. Keep the declarations at the top of the module, and let a
`computed` pick which of them to show.
:::

## Values and text

`value` is the one required field. Sorting, grouping, totals and the default cell all read it.

<PropsTable
	label="Field"
	:data="[
		{ name: 'value', type: '(row: TRow) => TValue', required: true, description: 'Reads the value of the cell from the row.' },
		{ name: 'label', type: 'string', description: 'The name of the column for people: the header text, the CSV header, the names of its controls. The column name without it.' },
		{ name: 'format', type: '(value: TValue, row: TRow) => string', description: 'The value as text: what the default cell shows, what CSV, copying and autosize read. `String(value)` by default, and `\'\'` for `null` and `undefined`.' },
		{ name: 'equals', type: '(current: TValue, next: TValue) => boolean', description: 'Equality for values that arrive as new objects, such as dates. `Object.is` by default.' },
		{ name: 'compare', type: '(a: TValue, b: TValue) => number', description: 'The order of values when sorting. See the Sorting guide.' },
		{ name: 'meta', type: 'TMeta', description: 'Your own data about the column. The table never reads it; type it with the second parameter of `defineColumn`.' },
	]"
/>

Keep `format` a pure function of the value: it decides the text of the cell, and it is also what a
copy to the clipboard or a CSV export writes, so both show exactly what people see.

## Size and alignment

Widths are in pixels. A column with `flex` grows into the room the other columns leave, in
proportion to its `flex`, as a flex item does in CSS.

<PropsTable
	label="Field"
	:data="[
		{ name: 'width', type: 'number', default: '120', description: 'The width of the column, px.' },
		{ name: 'minWidth', type: 'number', default: 'min(width, 120)', description: 'The narrowest a resize can make it, px.' },
		{ name: 'maxWidth', type: 'number', description: 'The widest a resize or a fit can make it, px.' },
		{ name: 'flex', type: 'number', default: '0', description: 'How much of the room left in the row the column takes.' },
		{ name: 'align', type: '\'left\' | \'center\' | \'right\'', default: '\'left\'', description: 'Where the content of its cells sits. The table marks cells with `data-tc-align`; the structural styles lay them out.' },
		{ name: 'pinned', type: '\'start\' | \'end\'', description: 'Pins the column to an edge, where it stays while the rest scrolls. See the Column layout guide.' },
		{ name: 'hiddenByDefault', type: 'boolean', default: 'false', description: 'The column starts hidden, and can be shown from a column menu.' },
	]"
/>

The table writes widths into CSS variables rather than into each cell. When a width changes, one
style changes and the browser lays the column out again, without rendering a single cell. That is
why resizing a column of a thousand rows stays smooth.

## Rendering cells

Without anything else, a cell shows the text of `format` on one line, cut with an ellipsis. When a
cell needs more, give its column a `cell` field: a function of the cell's context that returns what
to render, as a render function does.

```ts
import { h } from 'vue';

const columns = defineColumns({
	status: column(invoice => invoice.status, {
		label: 'Status',
		format: status => STATUS[status].label,
		cell: ({ value }) => h(UiBadge, { tone: STATUS[value].tone }, () => STATUS[value].label),
	}),
	customer: column(invoice => invoice.customer, {
		label: 'Customer',
		cell: ({ row }) => h(CustomerCell, { name: row.customer, email: row.email }),
	}),
});
```

The context is typed by the column: `value` is the value of the column, `row` is your row.

<PropsTable
	label="Context"
	:data="[
		{ name: 'row', type: 'TRow', description: 'The row of the cell.' },
		{ name: 'value', type: 'TValue', description: 'The value of the column for that row.' },
		{ name: 'key', type: 'string', description: 'The key of the row.' },
		{ name: 'index', type: 'number', description: 'The place of the row among the rows the table shows, from `0`.' },
		{ name: 'column', type: 'RuntimeColumn', description: 'The column itself.' },
		{ name: 'node', type: 'RowNode | undefined', description: 'The place of the row in a tree: its level, parent and expand state. `undefined` in a flat table.' },
		{ name: 'write', type: '(value: TValue) => void', description: 'Writes a value into the cell at once, for a control in the cell. Present only with the `editing` feature, on a cell that can be edited.' },
	]"
/>

For anything more than a line or two, render a small component of your own, as `CustomerCell` does
in the demo: the cell stays declarative, typed by its props, and styled by its own scoped CSS.

`cellClass` adds classes to the cell element itself, from the same context. Use it for a look that
depends on the value, such as a negative amount in red:

```ts
amount: column(invoice => invoice.amount, {
	cellClass: ({ value }) => (value < 0 ? 'negative' : undefined),
}),
```

### From the template instead

`TableCells` takes a slot too. It runs for every cell, and a cell the slot renders nothing for keeps
its own content, as a `<slot>` keeps its fallback. That makes the slot handy for a quick change in
the template:

```vue
<TableCells v-slot="{ column, value }">
	<strong v-if="column.name === 'number'">{{ value }}</strong>
</TableCells>
```

The slot is shared by every column, so it cannot know the type of your rows: `row` and `value` are
`unknown` there. For typed content, the `cell` field is the better home.

### Headers and footers

`header` renders the header cell when the label is not enough, and gets the column and its sort
state. `footer` renders the footer cell. With an `aggregate`, the footer receives the total of the
column over the rows, typed by the aggregate:

```ts
amount: column(invoice => invoice.amount, {
	label: 'Amount',
	aggregate: 'sum',
	footer: ({ aggregate }) => money.format(aggregate ?? 0),
}),
```

`aggregate` is `'sum'`, `'avg'`, `'min'`, `'max'`, `'count'`, or a function of the values and the rows.
`sum` and `avg` count finite numbers only and give `null` when there are none, which is why the
footer above falls back to zero. Put `aggregate` before `footer` in the object: TypeScript types the
functions of an object literal in order. Group rows use the same aggregates; see
[Trees and grouping](/guides/trees-and-grouping).

## Defaults for every column

The builder takes defaults that every column it makes starts with, and each column can override.
It is the place for what a whole table shares, such as its rights:

```ts
const column = defineColumn<Invoice>({ sortable: true, resizable: true, width: 140 });
```

Defaults cover the kind, the rights, the geometry, `sortOrder` and `editable`.

## Rights

A table does only what a column allows. Every right is `false` until you turn it on, for the whole
table in the builder's defaults or column by column:

| Right | What it allows |
| --- | --- |
| `sortable` | A header click or <kbd>Enter</kbd> sorts by the column. |
| `resizable` | A resize handle, <kbd>Shift</kbd> with the arrows in the header, and autosize change its width. |
| `movable` | Dragging the header, or <kbd>Alt</kbd> with the arrows, moves the column. |
| `hideable` | The column can be hidden and shown again. |
| `pinnable` | The column can be pinned to an edge and unpinned. |

## Service columns and row headers

Most columns hold data. Some are the table's own furniture: a checkbox, a row number, a drag handle.
Mark those `kind: 'service'`, and CSV, cell ranges, copying and autosize leave them out. The table
ships factories for the usual ones, `selectionColumn()`, `rowNumberColumn()`, `treeColumn()` and
`dragHandleColumn()`; see [Service columns](/components/service-columns).

One column names each row for assistive technology: its cells get `role="rowheader"`, and a screen
reader reads them when focus moves along a column. By default it is the first data column. Set
`rowHeader: true` on the columns that should name the row instead, or `rowHeader: false` on the first
one to have none. The column window of a [virtualized](/guides/virtualization) table always keeps a
row header rendered, so a row keeps its name while it is scrolled sideways.

## Accessibility

- Header cells get `role="columnheader"` and `aria-colindex`, body cells `role="gridcell"` or
  `role="rowheader"`, so every cell can be announced with its row and column.
- The label is the name of the column's controls: a resize handle is announced as "Resize Amount",
  and the announcer says "Sorted by Amount descending".
- When a `header` renders only an icon, keep a text for screen readers inside it, visually hidden,
  or the column has no name.
- A row header column lets people moving down a column hear which row they are on. Choose the column
  that names the row best, such as a name or a number.

## See also

- [Sorting](/guides/sorting): `sortable`, `compare` and `sortOrder` at work.
- [Column layout](/guides/column-layout): widths, pinning, hiding and order.
- [Body](/components/body): `TableCells` and its slot in detail.
- [Service columns](/components/service-columns): the ready-made columns of the table.
