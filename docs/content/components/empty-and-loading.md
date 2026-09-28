---
title: Empty and loading
description: What the grid shows while it has no rows, and while it loads.
---

# Empty and loading

<Description>
What the grid shows while it has no rows, and while it loads: two small parts that keep the grid
valid for assistive technology while they are there.
</Description>

<Demo name="part-empty-and-loading" />

## Features

<Highlights
	:features="[
		'`GridEmpty` appears by itself when the grid has no rows, and goes when rows come.',
		'The empty row is a real row of the grid, with one cell over every column, so the grid stays valid ARIA.',
		'`GridLoading` marks the grid `aria-busy` while it is mounted, and the announcer says it is loading.',
		'The loading bar sticks to the bottom of the view, right above a footer, over the rows.',
		'Both take any content through their slot, and default to the grid\'s messages.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { GridBody, GridEmpty, GridFooter, GridLoading, GridRoot } from '@vue-data-grid/core';
</script>

<template>
	<GridRoot :grid="grid">
		<GridBody />
		<GridEmpty />
		<GridLoading v-if="loading" />
		<GridFooter />
	</GridRoot>
</template>
```

Put both after `GridBody`, and `GridLoading` before a `GridFooter`, so that the bar stands above
the footer.

## API reference

### GridEmpty

A row with one cell over every column, shown while the grid has no rows. It fills the height the
header and the footer leave, and sticks to the start edge, as wide as the view. It renders nothing
while there are rows, so it can stay in the template.

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
