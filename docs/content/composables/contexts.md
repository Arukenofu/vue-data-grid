---
title: Contexts
description: How parts find their table, row and cell without props, and how a part of your own takes the place of a built-in one.
---

# Contexts

<Description>
How a part finds its table, its row and its cell without props. Every context is exported, both the
side that provides it and the side that reads it, so a part of your own can stand in the place of
any built-in one.
</Description>

<Demo name="api-contexts" />

The menu in each header here is not part of the library. It is a component that reads the table and
its header cell from the context, like `TableSortIndicator` does, and sorts, pins or hides the
column through the table's own API.

## Usage

A part with parts inside it provides a context; the parts inside read it. The table comes from
`TableRoot`, the column of a header from `TableHeaderCell`, the row from `TableRow`:

```vue
<script setup lang="ts">
import { useDataTableContext, useHeaderCellContext } from '@vue-stack/table';
import { computed } from 'vue';

const table = useDataTableContext();
const cell = useHeaderCellContext();

const sorted = computed(() => {
	const name = cell().column?.name;

	return name !== undefined && table.scope.getSortDirection(name) !== undefined;
});
</script>

<template>
	<span v-if="sorted" class="sorted-dot" aria-hidden="true" />
</template>
```

```vue
<TableHeaderCell v-for="column in columns" :key="column.key" :column="column">
	<TableHeaderContent />
	<SortedDot />
</TableHeaderCell>
```

The contexts of cells and rows are **getters**, `cell()`: a header cell gives the same getter to its
parts while its column changes, and a part that reads it in a `computed` or a render follows it.

## Contexts

<ReturnsTable
	label="Pair"
	:data="[
		{ name: 'createDataTableContext / useDataTableContext', type: 'DataTable', description: 'The table object. `TableRoot` provides it, with the scope of the core for `useTableScopeContext`. Call `createDataTableContext(table)` for parts under markup of your own.' },
		{ name: 'createBodyRowContext / useBodyRowContext', type: '() => TableBodyRow', description: 'The body row: `{ key, index, item, original, node }`. `TableRow` provides it.' },
		{ name: 'createHeaderCellContext / useHeaderCellContext', type: '() => RenderedColumn', description: 'The column of a header cell. `TableHeaderCell` provides it.' },
		{ name: 'createGroupCellContext / useGroupCellContext', type: '() => RenderedGroup', description: 'The group cell of a group row. `TableGroupCell` provides it.' },
		{ name: 'createFooterCellContext / useFooterCellContext', type: '() => RenderedColumn', description: 'The column of a footer cell. `TableFooterCell` provides it.' },
		{ name: 'createRowDragContext / useRowDragContext', type: 'TableDragItems', description: 'The row drag list rows register with. `TableRowDrag` and `useTableRowDrag` provide it.' },
		{ name: 'createColumnDragContext / useColumnDragContext', type: 'TableDragItems', description: 'The column drag list header cells register with. `TableColumnDrag` and `useTableColumnDrag` provide it.' },
		{ name: 'createTableMessagesContext / useTableMessagesContext', type: 'TableMessages', description: 'The strings of the interface. `TableRoot` provides its `messages` over the defaults; outside a table the defaults.' },
		{ name: 'createTableScopeContext / useTableScopeContext', type: 'TableScope', description: 'The scope of the engine, from the core.' },
	]"
/>

A `use*Context` outside its part throws, with the name of the part it needs:
`useBodyRowContext() must be called inside <TableRow>`. Give it a fallback, such as `null`, for a
part that also works elsewhere — `TableSelectionCheckbox` takes its row from a prop outside a row:

```ts
const around = useBodyRowContext(null);
const key = computed(() => props.row ?? around?.().key);
```

`TRow` of `useDataTableContext<TRow>()` and `useBodyRowContext<TRow>()` is not checked against the
provided table, just as with `inject`: it tells TypeScript what you know.

## Examples

### Parts under your own markup

Parts need their table from the context. Without `TableRoot`, provide it yourself in the component
that renders the table:

```ts
import { createDataTableContext, useDataTable } from '@vue-stack/table';

const table = useDataTable({ columns, rows, rowKey: 'id', rowHeight: 40 });

createDataTableContext(table);
```

### Replacing a built-in part

The built-in parts are built on nothing but these contexts and the public composables, so any of
them can be swapped for your own. A sort indicator with icons, a header with a menu, a toggle of your
design system: read the same context, call the same scope, render your markup. To give your part the
`as` and `asChild` of the built-in ones, build it on the [primitive](/composables/primitive).

## Accessibility

A part of your own takes over what the built-in part did for assistive technology. Before replacing
one, look at its page for the attributes it sets:

- a control needs its name, `aria-label` or visible text, and its state, such as `aria-expanded` or
  `aria-checked`;
- what only decorates, such as a sort icon next to a header with `aria-sort`, is `aria-hidden`;
- a menu or a button inside a header cell keeps its own clicks and keys: the header does not sort
  when it is pressed, and the grid navigation reaches it with <kbd>Enter</kbd> or <kbd>F2</kbd>.

The menu of the demo uses the menu of Reka UI, which brings the menu pattern with it: arrow keys,
typeahead, <kbd>Escape</kbd> and focus returning to the button.

## See also

- [Your own markup](/guides/custom-markup): tables without parts.
- [Header](/components/header) and [Body](/components/body): the parts that provide these contexts.
- [Primitive](/composables/primitive): `as`, `asChild` and the render of every part.
- [Grid attributes](/composables/grid-attributes): the attributes parts put on their elements.
