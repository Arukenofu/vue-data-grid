---
title: Root
description: The table element itself, the scroll container that every other part lives in.
---

# Root

<Description>
The table element itself: the scroll container with the role of a grid, which hands the table object
to every part inside it.
</Description>

<Demo name="quick-start" />

## Features

<Highlights
	:features="[
		'Renders the scroll container with `role=&quot;grid&quot;`, `treegrid` or `table`, and its row and column counts.',
		'Provides the table object to every part inside, so parts need no props to find it.',
		'Names the table for screen readers with `label`, or your own `aria-labelledby`.',
		'Announces sorting, selection and loading through a polite live region.',
		'Makes the grid one Tab stop when the table has the `navigation` feature.',
		'Takes the strings of the interface through `messages`, for any language.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { TableBody, TableHeader, TableRoot, useDataTable } from 'vue-data-grid';

const table = useDataTable({ columns, rows, rowKey: 'id', rowHeight: 40 });
</script>

<template>
	<TableRoot :table="table" label="Invoices">
		<TableHeader />
		<TableBody />
	</TableRoot>
</template>
```

`TableRoot` is the outermost part. Everything else, the header, the body, the footer and the states,
goes inside it, in the order you want them in the DOM.

## API reference

### TableRoot

The scroll container of the table. It renders a `div` with the props of `getGridProps()` and
provides the table and its messages to the parts inside. Attributes you put on it, such as `class`,
`style` or `aria-labelledby`, go to the table element.

<PropsTable
	:data="[
		{ name: 'table', type: 'DataTable', required: true, description: 'The table object from `useDataTable`. Read once: give a new table a new `key`.' },
		{ name: 'label', type: 'string', description: 'The accessible name of the table, when no visible heading names it through `aria-labelledby`.' },
		{ name: 'messages', type: 'Partial<TableMessages>', description: 'The strings of the interface over the English defaults: control names, the empty and loading states, announcements. Read once.' },
		{ name: 'announce', type: 'boolean', default: 'true', description: 'Announce the sort, the number of selected rows and loading to screen readers.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ table: DataTable }', description: 'The parts of the table. The table object is the same one you passed in.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-tc-part]', values: ['table'] },
	]"
/>

With the `navigation` feature, `TableRoot` also renders an empty focusable element right after the
table. Tab leaves the grid through it, so the grid is a single Tab stop. Next to the table stands
the live region of the announcer, `[data-tc-part="announcer"]`, hidden from sight by the
structural styles.

## Examples

### Naming the table with a heading

When the page shows a heading for the table, point at it rather than repeating its text:

```vue
<template>
	<h2 id="invoices-title">Invoices</h2>
	<TableRoot :table="table" aria-labelledby="invoices-title">
		<!-- … -->
	</TableRoot>
</template>
```

### Giving it a height

The root is a scroll container: the header sticks to its top and the rows scroll under it. Give it
a height, or a maximum height, from your own CSS:

```css
.invoices {
	height: 480px;
	border: 1px solid #e7e5e4;
	border-radius: 12px;
}
```

A table without a height grows with its rows and never scrolls itself, which is fine for a short
table in a page, but leaves nothing for [virtualization](/guides/virtualization) to window.

### Scoped styles

`TableRoot` renders several root nodes: the table, the exit element and the live region. Vue's
scoped styles of the parent reach a component with several roots only through `:deep()`, so style
the table from an element around it:

```vue
<style scoped>
.panel :deep([data-tc-part='table']) {
	height: 480px;
}
</style>
```

## Accessibility

Adheres to the [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and
[Treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) patterns of WAI-ARIA.

- The role is `grid`, or `treegrid` when the table has the `tree` feature. Pass `role: 'table'` to
  `useDataTable` for a static table that is only read, not moved through.
- `aria-rowcount` counts the header, body and footer rows, and `aria-colcount` the shown columns, so a
  screen reader knows the size of the table even while only part of it is rendered.
- `aria-multiselectable` is set while more than one row or cell can be selected, and `aria-busy`
  while a `TableLoading` is shown.
- The announcer tells what `aria-sort` cannot: the full sort in a multi-sort, how many rows are
  selected, and that the table is loading.

### Keyboard interactions

With the `navigation` feature the table is a single Tab stop, and the keys move through its cells.
The full list is on the [keyboard navigation](/guides/keyboard-navigation) page.

<KeyboardTable
	:data="[
		{ keys: ['Tab'], description: 'Moves focus into the table, to the cell focused last, or out of it.' },
		{ keys: ['↑', '↓', '←', '→'], description: 'Moves focus one cell in that direction.' },
		{ keys: ['Home', 'End'], description: 'Moves focus to the first or the last cell of the row.' },
		{ keys: ['Ctrl+Home', 'Ctrl+End'], description: 'Moves focus to the first or the last cell of the table.' },
		{ keys: ['PageUp', 'PageDown'], description: 'Moves focus by as many rows as fit in view.' },
		{ keys: ['Enter', 'F2'], description: 'Moves focus into the content of the cell, such as a button; Escape comes back.' },
	]"
/>
