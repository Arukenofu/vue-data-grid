---
title: Column layout
description: Widths, order, pinning and visibility, the layout people shape by hand, kept in one piece of state you can save.
---

# Column layout

<Description>
Widths, order, pinned edges and hidden columns: the layout people shape by hand. The grid keeps all
of it in one small object, so saving it between visits is one option away.
</Description>

<Demo name="column-layout" />

Drag the edge of a header to resize a column, double-click it to fit the column to its content, or
hold <kbd>Alt</kbd> and press the arrow keys on a header to move it. Change a few things and reload
the page: the layout comes back.

## Rights come first

Every change of layout is something a column allows. In the demo one builder turns all four rights on
for every column, and the name column opts out of hiding:

```ts
const column = defineColumn<Person>({ resizable: true, movable: true, hideable: true, pinnable: true });

const columns = defineColumns({
	name: column('name', { label: 'Name', pinned: 'start', hideable: false }),
	// …
});
```

Everything below, from a handle to a call from code, checks the same rights, so a column that is not
`resizable` cannot be resized by any of them.

## Resizing

Put a `GridResizeHandle` in each header cell. It renders only for `resizable` columns, as a thin grab
area at the end edge of the cell:

```vue
<GridHeaderCell v-for="column in columns" :key="column.key" :column="column">
	<GridHeaderContent />
	<GridResizeHandle />
</GridHeaderCell>
```

While the pointer drags, the width changes once per animation frame and goes straight to a CSS
variable, so not a single cell renders again; the layout is written when the pointer is released.
`minWidth` and `maxWidth` keep the column within its limits. To set widths from code, use
`grid.scope.setWidths({ email: 240 })`.

## Fitting columns

Two helpers size several columns at once, each in a single write of the layout:

- `autosizeColumns(grid.scope, names?)` fits columns to their content, measured from the cells that
  are rendered. A double click on a resize handle does it for one column. Pass `{ rows: 'all' }` to
  also measure rows outside a [virtual window](/guides/virtualization), by the text of their `format`.
- `grid.scope.fitColumns(names?)` stretches or shrinks columns to the width of the grid, in
  proportion to their widths and within their limits.

Both leave service columns and columns that are not `resizable` alone. With
[`useGridMotion`](/composables/use-grid-motion), as in the demo, the columns glide to their new
widths instead of jumping.

## Pinning

A pinned column sticks to the start or the end edge while the rest scrolls under it. Declare where
it starts with `pinned`; a `pinnable` column can then be pinned and unpinned:

```ts
grid.scope.pinColumn('email', 'start');
grid.scope.pinColumn('email', null);
grid.scope.getPin('email');
```

A column that is not `pinnable` stays where it was declared. Pinned cells get
`data-dg-pinned="start"` or `"end"`; the structural styles make them opaque and draw a line at their
inner edge, and `--dg-pinned-background` sets their background.

## Hiding and showing

`hiddenByDefault` starts a column hidden. A `hideable` column can be toggled with
`grid.scope.toggleColumn(name)`, and `grid.scope.isColumnHidden(name)` says where it stands. A hidden
sorted column leaves the sort.

To build a menu of columns, list `grid.scope.orderedColumns`: every declared column in the current
order, hidden ones included. The demo's `ColumnsMenu.vue` turns them into the entries of a dropdown
menu, one checkbox for showing each column and one for pinning it.

## Reordering

People move a `movable` column with <kbd>Alt</kbd> and the arrow keys on its header, or by
[dragging it](/components/column-drag). From code:

```ts
grid.scope.moveColumnTo('salary', 2);
grid.scope.moveColumnBefore('salary', 'team');
grid.scope.moveColumnBy('salary', -1);
```

A move stays on the pinned side of the column, and never splits a
[column group](/guides/column-groups) that keeps its columns together. `canMoveColumnTo` and
`canMoveColumnBy` ask first. To make several changes in one go, so that everything that depends on
the layout updates once, wrap them in `grid.scope.batch(() => { … })`.

## One piece of state

All of the above lives in `grid.state.layout`:

```ts
interface GridLayout {
	order: string[];
	hidden: string[];
	widths: Record<string, number>;
	pinned: Record<string, 'start' | 'end'>;
	collapsed?: Record<string, boolean>;
}
```

`null` means the layout as declared. Pass a `ref` of your own as `layout` to own it, as a model: the
grid writes every change into it and follows what you write. A layout saved before you added a
column still works: the new column takes its declared place, next to the column declared before it.

## Keeping it between visits

Give the grid a store, and the layout and the sort survive a reload:

```ts
import { localStorageStore } from '@vue-data-grid/core';

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	persist: localStorageStore('orders-grid'),
	remember: ['order', 'hidden', 'widths', 'pinned'],
});
```

- `remember` picks what to keep, out of `order`, `hidden`, `widths`, `pinned`, `collapsed` and `sort`;
  everything by default.
- The record is read after the grid mounts, so a page rendered on a server hydrates with the
  declared layout and then takes the stored one. `grid.state.ready` turns `true` once it is applied.
- The stored record is checked field by field and carries a version. A broken or foreign record is
  ignored rather than breaking the grid.
- Grids with the same key share the record: a change in one reaches the others on the page at once,
  and those in other tabs too.
- `grid.state.reset()` goes back to the declared layout and the initial sort, and removes the record.

`sessionStorageStore` keeps the record for the life of the tab, and `memoryStore` only in memory. A
store is any object with `read` and `write`, and optionally `subscribe`, so the layout can live on
your server:

```ts
import type { PersistStore } from '@vue-data-grid/core';

const serverStore: PersistStore = {
	read: () => fetch('/api/layouts/orders').then(response => response.json()),
	write: (value) => {
		void fetch('/api/layouts/orders', { method: 'PUT', body: JSON.stringify(value) });
	},
};
```

`read` may return a promise; the grid applies the record when it arrives, unless the layout changed
in the meantime.

## Accessibility

- A resize handle is a focusable `role="separator"` with the width in `aria-valuenow`, its limits in
  `aria-valuemin` and `aria-valuemax`, and the width as words in `aria-valuetext`. It is named after its
  column, such as "Resize Salary".
- `aria-colcount` and `aria-colindex` follow the shown columns, so a hidden column leaves no gap in
  what a screen reader counts.
- Pinned cells stay in the DOM in the order they are shown, so reading order and visual order agree.
- Build menus of columns on an accessible menu, such as the Reka UI dropdown menu of the demo, so that
  every item is reachable with the keyboard and announces whether it is checked.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['←', '→'], description: 'On a resize handle: narrows or widens the column by 16 px.' },
		{ keys: ['Home'], description: 'On a resize handle: gives the column its `minWidth`.' },
		{ keys: ['End'], description: 'On a resize handle: gives the column its `maxWidth`, when it has one.' },
		{ keys: ['Shift+←', 'Shift+→'], description: 'On a header cell: narrows or widens a `resizable` column.' },
		{ keys: ['Alt+←', 'Alt+→'], description: 'On a header cell: moves a `movable` column one place.' },
	]"
/>

## See also

- [Resize handle](/components/resize-handle): the part and its options.
- [Column drag](/components/column-drag): reordering by dragging headers.
- [Column groups](/guides/column-groups): groups that collapse and keep their columns together.
- [`useGridMotion`](/composables/use-grid-motion): animated widths and moves.
