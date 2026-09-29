---
title: Empty and loading
description: What the grid shows while it has no rows, while it loads, and in place of rows on their way.
---

# Empty and loading

<Description>
What the grid shows while it has no rows, while it loads, and in place of rows on their way: small
parts that keep the grid valid for assistive technology while they are there.
</Description>

<Demo name="part-empty-and-loading" />

<Demo name="part-placeholder-rows" />

The second demo loads five people above or below the ones shown. Skeleton rows stand in for them at
that edge. Scrolled down, the rows you see do not move while rows come in above them; at the very
top the skeletons, then the people, show right there, as nothing watches the top edge here.

## Features

<Highlights
	:features="[
		'`GridEmpty` appears by itself when the grid has no rows, and goes when rows come; it waits while the grid loads.',
		'The empty row is a real row of the grid, with one cell over every column, so the grid stays valid ARIA.',
		'`GridLoading` marks the grid `aria-busy` while it is mounted, and the announcer says it is loading.',
		'The loading bar sticks to the bottom of the view, right above a footer, over the rows.',
		'Both take any content through their slot, and default to the grid\'s messages.',
		'`GridPlaceholderRows` shows skeleton rows at the top or the bottom of the body, their cells laid out and pinned as the columns.',
		'Placeholder rows are no rows of the grid: no key, focus or selection, hidden from screen readers.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { GridBody, GridEmpty, GridFooter, GridLoading, GridPlaceholderRows, GridRoot } from '@vue-data-grid/core';
</script>

<template>
	<GridRoot :grid="grid">
		<GridPlaceholderRows v-if="loadingAbove" edge="top" :count="3" />
		<GridBody />
		<GridPlaceholderRows v-if="loadingBelow" :count="3" />
		<GridEmpty />
		<GridLoading v-if="loading" />
		<GridFooter />
	</GridRoot>
</template>
```

Put `GridEmpty` and `GridLoading` after `GridBody`, and `GridLoading` before a `GridFooter`, so that
the bar stands above the footer. `GridPlaceholderRows` goes right after `GridBody`, or right before it
with `edge="top"`.

## API reference

### GridEmpty

A row with one cell over every column, shown while the grid has no rows. It fills the height the
header and the footer leave, and sticks to the start edge, as wide as the view. It renders nothing
while there are rows, so it can stay in the template, and nothing while the grid is busy, with
`GridLoading` or `GridPlaceholderRows` mounted or `markBusy` held: until the rows come, the grid is
not known to be empty.

<PropsTable
	:data="[
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component of the row.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', description: 'The content of the cell; the `empty` message, &quot;No rows&quot;, without it.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['empty', 'empty-cell'] },
	]"
/>

### GridLoading

A bar stuck to the bottom of the grid's view, over the rows and above a footer. While it is
mounted the grid is `aria-busy`, so render it with `v-if` while you load. The bar itself is hidden
from screen readers: the announcer says the grid is loading instead.

<PropsTable
	:data="[
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', description: 'The content of the bar; the `loading` message, &quot;Loading…&quot;, without it.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['loading'] },
	]"
/>

### GridPlaceholderRows

Rows that stand for rows on their way, such as skeletons while the next page loads: `count` rows at
an edge of the body, each with a cell for every rendered column, sized and pinned as the columns
are. Render it with `v-if` while you load. While it is mounted the grid is `aria-busy`.

At the top it moves the body down by its height, and keeps the rows in view where they were on the
screen, as rows loaded there do: it shows once people scroll up to it. At the very top it shows at
once, unless something holds the rows in place there, as `useGridEdge` at the top does. The grid
windows and scrolls to rows below it. Its height is observed, so CSS and the slot may change it.

Standing on the other side of `GridBody` from its `edge`, it warns once in development: the rows would
be placed off by its height.

<PropsTable
	:data="[
		{ name: 'count', type: 'number', required: true, description: 'How many rows to show.' },
		{ name: 'edge', type: '\'top\' | \'bottom\'', default: '\'bottom\'', description: 'The edge of the body the rows stand at: after `GridBody`, or before it for the top.' },
		{ name: 'rowHeight', type: 'number', description: 'The height of a row, px. The height of the row at that edge by default; without rows the one height of every row, `rowHeight` of the grid as a number; else it is left to CSS.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component of the block of rows.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', description: 'The content of each cell, from `{ column, index }`: the column of the cell and the place of the row among the placeholder rows. Without it the cells are empty, for the theme to draw on.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['placeholder-rows', 'placeholder-row', 'placeholder-cell'] },
		{ attribute: '[data-dg-edge]', values: ['top', 'bottom'] },
	]"
/>

The cells carry the attributes of the column's cells, `data-dg-column`, `data-dg-pinned` and
`data-dg-align`, so the geometry of the grid reaches them and a theme can style them as cells. A spacer
of the column window, `data-dg-spacer`, stays an empty element without the part: there is nothing to
draw in it.

## Examples

### An empty state that helps

The slot of `GridEmpty` can say why the grid is empty and what to do about it. In the demo a search
that finds no one offers to clear itself:

```vue
<GridEmpty>
	<IconSearchX aria-hidden="true" />
	<strong>No one is called “{{ query }}”</strong>
	<UiButton @click="query = ''">Clear the search</UiButton>
</GridEmpty>
```

### Loading while the old rows stay

Keep the rows you have while new ones load, and show the bar over them: people keep their place
and can read on. Mount `GridLoading` only for the time of the request:

```ts
const loading = shallowRef(false);

async function reload() {
	loading.value = true;

	try {
		rows.value = await fetchPeople();
	} finally {
		loading.value = false;
	}
}
```

```vue
<GridLoading v-if="loading">Loading people…</GridLoading>
```

### Skeletons of your own shape

Without a slot the cells are empty: the kit of this site draws a bar in each with
`[data-dg-part='placeholder-cell']:empty::before`. The slot draws something else, such as a bar as
wide as the values of the column usually are:

```vue
<GridPlaceholderRows v-if="loading" v-slot="{ column }" :count="5">
	<span class="skeleton" :style="{ width: widths[column.name] }" />
</GridPlaceholderRows>
```

### Messages in another language

Both parts take their default text from the grid's messages. Give `GridRoot` your own:

```vue
<GridRoot :grid="grid" :messages="{ empty: 'Keine Einträge', loading: 'Wird geladen…' }">
```

## Accessibility

- The empty row is a `row` with one `gridcell`, `aria-colspan` over every column, and it counts into
  `aria-rowcount` while it is shown: a grid with no rows still has a valid structure, and a screen
  reader reads the message as the content of the grid.
- While `GridLoading` is mounted, the grid has `aria-busy="true"` and the polite live region of
  `GridRoot` announces the `loading` message once. The bar is `aria-hidden`, so it is not read twice.
- The loading bar does not take focus and does not block the rows under it from the keyboard.
- Placeholder rows are `aria-hidden` and have no roles: they are not counted in `aria-rowcount` and
  the keys pass them by. While they are mounted the grid is `aria-busy`, and the announcer says the
  grid is loading.
