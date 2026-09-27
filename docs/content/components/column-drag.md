---
title: Column drag
description: Reordering columns by dragging their headers.
---

# Column drag

<Description>
Reordering columns by dragging their headers. The order is part of the table's layout, so a drop
moves the column itself, and the layout remembers it.
</Description>

<Demo name="part-column-drag" />

## Features

<Highlights
	:features="[
		'Only `movable` columns drag, and only to places the layout allows: within their pinned side, around a group that keeps together.',
		'The columns move apart to make room, each as a whole column, header and cells together.',
		'The drop moves the column in the layout for you; `drop` tells you where it went.',
		'The table scrolls near its edges while a column is dragged.',
		'With `useTableMotion` the columns slide into place after a drop.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { TableHeader, TableHeaderCell, TableHeaderRow } from '@vue-stack/table';
import { TableColumnDrag, TableDragPreview } from '@vue-stack/table/drag-and-drop';
</script>

<template>
	<TableColumnDrag>
		<TableHeader>
			<TableHeaderRow v-slot="{ columns }">
				<TableHeaderCell v-for="column in columns" :key="column.key" :column="column" />
			</TableHeaderRow>
		</TableHeader>
		<TableDragPreview for="columns" />
	</TableColumnDrag>
</template>
```

`TableColumnDrag` renders no element: put it around the `TableHeader`, inside the `TableRoot`. The
header cells under it register themselves. Columns say whether they move:

```ts
const column = defineColumn<Stock>({ movable: true });

const columns = defineColumns({
	symbol: column(stock => stock.symbol, { label: 'Symbol', pinned: 'start', movable: false }),
	name: column(stock => stock.name, { label: 'Company' }),
});
```

## API reference

### TableColumnDrag

`useTableColumnDrag` as a part.

<PropsTable
	:data="[
		{ name: 'indicator', type: '\'gap\' | \'line\' | \'mark\'', default: '\'gap\'', description: 'How the place is shown: the columns move apart, a line stands between the headers, or only attributes mark it.' },
		{ name: 'enabled', type: 'boolean', default: 'true', description: 'Whether columns can be dragged now.' },
		{ name: 'canDrop', type: '(name, index) => boolean', description: 'Whether a column may go to a place among the shown columns, on top of what the layout allows.' },
		{ name: 'bounds', type: '\'table\' | \'window\' | HTMLElement', default: '\'table\'', description: 'What neither the pointer nor the ghost leaves.' },
		{ name: 'getLabel', type: '(column) => string', description: 'The name of a column for screen readers; its label by default.' },
		{ name: 'motion', type: 'MotionEngine | false', description: 'The engine of the gap and the ghost; `webAnimations()` by default.' },
		{ name: 'autoScroll', type: 'DragAutoScroll | false', description: 'How the table scrolls near its start and end.' },
		{ name: 'touchDelay', type: 'number', default: '250', description: 'How long a finger rests on a header before it drags, ms.' },
		{ name: 'ignore', type: 'string', description: 'A selector of what inside a header never starts a drag, on top of the controls.' },
		{ name: 'announcements', type: 'Partial<DragAnnouncements>', description: 'What screen readers hear.' },
	]"
/>

<EmitsTable
	:data="[
		{ name: 'drop', payload: '{ name: string; index: number }', description: 'A column was dropped and moved: its name and its new place among the shown columns.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ active, over, allowed, item }', description: 'The name of the column being dragged, whether it is over the header and at an allowed place, and what it is.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-tc-draggable]', values: 'On a header cell while its column can be dragged.' },
		{ attribute: '[data-drag-source]', values: 'The header being dragged.' },
		{ attribute: '[data-drop-target]', values: ['before', 'after'] },
		{ attribute: '[data-drop-indicator]', values: ['before', 'after'] },
	]"
/>

<CssVariablesTable
	:data="[
		{ name: '--tc-drop-color', default: 'Highlight', description: 'The upright line between the headers of `indicator: \'line\'`.' },
	]"
/>

## Examples

### Animating the drop

The gap already shows the columns at their new places while the header is dragged. With the line
indicator, or with the keys, the columns jump on the drop; `useTableMotion` slides them there:

```ts
import { useTableMotion } from '@vue-stack/table';

useTableMotion(table);
```

### Where the order lives

The order is `order` of the layout in the column state, next to widths, pins and hidden columns. Put
it back with `reset`, or keep it between visits with `persist`:

```ts
import { localStorageStore, useDataTable } from '@vue-stack/table';

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	persist: localStorageStore('stocks'),
});

table.state.reset();
```

### Hiding a column by dragging it away

A [`TableDropZone`](/components/drop-zone) with `accept="columns"` takes headers dragged out of the
table, with `bounds="window"` on the drag, and can hide the column it gets, when the column is
`hideable`:

```vue
<TableColumnDrag bounds="window">
	<TableHeader>
		<TableHeaderRow v-slot="{ columns }">
			<TableHeaderCell v-for="column in columns" :key="column.key" :column="column" />
		</TableHeaderRow>
	</TableHeader>
</TableColumnDrag>
<TableDropZone accept="columns" @drop="({ key }) => table.scope.toggleColumn(key)" />
```

## Accessibility

- Columns do not drag with the keyboard: a header cell moves its column with <kbd>Alt</kbd>+<kbd>←</kbd>
  and <kbd>Alt</kbd>+<kbd>→</kbd> instead, one place at a time, and the focus stays on the header.
- The column window keeps the dragged header rendered while the table scrolls under it.
- After a move, `aria-colindex` of every cell follows the new order, so a screen reader reads the
  columns where they now are.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Alt+←', 'Alt+→'], description: 'On a header cell: moves a `movable` column one place, over a group that keeps together.' },
	]"
/>
