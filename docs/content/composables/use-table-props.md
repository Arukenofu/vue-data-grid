---
title: useTableProps
description: The markup contract of an accessible table as prop-getters — roles, indexes, sort, tree and selection state for every element.
---

# useTableProps

<Description>
The markup contract of an accessible table as prop-getters: roles, row and column indexes, sort,
tree and selection state, for every element of the table. For tables you write from scratch.
</Description>

<Demo name="api-use-table-props" />

This table has no parts at all: plain `div`s bound to the prop-getters of the table object, and
`useHeaderCell` for what a header does. It still sorts from the keyboard, sticks its header and
reads correctly to a screen reader.

## Usage

The table object of `useDataTable` is itself a `TableProps`: its prop-getters are right on it, sized
to the row window. Spread each one on its element.

```vue
<script setup lang="ts">
import { getCellText, useDataTable } from 'vue-data-grid';

const table = useDataTable({ columns, rows, rowKey: 'id', rowHeight: 40 });
const { root, head, items, scope } = table;
const rendered = scope.renderedColumns;
</script>

<template>
	<div ref="root" v-bind="table.getGridProps()" aria-label="Tasks">
		<div ref="head" v-bind="table.getHeadProps()">
			<div v-bind="table.getHeaderRowProps()">
				<div v-for="cell in rendered" :key="cell.key" v-bind="table.getHeaderCellProps(cell)">
					{{ cell.column?.label }}
				</div>
			</div>
		</div>
		<div v-bind="table.getBodyProps()">
			<div v-for="item in items" :key="item.key" v-bind="table.getRowProps(item)">
				<div v-for="cell in rendered" :key="cell.key" v-bind="table.getCellProps(cell)">
					<template v-if="cell.column">{{ getCellText(cell.column, table.rows.value[item.index]) }}</template>
				</div>
			</div>
		</div>
	</div>
</template>
```

Call `useTableProps(scope, options)` yourself only on a table built on the engine of the core,
without `useDataTable`:

