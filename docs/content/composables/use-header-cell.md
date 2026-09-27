---
title: useHeaderCell
description: What a column header does — sort on click and on keys, move with Alt and the arrows, resize with Shift and the arrows.
---

# useHeaderCell

<Description>
What a column header does: a click or Enter sorts the column, Alt with the arrows moves it, Shift
with the arrows resizes it. Each only where the column's rights allow it. `TableHeaderCell` is built
on it.
</Description>

<Demo name="api-use-table-props" />

The header cells of this table are plain elements with the handlers of `useHeaderCell` spread on
them. Tab to a header and press <kbd>Enter</kbd> to sort.

## Usage

```vue
<script setup lang="ts">
import { useHeaderCell } from '@vue-stack/table';

const header = useHeaderCell(table.scope, { resizeStep: 24 });
</script>

<template>
	<div
		v-for="cell in table.scope.renderedColumns.value"
		:key="cell.key"
		v-bind="{ ...table.getHeaderCellProps(cell), ...header.getHandlers(cell.key) }"
	>
		{{ cell.column?.label }}
	</div>
</template>
```

Spread the handlers next to `getHeaderCellProps`, which gives the cell its `tabindex`: `0` for a
column with keys of its own while the table has no navigation, `-1` with it.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'resizeStep', type: 'number', default: '16', description: 'How far Shift+← and Shift+→ change the width, px.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'getHandlers', type: '(name: string) => HeaderCellHandlers', description: '`onClick`, `onKeydown`, `onKeyup` and `onFocusout` of the header cell of column `name`: one frozen object per column, so the cell\'s props hold between renders.' },
	]"
/>

## Examples

### A header with controls inside

Clicks and keys of a control inside the cell belong to that control: a menu button, a checkbox, a
resize handle. The cell does not sort when you press them, so put them in freely:

```vue
<TableHeaderCell v-for="column in columns" :key="column.key" :column="column">
	<TableHeaderContent />
	<TableSortIndicator />
	<ColumnMenu />
	<TableResizeHandle />
</TableHeaderCell>
```

### Sorting from code

The header only asks the scope to step through the column's `sortOrder`. From code, write the sort
of the column state directly:

```ts
table.state.sort.value = [{ name: 'price', direction: 'asc' }];
```

## Accessibility

- A sortable column's header gets `aria-sort` from the prop-getters while it is the first sort
  column; the header is where a screen reader looks for it.
- Moves held on a key collect per animation frame and keep focus on the moved header, so a column
  can travel several places on one held key without losing focus.
- A width set with the keys is one gesture, like a drag: it reaches the layout when the key is
  released or focus leaves the cell.
- In a right-to-left table ← and → follow the reading direction.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'Space'], description: 'Sorts a `sortable` column: the next direction of its `sortOrder`, then no sort.' },
		{ keys: ['Shift+Enter', 'Ctrl+Enter', 'Shift+Space'], description: 'Adds the column to the sort, with `multiSort`.' },
		{ keys: ['Alt+←', 'Alt+→'], description: 'Moves a `movable` column one place, stepping over a `keepTogether` group.' },
		{ keys: ['Shift+←', 'Shift+→'], description: 'Narrows or widens a `resizable` column by `resizeStep`.' },
	]"
/>

<kbd>Ctrl</kbd>+<kbd>Space</kbd> is left to the grid navigation, which selects the column with it.

## See also

- [Header](/components/header): `TableHeaderCell`, built on this composable.
- [Sorting](/guides/sorting) and [Column layout](/guides/column-layout).
