---
title: useDataGrid
description: A whole grid in one call — the column state, the row pipeline of its features, the engine and the markup props.
---

# useDataGrid

<Description>
A whole grid in one call: the column state, the rows after every feature, the row and column
windows, and the props of every element. What it returns is the grid object the parts render.
</Description>

<Demo name="api-use-data-grid" />

Everything above the grid in this demo is read straight from the grid object: how many rows the
row window renders, the sort in the column state, the height of all rows. Turn off the virtual rows
and the window renders every row.

## Usage

```ts
import { defineColumn, defineColumns, selection, sorting, useDataGrid } from '@vue-data-grid/core';

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	name: column('name', { label: 'Name', width: 180 }),
	salary: column('salary', { label: 'Salary', align: 'right' }),
});

const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 40,
	virtual: true,
	features: {
		sorting: sorting(),
		selection: selection(),
	},
});
```

Call it in `setup`. It does not provide anything by itself: pass the grid to `GridRoot`, which
provides it to the parts, or call `createDataGridContext(grid)` for parts under markup of your own,
with `createGridTemplatesContext()` when they take column templates
(see [Contexts](/composables/contexts#parts-under-your-own-markup)).

## Options

### Data

<PropsTable
	label="Option"
	:data="[
		{ name: 'columns', type: 'MaybeRefOrGetter<Columns>', required: true, description: 'Columns from `defineColumns`, as an object by name or an array. Declare them once, outside a `computed`: they are compared by reference.' },
		{ name: 'rows', type: 'MaybeRefOrGetter<readonly TRow[]>', required: true, description: 'The source rows: an array, a ref or a getter. The features group, sort and flatten them before the grid renders them. Replace the array to change them: rows are never mutated.' },
		{ name: 'rowKey', type: 'keyof TRow | ((row: TRow) => string)', required: true, description: 'A field or a function that identifies a row. Focus, selection, measured heights and ranges hold on to the key while rows move. Keys must be unique; a duplicate warns in development. Read once.' },
		{ name: 'features', type: 'DataGridFeatures', description: 'The features, each from its factory: `{ sorting: sorting(), selection: selection() }`.' },
		{ name: 'groups', type: 'MaybeRefOrGetter<ColumnGroups>', description: 'Column groups from `defineColumnGroups`: the rows of group headers above the columns.' },
	]"
/>

### Rows and windows

<PropsTable
	label="Option"
	:data="[
		{ name: 'rowHeight', type: 'number | Ref<number> | ((row: TRow, index: number) => number)', required: true, description: 'The height of a row, px, or with `measureRows` its first estimate. A function is always a height function of the row. There is no default: rows are positioned by it.' },
		{ name: 'measureRows', type: 'MaybeRefOrGetter<boolean>', default: 'false', description: 'Measure rows in the DOM, for rows whose height depends on their content. Bind `grid.measureElement` to each row; `GridRow` does it.' },
		{ name: 'virtual', type: 'MaybeRefOrGetter<boolean | VirtualOptions>', default: 'false', description: 'Render only the rows and columns in view. `true` turns on both windows; an object picks `rows`, `columns`, `overscan` (rows past each edge, `6`), `bufferPx` (width past each edge, `200`) and `ssrRows` (rows rendered before mount, `24`).' },
		{ name: 'keepRows', type: 'MaybeRefOrGetter<readonly number[]>', description: 'Row indexes that stay rendered whatever the window says, such as a row being edited far away.' },
		{ name: 'keepColumns', type: 'MaybeRefOrGetter<readonly string[]>', description: 'Column names that stay rendered whatever the column window says.' },
		{ name: 'rowLayout', type: '\'positioned\' | \'flow\'', default: '\'positioned\'', description: 'How body rows are laid out: stacked at their offsets by the row window, or left in normal flow. Read once.' },
		{ name: 'indexAttribute', type: 'string', default: '\'data-dg-index\'', description: 'The attribute with the row index that every body row carries, by which rows are measured and animated. Read once.' },
	]"
/>

### Column state

The order, widths, pins, hidden columns, collapsed groups and the sort live in a column state. Give
the grid options to create one, or a `state` of your own, not both: with `state` the other options
are ignored, with a warning in development.

<PropsTable
	label="Option"
	:data="[
		{ name: 'sort', type: 'GridSort<ColumnName>[] | Ref<GridSort[]>', default: '[]', description: 'The initial sort, its names checked against `columns` when compiling, or a ref of it as a model: the state writes to it and follows it, as `v-model:sort` does. The ref may hold any names.' },
		{ name: 'layout', type: 'Ref<GridLayout | null>', description: 'A ref of the layout as a model; `null` in it means the declared layout.' },
		{ name: 'multiSort', type: 'MaybeRef<boolean>', default: 'false', description: 'Whether a header click with Shift, Ctrl or ⌘ adds a column to the sort instead of replacing it.' },
		{ name: 'persist', type: 'PersistStore', description: 'Where the state is kept between visits, such as `localStorageStore(\'people\')`. Read once.' },
		{ name: 'remember', type: 'RememberField[]', default: 'every field', description: 'What `persist` keeps: `order`, `hidden`, `widths`, `pinned`, `collapsed`, `sort`.' },
		{ name: 'state', type: 'GridColumnsState', description: 'A state of your own from `useGridColumnsState`, such as one shared by two grids.' },
	]"