```ts
import { useTableEngine, useTableProps } from 'vue-data-grid';

const engine = useTableEngine({ columns, rows, root, rowKey: 'id', rowHeight: 40 });
const props = useTableProps(engine.scope, { navigation: true, footerRows: 1 });
```

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'role', type: 'MaybeRefOrGetter<\'grid\' | \'treegrid\' | \'table\'>', default: '\'grid\'', description: '`treegrid` when `nodes` are given. `table` for a table that is only read: its cells are `cell`, and nothing is selectable.' },
		{ name: 'navigation', type: 'boolean', default: 'false', description: 'Cells take part in `useGridNavigation`: body and header cells get `tabindex=&quot;-1&quot;`. Without it, header cells with keys of their own (sortable, movable, resizable) get `tabindex=&quot;0&quot;`. Read once.' },
		{ name: 'header', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Whether the markup renders the row of column headers.' },
		{ name: 'footerRows', type: 'MaybeRefOrGetter<number>', default: '0', description: 'Footer rows under the body, for `aria-rowcount` and the navigation.' },
		{ name: 'rowCount', type: 'MaybeRefOrGetter<number>', default: 'the length of rows', description: 'Body rows in the whole set when not all are loaded; `-1` when unknown.' },
		{ name: 'busy', type: 'MaybeRefOrGetter<boolean>', default: 'false', description: 'The table is loading: it gets `aria-busy` meanwhile.' },
		{ name: 'nodes', type: 'MaybeRefOrGetter<readonly RowNode[]>', description: 'The node of each body row, from a tree: level, place among siblings, expand state.' },
		{ name: 'selection', type: 'TableRowSelection', description: 'The row selection: rows get `aria-selected`, and the table `aria-multiselectable` in `multiple` mode.' },
		{ name: 'cellSelection', type: 'boolean', default: 'false', description: 'Cells can be selected: the table is `aria-multiselectable`, and `getCellProps` takes `selected`.' },
		{ name: 'indexAttribute', type: 'string', default: '\'data-tc-index\'', description: 'The attribute with the row index on every body row, for measuring. Read once.' },
		{ name: 'rowLayout', type: '\'positioned\' | \'flow\'', default: '\'positioned\'', description: 'Whether body rows are positioned by the row window or left in normal flow. Read once.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'getGridProps', type: '() => Props', description: 'The table element: `role`, `aria-rowcount`, `aria-colcount`, `aria-multiselectable`, `aria-busy`.' },
		{ name: 'getHeadProps', type: '() => Props', description: 'The header block, `role=&quot;rowgroup&quot;`, which the structural styles stick to the top.' },
		{ name: 'getBodyProps', type: '() => Props', description: 'The body block, with `data-tc-row-layout`. The table object sizes it to the row window.' },
		{ name: 'getFootProps', type: '() => Props', description: 'The footer block, stuck to the bottom.' },
		{ name: 'getGroupRowProps', type: '(level: number) => Props', description: 'A group row of the header, `level` from the top.' },
		{ name: 'getHeaderRowProps', type: '() => Props', description: 'The row of column headers.' },
		{ name: 'getRowProps', type: '(row: { index, key, node? }) => Props', description: 'A body row: `aria-rowindex` after the header rows, the index attribute, and in a tree `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded`; `aria-selected` with a selection. Pass the row\'s `node` so the row reads only its own.' },
		{ name: 'getFooterRowProps', type: '(index?: number) => Props', description: 'A footer row, `index` from the first one.' },
		{ name: 'getGroupCellProps', type: '(cell: RenderedGroup) => Props', description: 'A group cell: its geometry, `role=&quot;columnheader&quot;`, `aria-colindex` and `aria-colspan`.' },
		{ name: 'getHeaderCellProps', type: '(column: RenderedColumn) => Props', description: 'A column header: its geometry, `aria-colindex`, `aria-sort` of the first sort column, `tabindex`.' },
		{ name: 'getCellProps', type: '(column: RenderedColumn, state?: { selected?: boolean }) => Props', description: 'A body or footer cell: `gridcell`, `rowheader` for the row header column or `cell`, `aria-colindex`, `tabindex=&quot;-1&quot;` with the navigation, `aria-selected` with `state.selected`. One frozen object per column, shared by all rows.' },
		{ name: 'getInsetCellProps', type: '(side: \'start\' | \'end\') => Props', description: 'A cell in an inset at the edge of a row, outside the columns.' },
		{ name: 'getRangeProps', type: '(rect: RangeRect) => Props', description: 'A cell range drawn over the body, hidden from screen readers.' },
		{ name: 'getRangeCellProps', type: '(cell: ColumnSpanCell) => Props', description: 'A piece of a drawn range, with the sides it continues past.' },
		{ name: 'sections', type: 'ComputedRef<GridSection[]>', description: 'The sections of the grid these props put rows in, for `useGridNavigation`.' },
		{ name: 'headerRows', type: 'ComputedRef<number>', description: 'How many rows the header has: the group rows and the row of column headers.' },
	]"
/>

The props mark each element with a `data-tc-part`, which the structural styles and your theme find
it by:

<DataAttributesTable
	:data="[
		{ attribute: '[data-tc-part]', values: ['table', 'head', 'body', 'foot', 'row', 'range', 'range-cell'] },
		{ attribute: '[data-tc-column]', values: 'The column name, on its header, body and footer cells.' },
		{ attribute: '[data-tc-columns]', values: 'The columns under a group cell or a piece of a range.' },
		{ attribute: '[data-tc-pinned]', values: ['start', 'end'] },
		{ attribute: '[data-tc-align]', values: ['center', 'right'] },
		{ attribute: '[data-tc-row-layout]', values: ['positioned', 'flow'] },
		{ attribute: '[data-tc-index]', values: 'The index of a body row in the shown rows.' },
	]"
/>

## Examples

### Stable props, cheap rows

Every getter returns the same frozen object while nothing it depends on changes. A cell of a column
gets one object shared by every row, so Vue compares the props of a thousand cells by reference and
stops. Spread them as they are rather than copying them into a new object on each render.

### A static table

A report that is only read needs no grid semantics: pass `role: 'table'`. Cells become `cell`, header
cells stay `columnheader`, and nothing announces itself as selectable.

```ts
const table = useDataTable({ columns, rows, rowKey: 'id', rowHeight: 36, role: 'table' });
```

### Rows you do not have yet

A table that loads pages from a server tells assistive technology the size of the whole set:

```ts
const table = useDataTable({ columns, rows: page, rowKey: 'id', rowHeight: 40, rowCount: total });
```

## Accessibility

Adheres to the [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and
[Treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) patterns of WAI-ARIA.

- Rows are counted from the top of the header, group rows included, so `aria-rowindex` of every row
  agrees with `aria-rowcount` of the table, even when the row window renders a slice of the rows.
- In a multi-sort only the first sort column gets `aria-sort`, since ARIA has no sort levels; the
  announcer of `TableRoot` says the rest.
- Spacers of the column window are `role="presentation"`, and every real cell carries its
  `aria-colindex`, so a cell keeps its place while columns around it are not rendered.
- A leaf row of a tree gets no `aria-expanded`: only a row that can expand says whether it is.

## See also

- [Your own markup](/guides/custom-markup): building a table on the prop-getters.
- [useHeaderCell](/composables/use-header-cell): what a header cell does, for markup of your own.
- [Grid attributes](/composables/grid-attributes): the index props and grid attributes on their own.
