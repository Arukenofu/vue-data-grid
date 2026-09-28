---
title: Server rendering and Nuxt
description: What a grid renders on the server, what waits for the browser, and how to set it up in Nuxt.
---

# Server rendering and Nuxt

<Description>
A grid renders on the server like any Vue component, and hydrates in the browser without a
mismatch. What needs the browser, such as sizes and stored settings, waits for the grid to mount,
and the first frame shows the same as the server did.
</Description>

This site is an example: its pages are rendered ahead of time, grids included. The HTML of the
[virtualization](/guides/virtualization) page holds the header and the first rows of a grid of a
hundred thousand, with `aria-rowcount="100001"`, before any script runs.

## What the server renders

- **The rows up to `ssrRows`.** There is no viewport to window on the server, so the grid renders
  the first `ssrRows` rows, 24 by default. The first frame in the browser renders the same, so
  hydration matches, and the row window takes over from the next frame.
- **The roles and counts.** `role`, `aria-rowcount`, `aria-colcount`, and the index of every row
  and cell come from data, not from the DOM, so they are in the first HTML.
- **The declared layout.** Widths, order, pins and the sort the columns declare. A layout from
  `persist` waits for the browser, see below.
- **Ids.** The ids that tie an editor to its error and a list to its field come from Vue's `useId`,
  which gives the same ids on the server and in the browser.

```ts
const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 36,
	virtual: { ssrRows: 40 },
});
```

`ssrRows` is an option of the row window, `virtual`. Give it about as many rows as fit the grid's
height, so the page does not grow or shrink when the window takes over.

## What waits for the browser

- **Sizes.** The viewport, the heights of the sticky header and footer (`grid.headHeight`,
  `grid.footHeight`) and measured rows are read once the grid mounts. Until then they are `0`,
  which the first frame is drawn with on both sides.
- **Stored settings.** A column state with `persist` reads its record after the grid mounts, so the
  page hydrates with the declared layout and then takes the stored one. `grid.state.ready` turns
  `true` once it is applied; hide a flash of the declared layout behind it if it matters.
  `localStorageStore` touches no storage until it is read, so it is safe to create on the server.
- **Measuring content.** `autosizeColumns` measures rendered cells: call it in the browser, from
  `onMounted` or on a click.
- **Animation and dragging.** They start from user input or from changes after mount, and never
  run on the server.

## Nuxt

The packages are ES modules with no side effects on import. Add the structural styles to the
application, and use the grid in pages and components as anywhere else:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	css: ['@vue-data-grid/core/style.css'],
});
```

```vue
<!-- pages/people.vue -->
<script setup lang="ts">
import { GridBody, GridCells, GridRoot, GridRow, sorting, useDataGrid } from '@vue-data-grid/core';

const { data: people } = await useFetch('/api/people', { default: () => [] });

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 36,
	features: { sorting: sorting() },
});
</script>

<template>
	<GridRoot :grid="grid" label="People">
		<!-- the header and the body -->
	</GridRoot>
</template>
```

- **No `<ClientOnly>`.** The grid renders on the server; wrapping it only delays the rows and their
  accessible names until scripts run.
- **Data from `useFetch` or `useAsyncData`** is a ref, which `rows` takes as it is. The rows the
  server rendered with come to the browser in the payload, so both render the same.
- **Row keys.** Keys must be the same on the server and in the browser: take them from the data,
  such as an id, never from a random or time-based value.
- **Stored settings per user** that must be right in the first HTML, such as a column layout kept
  on your server, belong in the column state from the start: pass `layout` and `sort` as models
  filled from your data, rather than `persist`, which the browser alone can read.

## Accessibility

- The first HTML is a complete grid for assistive technology: roles, counts, row and column
  indexes, and the names of the controls are there before scripts run, so a page read early reads
  right.
- The first HTML already puts the grid and its cells in the tab order as the navigation does
  (`tabindex` comes from the prop-getters, not from the DOM), but the keys work once the page
  hydrates.
- `GridFooterRow` and `GridEmpty` count themselves into `aria-rowcount` after they mount, so the
  first HTML leaves them out of the count, and the browser adds them.

## See also

- [Virtualization](/guides/virtualization): the row window and `ssrRows`.
- [Column layout](/guides/column-layout): `persist` and `grid.state.ready`.
- [TypeScript](/guides/typescript): types of the grid and its parts.