/>

### Markup

<PropsTable
	label="Option"
	:data="[
		{ name: 'role', type: 'MaybeRefOrGetter<\'grid\' | \'treegrid\' | \'table\'>', default: '\'grid\'', description: '`treegrid` by default with the `tree` feature. `table` for a grid that is only read: its cells are `cell`, not `gridcell`, and nothing is selectable.' },
		{ name: 'header', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Whether the markup renders the row of column headers. `false` for a grid without `GridHeader`, so that `aria-rowcount` and `aria-rowindex` leave the header row out.' },
		{ name: 'footerRows', type: 'MaybeRefOrGetter<number>', default: '0', description: 'Footer rows you render yourself, for `aria-rowcount`. A `GridFooterRow` counts itself.' },
		{ name: 'rowCount', type: 'MaybeRefOrGetter<number>', description: 'Body rows in the whole set when not all are loaded, or `-1` when unknown: the `aria-rowcount` of a grid that pages on a server.' },
		{ name: 'insets', type: 'MaybeRefOrGetter<{ start: number; end: number }>', description: 'Widths of decoration at each edge of a row, px, outside the columns; pinned columns stick after them. Render them with `getInsetCellProps`.' },
		{ name: 'cellStyles', type: 'GridCellStyles', default: 'FLEX_CELL_STYLES', description: 'How geometry becomes the styles of cells, group cells and spacers. The default lays a row out as a flex line. Read once.' },
	]"
/>

## Returns

`useDataGrid` returns the **grid object**, a `DataGrid`. It is itself a set of prop-getters, so
the object goes wherever [useGridProps](/composables/use-grid-props) is taken.

### Elements

<ReturnsTable
	:data="[
		{ name: 'root', type: 'ShallowRef<HTMLElement | null>', description: 'The scroll container. `GridRoot` binds it; with your own markup, bind it with `ref`.' },
		{ name: 'head', type: 'ShallowRef<HTMLElement | null>', description: 'The sticky header, measured so scrolling to a row never leaves it under the header.' },
		{ name: 'body', type: 'ShallowRef<HTMLElement | null>', description: 'The body block, which dragging rows and cell ranges work in. `GridBody` binds it.' },
		{ name: 'foot', type: 'ShallowRef<HTMLElement | null>', description: 'The sticky footer, measured for the bottom edge.' },
		{ name: 'exit', type: 'ShallowRef<HTMLElement | null>', description: 'The focusable element after the grid that Tab leaves the grid through. `GridRoot` renders it with the `navigation` feature.' },
		{ name: 'headHeight', type: 'Readonly<Ref<number>>', description: 'The height of the header, px; `0` without one.' },
		{ name: 'footHeight', type: 'Readonly<Ref<number>>', description: 'The height of the footer, px; `0` without one.' },
	]"
/>

### Rows and columns

<ReturnsTable
	:data="[
		{ name: 'rows', type: 'ComputedRef<readonly TRow[]>', description: 'The rows the grid shows, after every feature: grouped, sorted, flattened.' },
		{ name: 'leaves', type: 'ComputedRef<readonly TRow[]>', description: 'The rows totals are counted over: the leaves of the tree, collapsed ones too, else `rows`. Footers read it.' },
		{ name: 'items', type: 'ComputedRef<readonly VirtualItem[]>', description: 'The row window: `{ key, index, start, end, size }` of each row to render. Every row without a window.' },
		{ name: 'totalSize', type: 'ComputedRef<number>', description: 'The height of all body rows, px: the height of the body block.' },
		{ name: 'measureElement', type: '(element) => void', description: 'Measures a body row with `measureRows`: bind it to the row with `:ref`.' },
		{ name: 'windowed', type: 'ComputedRef<boolean>', description: 'Whether the column window leaves columns out right now.' },
		{ name: 'getNodeAt', type: '(index: number) => RowNode | undefined', description: 'The tree node of the shown row at `index`: level, parent, expanded, place among siblings.' },
		{ name: 'scope', type: 'GridScope<TRow>', description: 'The engine: shown and rendered columns, widths, pins, sort, scrolling.' },
		{ name: 'state', type: 'GridColumnsState', description: 'The column state: `sort`, `layout`, `multiSort`, `reset()`, `ready`.' },
	]"
/>

### Prop-getters

The grid object carries every prop-getter of [useGridProps](/composables/use-grid-props), with
two of them sized by the row window:

<ReturnsTable
	:data="[
		{ name: 'getBodyProps', type: '() => Props', description: 'The props of the body block; with positioned rows it is as tall as all rows.' },
		{ name: 'getRowProps', type: '(row: VirtualItem | { index, key }) => Props', description: 'The props of a body row; with positioned rows also its `top` below the header and its height.' },
		{ name: 'indexAttribute', type: 'string', description: 'The attribute `getRowProps` puts the row index in.' },
	]"
