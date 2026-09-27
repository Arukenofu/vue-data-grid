---
title: Empty and loading
description: What the table shows while it has no rows, and while it loads.
---

# Empty and loading

<Description>
What the table shows while it has no rows, and while it loads: two small parts that keep the grid
valid for assistive technology while they are there.
</Description>

<Demo name="part-empty-and-loading" />

## Features

<Highlights
	:features="[
		'`TableEmpty` appears by itself when the table has no rows, and goes when rows come.',
		'The empty row is a real row of the grid, with one cell over every column, so the grid stays valid ARIA.',
		'`TableLoading` marks the table `aria-busy` while it is mounted, and the announcer says it is loading.',
		'The loading bar sticks to the bottom of the view, right above a footer, over the rows.',
		'Both take any content through their slot, and default to the table\'s messages.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { TableBody, TableEmpty, TableFooter, TableLoading, TableRoot } from 'vue-data-grid';
</script>

<template>
	<TableRoot :table="table">
		<TableBody />
		<TableEmpty />
		<TableLoading v-if="loading" />
		<TableFooter />
	</TableRoot>
</template>
```

Put both after `TableBody`, and `TableLoading` before a `TableFooter`, so that the bar stands above
the footer.

## API reference

### TableEmpty

A row with one cell over every column, shown while the table has no rows. It fills the height the
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
		{ attribute: '[data-tc-part]', values: ['empty', 'empty-cell'] },
	]"
/>

### TableLoading

A bar stuck to the bottom of the table's view, over the rows and above a footer. While it is
mounted the table is `aria-busy`, so render it with `v-if` while you load. The bar itself is hidden
from screen readers: the announcer says the table is loading instead.

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
		{ attribute: '[data-tc-part]', values: ['loading'] },
	]"
/>

## Examples

### An empty state that helps

The slot of `TableEmpty` can say why the table is empty and what to do about it. In the demo a search
that finds no one offers to clear itself:

```vue
<TableEmpty>
	<IconSearchX aria-hidden="true" />
	<strong>No one is called “{{ query }}”</strong>
	<UiButton @click="query = ''">Clear the search</UiButton>
</TableEmpty>
```

### Loading while the old rows stay

Keep the rows you have while new ones load, and show the bar over them: people keep their place
and can read on. Mount `TableLoading` only for the time of the request:

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
<TableLoading v-if="loading">Loading people…</TableLoading>
```

### Messages in another language

Both parts take their default text from the table's messages. Give `TableRoot` your own:

```vue
<TableRoot :table="table" :messages="{ empty: 'Keine Einträge', loading: 'Wird geladen…' }">
```

## Accessibility

- The empty row is a `row` with one `gridcell`, `aria-colspan` over every column, and it counts into
  `aria-rowcount` while it is shown: a grid with no rows still has a valid structure, and a screen
  reader reads the message as the content of the table.
- While `TableLoading` is mounted, the table has `aria-busy="true"` and the polite live region of
  `TableRoot` announces the `loading` message once. The bar is `aria-hidden`, so it is not read twice.
- The loading bar does not take focus and does not block the rows under it from the keyboard.
