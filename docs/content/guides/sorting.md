---
title: Sorting
description: Sort on the client with one feature, or let a server sort and keep the same headers.
---

# Sorting

<Description>
Sorting is two separate things: the sort itself, a list of columns and directions that header clicks
change, and the rows put in that order. The grid always keeps the first; the sorting feature does
the second on the client, or your server does.
</Description>

<Demo name="sorting" />

## Sortable columns

A column sorts once it is `sortable`. Turn it on column by column, or for every column of a builder
through its defaults:

```ts
const column = defineColumn<Stock>({ sortable: true });
```

A click on the header of a sortable column steps it through its `sortOrder`, then clears it: by
default a first click sorts descending, a second ascending, a third takes the column out of the sort.
Descending first suits numbers, where people usually look for the largest; for text, start
ascending. In the demo two builders share the difference:

```ts
const text = defineColumn<Stock>({ sortable: true, sortOrder: ['asc', 'desc'] });
const number = defineColumn<Stock>({ sortable: true, align: 'right' });
```

`sortOrder` can also hold a single direction, for a column that only ever sorts one way. Put a
`GridSortIndicator` in the header cell to show where a column stands; its slot takes an icon of your
own.

## Putting the rows in order

The `sorting` feature sorts the rows on the client by the current sort:

```ts
import { sorting, useDataGrid } from '@vue-data-grid/core';

const grid = useDataGrid({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 44,
	features: { sorting: sorting() },
});
```

The sort is stable, so rows that compare equal keep the order they came in, and it returns the same
array while neither the rows nor the sort change. Empty values, `null`, `undefined` and `NaN`, always
go last, in either direction: nobody sorts a price column to find the rows without a price.

### How values compare

Without anything else, numbers and dates compare by magnitude, `false` comes before `true`, and
everything else compares as text with numbers inside read as numbers, so `A9` comes before `A10`. The
text order uses fixed rules rather than the browser's language, so the page rendered on a server
sorts exactly as the browser does.

When the natural order is not the right one, give the column a `compare`. It receives two values of
the column and returns a negative number when the first goes first:

```ts
const RATINGS = ['Strong sell', 'Sell', 'Hold', 'Buy', 'Strong buy'];

rating: text(getRating, {
	label: 'Rating',
	sortOrder: ['desc', 'asc'],
	compare: (a, b) => RATINGS.indexOf(a) - RATINGS.indexOf(b),
}),
```

Write `compare` for the ascending order only. The grid applies the direction itself, and never
passes empty values to it.

## Several columns at once

With `multiSort`, a click with <kbd>Shift</kbd>, <kbd>Ctrl</kbd> or <kbd>⌘</kbd> adds the column to
the sort instead of replacing it. Rows are ordered by the first column, then by the second among rows
equal in the first, and so on. The indicator of each column shows its place.

```ts
const multiSort = shallowRef(true);

const grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 44, multiSort });
```

`multiSort` takes a boolean or a `ref` of one, which the grid follows: the switch in the demo turns
it off and on at run time.

## The sort as state

The sort is a list of `{ name, direction }` in the grid's column state, `grid.state.sort`. Pass
`sort` to start with a sort, or a `ref` of one to own it, as a model: the grid writes header clicks
into your ref, and follows what you write into it.

```ts
const sort = shallowRef<readonly GridSort[]>([{ name: 'marketCap', direction: 'desc' }]);

const grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 44, sort });

function sortByPrice() {
	sort.value = [{ name: 'price', direction: 'asc' }];
}
```

Names in a list passed as `sort` are checked against `columns` when compiling, so a typo fails the
build. A ref may hold any names, such as a model from `defineModel`; to check them too, type it by
the columns: `shallowRef<readonly GridSort<ColumnName<typeof columns>>[]>`.

Always replace the list; a list changed in place reaches no one. A sort that names a column the
grid does not have, such as one restored from an old version of your app, is left out, so it never
breaks the grid. To do what a header click does from code, call `grid.scope.toggleSort(name,
additive)`: it respects `sortable`, `sortOrder` and `multiSort`.

## Sorting on a server

When the rows come sorted from a server, leave the `sorting` feature out. Header clicks still change
the sort, the indicators and `aria-sort` still follow it, and the grid shows the rows in the order
you give them. Watch the sort and fetch:

```ts
const sort = shallowRef<readonly GridSort[]>([]);
const orders = shallowRef<readonly Order[]>([]);

const grid = useDataGrid({ columns, rows: orders, rowKey: 'id', rowHeight: 40, sort });

watch(sort, async (next) => {
	orders.value = await fetchOrders({ sort: next });
}, { immediate: true });
```

[Loading and empty states](/guides/data-loading) shows how to tell people that a request is on its
way.

## Sorting live data

Prices that change many times a second would re-sort the whole list on every change. With
`sorting({ delta: true })`, the grid places again only the rows that arrived as new objects, and
keeps the rest where they are. It relies on immutable updates: a row that changed is a new object,
and a row that did not is the same one. [Live data](/guides/live-data) puts it to work.

## Accessibility

- The header cell of the first sort column gets `aria-sort` with `ascending` or `descending`. ARIA
  has no sort levels, so only that one column carries it.
- The announcer of `GridRoot` says the whole sort whenever it changes, such as "Sorted by Rating
  descending, then Market cap descending", and "Not sorted" when it is cleared.
- The indicator is `aria-hidden`: the header cell already tells its state, and the mark would only
  repeat it.
- Without the `navigation` feature, the header of a sortable column is a Tab stop of its own; with it,
  the header cells are cells of the grid, reached with the arrow keys.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'Space'], description: 'On a header cell: sorts by the column, or steps it to its next direction.' },
		{ keys: ['Shift+Enter', 'Ctrl+Enter', 'Shift+Space'], description: 'On a header cell: adds the column to the sort, with `multiSort`.' },
	]"
/>

## See also

- [Columns](/guides/columns): the rest of the column API.
- [Sort indicator](/components/sort-indicator): the part that shows a column's direction.
- [Loading and empty states](/guides/data-loading): a server that sorts, with a loading bar.
- [Live data](/guides/live-data): `delta` sorting under a stream of updates.