/>

### Features

<ReturnsTable
	:data="[
		{ name: 'grouping', type: 'GridRowsFeature | undefined', description: 'The rows after grouping.' },
		{ name: 'sorting', type: 'GridRowsFeature | undefined', description: 'The rows after sorting.' },
		{ name: 'tree', type: 'GridTreeFeature | undefined', description: 'Nodes, expand and collapse.' },
		{ name: 'selection', type: 'GridSelectionFeature | undefined', description: 'Selected rows and what changes them.' },
		{ name: 'navigation', type: 'GridNavigationFeature | undefined', description: 'The focused cell and `focusCell`.' },
		{ name: 'ranges', type: 'CellRanges | undefined', description: 'Cell ranges.' },
		{ name: 'editing', type: 'GridEditingFeature | undefined', description: 'The cell being edited, writes, paste.' },
		{ name: 'history', type: 'ChangeHistory | undefined', description: 'Undo and redo.' },
		{ name: 'fill', type: 'GridFillFeature | undefined', description: 'The fill handle.' },
		{ name: 'clipboard', type: 'GridClipboard | undefined', description: 'Copy and the text a copy takes.' },
	]"
/>

Each handle is typed by the feature you passed, and is `undefined` for one you did not:
`grid.selection` is a `RowSelection` in a grid with `selection()`, and `undefined` in one without.

### Hooks for parts

These are what the parts use to tell the grid about themselves. Parts of your own use them too.

<ReturnsTable
	:data="[
		{ name: 'addLayers', type: '(layers: MaybeRefOrGetter<GeometryLayer[]>) => () => void', description: 'Writes styles of your own to exactly the elements a selector finds, next to the engine\'s geometry, until the returned function is called. Elements that mount meanwhile get them too. For what changes every frame without a render, such as the cells of a column under a drag.' },
		{ name: 'markBusy', type: '() => () => void', description: 'Marks the grid `aria-busy` until the returned function is called, as `GridLoading` does.' },
		{ name: 'isBusy', type: 'ComputedRef<boolean>', description: 'Whether anything marked the grid busy.' },
		{ name: 'addFooterRows', type: '(count: number) => () => void', description: 'Counts footer rows into `aria-rowcount` until the returned function is called.' },
		{ name: 'addBodyRows', type: '(count: number) => () => void', description: 'Counts body rows that stand for no row, such as the row of `GridEmpty`, into `aria-rowcount`.' },
	]"
/>

## Examples

### Sorting on a server

Leave out the `sorting` feature: the rows stay in the order you give them, while header clicks still
change the sort. Keep the sort in a ref and load the rows it asks for.

```ts
const sort = ref<GridSort[]>([{ name: 'created', direction: 'desc' }]);
const rows = shallowRef<Order[]>([]);

const grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 40, sort });

watch(sort, async (next) => {
	rows.value = await api.orders({ sort: next });
}, { immediate: true });
```

### Keeping the layout between visits

`persist` keeps the widths, order, pins, hidden columns and the sort in a store. The record is read
after mount, so the server-rendered markup still matches the first render.

```ts
import { localStorageStore, useDataGrid } from '@vue-data-grid/core';

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	persist: localStorageStore('orders-grid'),
	remember: ['widths', 'order', 'hidden'],
});
```

### Rows of different heights

Give an estimate and let the grid measure. `GridRow` binds `measureElement` for you.

```ts
const grid = useDataGrid({
	columns,
	rows: comments,
	rowKey: 'id',
	rowHeight: 64,
	measureRows: true,
	virtual: true,
});
```

### Typing a component that takes a grid

A component that renders any grid of people takes a `DataGrid<Person>`: every feature handle may
be `undefined` there. Name the handles it needs in the second parameter.

```ts
import type { DataGrid, GridSelectionFeature } from '@vue-data-grid/core';

defineProps<{
	grid: DataGrid<Person, { selection: GridSelectionFeature }>;
}>();
```

::: warning Let the types be inferred
`useDataGrid<Person>({ … })` with an explicit type argument fixes the other parameters at their
defaults, so every feature handle is typed `undefined`. Type the rows instead, with a typed array or
`defineColumn<Person>()`, and let `useDataGrid` infer the rest.
:::

## Accessibility

The grid object is the source of every ARIA attribute the parts render, so a grid of parts and
a grid of your own markup on its prop-getters say the same to assistive technology:

- the role of the grid follows the features: `grid`, `treegrid` with a tree, or `table` by `role`;
- `aria-rowcount` counts the header rows, the body rows, or `rowCount` when you pass it, and the
  footer rows; `aria-rowindex` of each row agrees with it, so a screen reader knows where it is
  even while the row window renders a slice;
- `aria-multiselectable` follows the selection mode, and `aria-busy` follows `markBusy`;
- with the `navigation` feature, cells take `tabindex="-1"` and the grid becomes one Tab stop.

## See also

- [Features](/composables/features): what each feature adds and how to write your own.
- [useGridProps](/composables/use-grid-props): the prop-getters on their own.
- [Root](/components/root): the part that takes the grid object.
