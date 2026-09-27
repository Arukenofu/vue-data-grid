---
title: Your own markup
description: Render your own element through a part, replace a part with your own component, or write the whole table from prop-getters.
---

# Your own markup

<Description>
Every part is built from functions you can call yourself. When a part does not fit, render your own
element through it, replace it with a component of your own, or step below the parts and write the
table's markup by hand. Nothing here needs a private API.
</Description>

The table has three levels, each built on the one below:

| Level | What it is | Use it when |
| --- | --- | --- |
| **Components** | `TableRoot`, `TableRow`, `TableSortIndicator`… | the parts fit, and you style them |
| **Composables** | `useDataTable`, `useHeaderCell`, `useGridNavigation`… | you want the behaviour under markup of your own |
| **Utilities** | prop-getters such as `getRowProps`, `getCellText` | you write every element yourself |

You can mix them freely: a table of parts with one part of your own, or a hand-written table that
uses a composable for its header.

## Your element, the part's behaviour

Every part renders one element, a `div` unless it says otherwise, and `as` changes it:

```vue
<TableRoot :table="table" as="section" />
```

`asChild` goes further: the part renders **no element of its own** and merges its props into the one
child of its slot. Your element gets the role, the ARIA attributes, the state attributes and the
handlers of the part:

<Demo name="as-child" />

The checkboxes above are plain buttons of the page, not the table's inputs:

```vue
<TableSelectionCheckbox v-slot="{ selected }" as-child>
	<button class="check">
		<IconCheck v-if="selected" aria-hidden="true" />
	</button>
</TableSelectionCheckbox>
```

The part sees that its child is a button and gives it `role="checkbox"`, `aria-checked`, the name
"Select row", <kbd>Space</kbd> to toggle, and the click that selects the row, with <kbd>Shift</kbd> for
a range. The CSS styles `[aria-checked='true']`, so the look follows the state without a line of
script.

How props merge:

- props the child sets itself win, so `class="check"` or your own `aria-label` stay;
- `class` and `style` of both are kept;
- handlers of both run, yours included.

A handful of parts render many elements and take `as` for all of them without `asChild`:
`TableCells`, the cell of each column, and `TableRangeOverlay`. The content parts,
`TableHeaderContent`, `TableGroupContent` and `TableFooterContent`, render no element at all.

## A part of your own

A part finds the table and its place in it through **contexts**, and every context is public. The dot
before each name in the demo is a component of the page that reads its row from the `TableRow`
around it:

```vue
<script setup lang="ts">
import { useBodyRowContext } from '@vue-data-grid/core';

const row = useBodyRowContext<Person>();

const presence = computed(() => row().original.presence);
</script>

<template>
	<span class="presence" :data-presence="presence" aria-hidden="true" />
</template>
```

<ReturnsTable
	label="Context"
	:data="[
		{ name: 'useDataTableContext()', type: 'DataTable', description: 'The table of the `TableRoot` around: its scope, state, features and prop-getters.' },
		{ name: 'useBodyRowContext()', type: '() => TableBodyRow', description: 'The body row a part is in: `key`, `index`, `original` and the tree `node`, as a getter that follows the row.' },
		{ name: 'useHeaderCellContext()', type: '() => RenderedColumn', description: 'The column of the header cell a part is in, such as a sort indicator or a menu button.' },
		{ name: 'useGroupCellContext()', type: '() => RenderedGroup', description: 'The group cell a part is in, such as its collapse toggle.' },
		{ name: 'useFooterCellContext()', type: '() => RenderedColumn', description: 'The column of the footer cell a part is in.' },
		{ name: 'useTableMessagesContext()', type: 'TableMessages', description: 'The strings of the table, for the accessible names of your controls.' },
	]"
/>

Each throws a clear error outside its part, or returns a fallback you pass, such as
`useBodyRowContext(null)` for a component that also works outside a row. The type argument, such as
`<Person>`, is trusted rather than checked, as with Vue's `inject`. Every `use…Context` has a
`create…Context` counterpart, for your own markup to provide what the parts below it expect.

A sort button for a header cell, in the same way:

```vue
<script setup lang="ts">
import { useDataTableContext, useHeaderCellContext } from '@vue-data-grid/core';

const table = useDataTableContext();
const cell = useHeaderCellContext();

const direction = computed(() => {
	const name = cell().column?.name;

	return name ? table.scope.getSortDirection(name) : undefined;
});
</script>
```

## Markup from prop-getters

Below the parts, the table object itself is a set of **prop-getters**: functions that return
everything an element needs, roles, indexes, states, geometry and the attributes the behaviour reads.
Spread them on elements of your own and the table works as with the parts, keyboard included:

<Demo name="custom-markup" />

