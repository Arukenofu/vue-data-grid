---
title: Drop zone
description: An area that rows or columns of a table are dropped on without it being a table.
---

# Drop zone

<Description>
An area rows or columns of a table are dropped on without it being a table: a bin, a list of
favourites, a folder in a sidebar, a column chooser.
</Description>

<Demo name="part-drop-zone" />

## Features

<Highlights
	:features="[
		'Takes the rows of any table, or only of the tables of a `group`; or the columns, with `accept=&quot;columns&quot;`.',
		'Knows whether an item it takes is being dragged, and whether it is over it, for a message of each kind.',
		'`canDrop` refuses items by what they are and where they come from.',
		'The dropped item comes with its row or column and the table it comes from.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { TableDropZone, TableRowDrag } from '@vue-data-grid/core/drag-and-drop';
</script>

<template>
	<TableRoot :table="table">
		<TableRowDrag bounds="window">
			<TableBody />
		</TableRowDrag>
	</TableRoot>

	<TableDropZone @drop="remove">Trash</TableDropZone>
</template>
```

A drag keeps the pointer inside its table by default. Give it `bounds="window"`, or put the tables in
a `group`, so that a row can reach a zone outside the table.

## API reference

### TableDropZone

<PropsTable
	:data="[
		{ name: 'accept', type: '\'rows\' | \'columns\'', default: '\'rows\'', description: 'What it takes. Read once.' },
		{ name: 'group', type: 'string', description: 'Take only the rows of tables in this group; of any table without it.' },
		{ name: 'canDrop', type: '(event: TableDropZoneEvent) => boolean', description: 'Whether to take an item.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<EmitsTable
	:data="[
		{ name: 'drop', payload: 'TableDropZoneEvent', description: 'An item was dropped on the area: `{ key, label, row, column, source }`, the key of the row or the name of the column, its name, the row or the column, and the table it comes from.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ ready: boolean; over: boolean; item: TableDragItem | null }', description: 'Whether an item it takes is being dragged and can reach it, whether it is over the area, and the item with the table it comes from.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['drop-zone'] },
		{ attribute: '[data-dg-state]', values: ['idle', 'ready', 'over'] },
	]"
/>

## Examples

### A bin and a list of favourites

The demo has two zones next to a table of files. Each does its own thing with the key it gets:

```ts
function star({ key }: TableDropZoneEvent) {
	starred.value = new Set([...starred.value, key]);
}

function remove({ key }: TableDropZoneEvent) {
	rows.value = rows.value.filter(file => file.id !== key);
}
```

```vue
<TableDropZone v-slot="{ ready, over }" @drop="remove">
	<IconTrash aria-hidden="true" />
	<span v-if="over">Release to delete</span>
	<span v-else-if="ready">Drop a file here</span>
	<span v-else>Drag files here</span>
</TableDropZone>
```

The state is also in `data-dg-state`, so the look can come from CSS alone:

```css
[data-dg-part='drop-zone'][data-dg-state='ready'] {
	border-style: dashed;
}

[data-dg-part='drop-zone'][data-dg-state='over'] {
	background: color-mix(in srgb, crimson 12%, transparent);
}
```

### Only from some tables

A zone takes the rows of every table by default. Name a `group` to take only the rows of the tables
in it, or decide per item with `canDrop`:

```vue
<TableDropZone group="tasks" :can-drop="({ source }) => source !== archive" @drop="archiveTask" />
```

## Accessibility

- A drop zone is a target for the pointer. Offer the same action another way too, such as a
  **Delete** button or a menu item on the row, for people who do not drag.
- Name the zone with visible text, as in the demo, and keep its message in the slot rather than in
  a tooltip, so it can be read while the drag goes on.
- Rows dragged with the keyboard move within their table; a keyboard drag does not reach a zone.
