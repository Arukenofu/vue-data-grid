---
title: Sort indicator
description: The mark in a header cell that shows how its column sorts, and its place in a multi-sort.
---

# Sort indicator

<Description>
The mark in a header cell that shows which way its column sorts and, in a multi-sort, where it stands
among the columns that sort.
</Description>

<Demo name="part-sort-indicator" />

## Features

<Highlights
	:features="[
		'Shows the direction of its column, and its place in a multi-sort from `1`.',
		'Keeps its room while the column is unsorted, so sorting never shifts the label.',
		'Renders nothing for a column that is not `sortable`: put it in every header cell.',
		'Any icons you like through the slot; `▲` and `▼` without one.',
		'Hidden from screen readers, which hear the sort from `aria-sort` and the announcer instead.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { GridHeaderCell, GridHeaderContent, GridSortIndicator } from '@vue-data-grid/core';
</script>

<template>
	<GridHeaderCell :column="column">
		<GridHeaderContent />
		<GridSortIndicator />
	</GridHeaderCell>
</template>
```

The indicator reads the column of the `GridHeaderCell` it is in; it needs no props. The grid sorts
its rows with the `sorting` feature, or leaves them to your server without it: the indicator shows
the sort state either way.

## API reference

### GridSortIndicator

<PropsTable
	:data="[
		{ name: 'as', type: 'string | Component', default: '\'span\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ direction?: \'asc\' | \'desc\'; sortIndex?: number }', description: 'The direction of the column, `undefined` while it does not sort, and its place in a multi-sort, `undefined` while one column sorts. Without the slot the mark is `▲` or `▼` and the place.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['sort-indicator'] },
		{ attribute: '[data-dg-state]', values: ['asc', 'desc', 'none'] },
	]"
/>

## Examples

### Icons of your own

The slot gets the direction and the place, and renders whatever you want. The demo uses icons of
Lucide and a small badge for the place:

```vue
<GridSortIndicator v-slot="{ direction, sortIndex }">
	<IconArrowUpNarrowWide v-if="direction === 'asc'" />
	<IconArrowDownWideNarrow v-else-if="direction === 'desc'" />
	<IconArrowUpDown v-else class="idle" />
	<span v-if="sortIndex !== undefined" class="order">{{ sortIndex }}</span>
</GridSortIndicator>
```

### Styling by state

Without a slot, style the default mark by its state:

```css
[data-dg-part='sort-indicator'][data-dg-state='none'] {
	opacity: 0;
}

[role='columnheader']:hover [data-dg-part='sort-indicator'][data-dg-state='none'] {
	opacity: 0.4;
}
```

### The order a click steps through

A header click steps a column through its `sortOrder`, then clears it: descending, ascending, none by
default. Names read better ascending first:

```ts
const columns = defineColumns({
	name: column('name', { label: 'Name', sortable: true, sortOrder: ['asc', 'desc'] }),
});
```

### Sorting from code

The sort lives in the grid's column state, as a list of `{ name, direction }`. Replace it to sort
from a menu or a button; the indicators follow:

```ts
grid.state.sort.value = [{ name: 'rating', direction: 'desc' }];
grid.state.sort.value = [];
```

## Accessibility

- The indicator is `aria-hidden`: the header cell says the sort itself with `aria-sort`, set on the
  first column of the sort only, since ARIA has no sort levels.
- The full multi-sort, "Sorted by Team ascending, then Rating descending", is announced by the live
  region of [`GridRoot`](/components/root) whenever it changes. Change the words with the `sorted`
  message.

### Keyboard interactions

The indicator takes no focus. Its header cell sorts:

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'Space'], description: 'Sorts by the column, to its next direction.' },
		{ keys: ['Shift+Enter', 'Shift+Space'], description: 'Adds the column to the sort, with `multiSort` on.' },
	]"
/>