```vue
<template>
	<div :ref="table.root" v-bind="table.getGridProps()" tabindex="0" aria-label="Invoices">
		<div :ref="table.head" v-bind="table.getHeadProps()">
			<div v-bind="table.getHeaderRowProps()">
				<div v-for="rendered in table.scope.renderedColumns.value" :key="rendered.key" v-bind="getHeaderProps(rendered)">
					{{ rendered.column?.label }}
				</div>
			</div>
		</div>
		<div :ref="table.body" v-bind="table.getBodyProps()">
			<div v-for="item in table.items.value" :key="item.key" v-bind="table.getRowProps(item)">
				<div v-for="rendered in table.scope.renderedColumns.value" :key="rendered.key" v-bind="table.getCellProps(rendered)">
					<template v-if="rendered.column">
						{{ getCellText(rendered.column, table.rows.value[item.index]) }}
					</template>
				</div>
			</div>
		</div>
	</div>
	<span :ref="table.exit" tabindex="0" />
</template>
```

<ReturnsTable
	label="Prop-getter"
	:data="[
		{ name: 'getGridProps()', type: 'Props', description: 'The table element: its role, `aria-rowcount`, `aria-colcount`, `aria-multiselectable` and `aria-busy`.' },
		{ name: 'getHeadProps()', type: 'Props', description: 'The header block, a `rowgroup` that sticks to the top.' },
		{ name: 'getGroupRowProps(level)', type: 'Props', description: 'A group row of the header, `level` from the top.' },
		{ name: 'getGroupCellProps(cell)', type: 'Props', description: 'A cell of a group row: its geometry, `aria-colindex` and `aria-colspan`.' },
		{ name: 'getHeaderRowProps()', type: 'Props', description: 'The row of column headers.' },
		{ name: 'getHeaderCellProps(column)', type: 'Props', description: 'A column header: geometry, `aria-colindex`, `aria-sort`, `tabindex`.' },
		{ name: 'getBodyProps()', type: 'Props', description: 'The body block, as tall as all the rows.' },
		{ name: 'getRowProps(item)', type: 'Props', description: 'A body row placed at its offset, with `aria-rowindex`, and the tree and selection attributes.' },
		{ name: 'getCellProps(column)', type: 'Props', description: 'A body or footer cell: geometry, its role (`rowheader` for a row header), `aria-colindex`.' },
		{ name: 'getFootProps()', type: 'Props', description: 'The footer block, stuck to the bottom.' },
		{ name: 'getFooterRowProps(index)', type: 'Props', description: 'A footer row.' },
	]"
/>

The refs matter as much as the props: `root` is the scroll container the windows and the geometry
work in, `head` and `foot` are measured so scrolling keeps rows clear of them, `body` is where drags
and cell ranges find the rows, and `exit` is the element <kbd>Tab</kbd> leaves the grid through when
the table has the `navigation` feature. For the keys and clicks of a header, spread
[`useHeaderCell`](/composables/use-header-cell)'s handlers next to its props, as the demo does.

Cell props are one frozen object per column, shared by every row, so spreading them costs nothing.
What is left to you is the memo: a row written inline renders with the whole body. Put a row in a
component of its own that takes its `item` and its data as props, and it renders only when they
change, which is what `TableRow` does. The [Performance](/overview/performance) page has the details.

## The engine itself

Under `useDataTable` is the engine of the core, `useTableEngine`: the column model, the windows and
the geometry, with no markup conventions at all. It is the right level for something that is not a
table on screen, such as a canvas, or for assembling a table from the core's composables one by one.
[The core](/composables/core) lists what it offers.

## Accessibility

- The prop-getters carry the whole WAI-ARIA grid contract: roles, positions, counts, sort, selection,
  tree levels. Markup of your own is as accessible as the parts, as long as each getter lands on its
  element: the grid, a `rowgroup`, a `row`, the cells.
- With `asChild`, your element takes over the part's role. Give it an element that can take focus
  and be pressed, such as a `button`; a part that sees a `button` or an `input` adapts its props to
  it, so a native element never gets a role that contradicts it.
- A part of your own that is a control needs an accessible name. `useTableMessagesContext()` gives
  the table's strings, so your control speaks the same language as the rest of the table.
- Controls inside cells work with the grid navigation when they are real controls: buttons, links,
  inputs, or elements with a widget role.

## See also

- [Root](/components/root) and the other part pages: each lists its props, slots and attributes.
- [Primitive](/composables/primitive) and [Contexts](/composables/contexts): `primitiveProps`,
  `renderPrimitive` and the contexts, for parts of your own written as components.
- [`useTableProps`](/composables/use-table-props): the prop-getters without `useDataTable`.
- [Styling](/overview/styling): the attributes and variables to style any of it.
