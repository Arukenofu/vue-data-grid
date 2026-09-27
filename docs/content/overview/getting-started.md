---
title: Getting started
description: From an empty component to a sortable table in four small steps.
---

# Getting started

<Description>
From an empty component to a sortable table in four small steps. Each step adds one idea, so by the
end you know what every line is for.
</Description>

## Installation

Install the package with the package manager you use:

<InstallTabs />

Vue 3.5 or later is a peer dependency. `@vue-stack/table` also brings the table core and the
animation engines with it, so this one package is all you import from.

Then import the structural styles once, in your app's entry file:

```ts
import '@vue-stack/table/style.css';
```

They hold only what a table needs to work: rows laid out as flex lines, a sticky header, pinned
columns that stay opaque, the grab area of a resize handle. Every rule is wrapped in `:where()`, so
it has zero specificity and your own CSS always wins. Colours, fonts and spacing are yours.

## 1. Describe the columns

A column is a function that reads a value from a row, plus a few facts about how to show it.
`defineColumn` binds a builder to your row type once, so every column after it knows what a row is
and what its value is:

```ts
import { defineColumn, defineColumns } from '@vue-stack/table';

interface Person {
	id: string;
	name: string;
	role: string;
	team: string;
	salary: number;
}

const column = defineColumn<Person>();

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name', width: 170 }),
	role: column(person => person.role, { label: 'Role', flex: 1 }),
	team: column(person => person.team, { label: 'Team', width: 130 }),
	salary: column(person => person.salary, {
		label: 'Salary',
		align: 'right',
		format: salary => `$${salary.toLocaleString('en-US')}`,
	}),
});
```

The object keys become the column names. `format` turns the value into the text of the cell; the
value itself stays a number, so sorting and totals keep working with numbers. `width` is in pixels,
and `flex` lets a column take the room that is left, as in CSS.

::: tip Declare columns once
Columns are compared by reference to decide what to re-render. Declare them at the top of
`<script setup>` or in a module, not inside a `computed` that rebuilds them on every change.
:::

## 2. Create the table

`useDataTable` turns columns and rows into a table object: everything the parts need to render, in
one place.

```ts
import { useDataTable } from '@vue-stack/table';

const table = useDataTable({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
});
```

- `rows` is an array, a `ref` of one or a getter. The table follows it: replace the array and the
  table shows the new rows.
- `rowKey` names the field that identifies a row, or is a function of the row. Keys let the table
  keep a row's state, such as focus or selection, while rows move around.
- `rowHeight` is the height of a row in pixels. Rows are positioned by it, which is what lets the
  table render only the rows in view once you turn on [virtualization](/guides/virtualization).

## 3. Render it from parts

The table object goes to `TableRoot`, and the parts inside read it from there. Each part renders
one element and gives its slot what the next level needs: the header row gives you its columns, the
body gives you its rows.

```vue
<template>
	<TableRoot :table="table" label="People" class="people">
		<TableHeader>
			<TableHeaderRow v-slot="{ columns }">
				<TableHeaderCell v-for="column in columns" :key="column.key" :column="column" />
			</TableHeaderRow>
		</TableHeader>
		<TableBody v-slot="{ rows }">
			<TableRow v-for="row in rows" :key="row.key" :row="row">
				<TableCells />
			</TableRow>
		</TableBody>
	</TableRoot>
</template>

<style>
.people {
	height: 400px;
}
</style>
```

A few things worth knowing already:

- `TableRoot` is the scroll container. Give it a height, and the header sticks to its top while the
  rows scroll under it.
- `label` is the accessible name of the table. Screen readers announce it when focus enters the
  table; use `aria-labelledby` instead when a visible heading names it.
- `TableCells` renders all the cells of a row at once, as plain elements. A row costs one component
  however many columns it has, which keeps large tables cheap.

## 4. Add a feature: sorting

A table does nothing it was not asked to. Behaviour comes in as **features**, each from a small
factory, so the code of a feature you do not use never reaches your bundle:

```ts
import { sorting } from '@vue-stack/table';

const column = defineColumn<Person>({ sortable: true });

const table = useDataTable({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	multiSort: true,
	features: { sorting: sorting() },
});
```

`sortable: true` in the defaults of the builder makes every column sortable, and `multiSort` lets a
header click with <kbd>Shift</kbd> add a column to the sort instead of replacing it. Put a
`TableSortIndicator` in each header cell to show the direction, and a `TableHeaderContent` next to
it for the label, which the cell showed on its own while it had no slot:

```vue
<TableHeaderCell v-for="column in columns" :key="column.key" :column="column">
	<TableHeaderContent />
	<TableSortIndicator />
</TableHeaderCell>
```

Here is the whole component. Click a header to sort, click again to reverse, a third time to go back
to the original order; hold <kbd>Shift</kbd> to sort by several columns. The first click sorts
descending, the order most data tables start with; a column's `sortOrder` changes it.

<Demo name="quick-start" />

The header cells now have `aria-sort`, the table announces the new order to screen readers, and
<kbd>Enter</kbd> on a focused header sorts too. You did not write any of that.

## Where to go next

- [How it fits together](/overview/concepts): the few ideas the whole library is built on.
- [Styling](/overview/styling): the attributes and CSS variables to theme a table with.
- [Columns](/guides/columns): custom cells, alignment, formats and the rest of the column API.
- [Examples](/examples/): complete tables to take apart.
