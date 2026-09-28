---
title: Getting started
description: From an empty component to a sortable grid in four small steps.
---

# Getting started

<Description>
From an empty component to a sortable grid in four small steps. Each step adds one idea, so by the
end you know what every line is for.
</Description>

## Installation

Install the package with the package manager you use:

<InstallTabs />

Vue 3.5 or later is a peer dependency. `@vue-data-grid/core` also brings the grid core and the
animation engines with it, so this one package is all you import from.

Then import the structural styles once, in your app's entry file:

```ts
import '@vue-data-grid/core/style.css';
```

They hold only what a grid needs to work: rows laid out as flex lines, a sticky header, pinned
columns that stay opaque, the grab area of a resize handle. Every rule is wrapped in `:where()`, so
it has zero specificity and your own CSS always wins. Colours, fonts and spacing are yours.

## 1. Describe the columns

A column is a function that reads a value from a row, plus a few facts about how to show it.
`defineColumn` binds a builder to your row type once, so every column after it knows what a row is
and what its value is:

```ts
import { defineColumn, defineColumns } from '@vue-data-grid/core';

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

## 2. Create the grid

`useDataGrid` turns columns and rows into a grid object: everything the parts need to render, in
one place.

```ts
import { useDataGrid } from '@vue-data-grid/core';

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
});
```

- `rows` is an array, a `ref` of one or a getter. The grid follows it: replace the array and the
  grid shows the new rows.
- `rowKey` names the field that identifies a row, or is a function of the row. Keys let the grid
  keep a row's state, such as focus or selection, while rows move around.
- `rowHeight` is the height of a row in pixels. Rows are positioned by it, which is what lets the
  grid render only the rows in view once you turn on [virtualization](/guides/virtualization).

## 3. Render it from parts

The grid object goes to `GridRoot`, and the parts inside read it from there. Each part renders
one element and gives its slot what the next level needs: the header row gives you its columns, the
body gives you its rows.

```vue
<template>
	<GridRoot :grid="grid" label="People" class="people">
		<GridHeader>
			<GridHeaderRow v-slot="{ columns }">
				<GridHeaderCell v-for="column in columns" :key="column.key" :column="column" />
			</GridHeaderRow>
		</GridHeader>
		<GridBody v-slot="{ rows }">
			<GridRow v-for="row in rows" :key="row.key" :row="row">
				<GridCells />
			</GridRow>
		</GridBody>
	</GridRoot>
</template>

<style>
.people {
	height: 400px;
}
</style>
```

A few things worth knowing already:

- `GridRoot` is the scroll container. Give it a height, and the header sticks to its top while the
  rows scroll under it.
- `label` is the accessible name of the grid. Screen readers announce it when focus enters the
  grid; use `aria-labelledby` instead when a visible heading names it.
- `GridCells` renders all the cells of a row at once, as plain elements. A row costs one component
  however many columns it has, which keeps large grids cheap.

## 4. Add a feature: sorting

A grid does nothing it was not asked to. Behaviour comes in as **features**, each from a small
factory, so the code of a feature you do not use never reaches your bundle:

```ts
import { sorting } from '@vue-data-grid/core';

const column = defineColumn<Person>({ sortable: true });

const grid = useDataGrid({
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
`GridSortIndicator` in each header cell to show the direction, and a `GridHeaderContent` next to
it for the label, which the cell showed on its own while it had no slot:

```vue
<GridHeaderCell v-for="column in columns" :key="column.key" :column="column">
	<GridHeaderContent />
	<GridSortIndicator />
</GridHeaderCell>
```

Here is the whole component. Click a header to sort, click again to reverse, a third time to go back
to the original order; hold <kbd>Shift</kbd> to sort by several columns. The first click sorts
descending, the order most data grids start with; a column's `sortOrder` changes it.

<Demo name="quick-start" />

The header cells now have `aria-sort`, the grid announces the new order to screen readers, and
<kbd>Enter</kbd> on a focused header sorts too. You did not write any of that.

## Where to go next

- [How it fits together](/overview/concepts): the few ideas the whole library is built on.
- [Styling](/overview/styling): the attributes and CSS variables to theme a grid with.
- [Columns](/guides/columns): custom cells, alignment, formats and the rest of the column API.
- [Examples](/examples/): complete grids to take apart.
