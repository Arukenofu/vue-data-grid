---
title: Root
description: The grid element itself, the scroll container that every other part lives in.
---

# Root

<Description>
The grid element itself: the scroll container with the role of a grid, which hands the grid object
to every part inside it.
</Description>

<Demo name="quick-start" />

## Features

<Highlights
	:features="[
		'Renders the scroll container with `role=&quot;grid&quot;`, `treegrid` or `table`, and its row and column counts.',
		'Provides the grid object to every part inside, so parts need no props to find it.',
		'Names the grid for screen readers with `label`, or your own `aria-labelledby`.',
		'Announces sorting, selection and loading through a polite live region.',
		'Makes the grid one Tab stop when the grid has the `navigation` feature.',
		'Takes the strings of the interface through `messages`, for any language.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { GridBody, GridHeader, GridRoot, useDataGrid } from '@vue-data-grid/core';

const grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 40 });
</script>

<template>
	<GridRoot :grid="grid" label="Invoices">
		<GridHeader />
		<GridBody />
	</GridRoot>
</template>
```

`GridRoot` is the outermost part. Everything else, the header, the body, the footer and the states,
goes inside it, in the order you want them in the DOM.

## API reference

### GridRoot

The scroll container of the grid. It renders a `div` with the props of `getGridProps()` and
provides the grid and its messages to the parts inside. Attributes you put on it, such as `class`,
`style` or `aria-labelledby`, go to the grid element.

<PropsTable
	:data="[
		{ name: 'grid', type: 'DataGrid', required: true, description: 'The grid object from `useDataGrid`. Read once: give a new grid a new `key`.' },
		{ name: 'label', type: 'string', description: 'The accessible name of the grid, when no visible heading names it through `aria-labelledby`.' },
		{ name: 'messages', type: 'Partial<GridMessages>', description: 'The strings of the interface over the English defaults: control names, the empty and loading states, announcements. Read once.' },
		{ name: 'announce', type: 'boolean', default: 'true', description: 'Announce the sort, the number of selected rows and loading to screen readers.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ grid: DataGrid }', description: 'The parts of the grid. The grid object is the same one you passed in.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['grid'] },
	]"
/>

With the `navigation` feature, `GridRoot` also renders an empty focusable element right after the
grid. Tab leaves the grid through it, so the grid is a single Tab stop. Next to the grid stands
the live region of the announcer, `[data-dg-part="announcer"]`, hidden from sight by the
structural styles.

## Examples

### Naming the grid with a heading

When the page shows a heading for the grid, point at it rather than repeating its text:

```vue
<template>
	<h2 id="invoices-title">Invoices</h2>
	<GridRoot :grid="grid" aria-labelledby="invoices-title">
		<!-- … -->
	</GridRoot>
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

A grid without a height grows with its rows and never scrolls itself, which is fine for a short
grid in a page, but leaves nothing for [virtualization](/guides/virtualization) to window.

### Scoped styles

`GridRoot` renders several root nodes: the grid, the exit element and the live region. Vue's
scoped styles of the parent reach a component with several roots only through `:deep()`, so style
the grid from an element around it:

```vue
<style scoped>
.panel :deep([data-dg-part='grid']) {
	height: 480px;
}
</style>
```

## Accessibility

Adheres to the [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and
[Treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) patterns of WAI-ARIA.

- The role is `grid`, or `treegrid` when the grid has the `tree` feature. Pass `role: 'table'` to
  `useDataGrid` for a static table that is only read, not moved through.
- `aria-rowcount` counts the header, body and footer rows, and `aria-colcount` the shown columns, so a
  screen reader knows the size of the grid even while only part of it is rendered.
- `aria-multiselectable` is set while more than one row or cell can be selected, and `aria-busy`
  while a `GridLoading` or `GridPlaceholderRows` is shown.
- The announcer tells what `aria-sort` cannot: the full sort in a multi-sort, how many rows are
  selected, and that the grid is loading.

### Keyboard interactions

With the `navigation` feature the grid is a single Tab stop, and the keys move through its cells.
The full list is on the [keyboard navigation](/guides/keyboard-navigation) page.

<KeyboardTable
	:data="[
		{ keys: ['Tab'], description: 'Moves focus into the grid, to the cell focused last, or out of it.' },
		{ keys: ['↑', '↓', '←', '→'], description: 'Moves focus one cell in that direction.' },
		{ keys: ['Home', 'End'], description: 'Moves focus to the first or the last cell of the row.' },
		{ keys: ['Ctrl+Home', 'Ctrl+End'], description: 'Moves focus to the first or the last cell of the grid.' },
		{ keys: ['PageUp', 'PageDown'], description: 'Moves focus by as many rows as fit in view.' },
		{ keys: ['Enter', 'F2'], description: 'Moves focus into the content of the cell, such as a button; Escape comes back.' },
	]"
/>
