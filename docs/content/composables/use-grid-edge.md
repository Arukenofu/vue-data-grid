---
title: useGridEdge
description: Tells when to load more at an edge of the grid - rows at the top or the bottom, columns at the start or the end - and leaves the loading to your data layer.
---

# useGridEdge

<Description>
Tells when to load more at an edge of the grid: rows at the top or the bottom, columns at the start
or the end. It does not load anything itself: your data layer does, TanStack Query, Nuxt's
`useFetch` or a plain `fetch`, and the grid shows what it gets.
</Description>

<Demo name="api-use-grid-edge" />

Scroll the days to the right: two weeks before the last one, two more weeks come in, until the
quarter ends. The service names stay pinned and never count as being in view.

## Usage

```ts
import { useDataGrid, useGridEdge } from '@vue-data-grid/core';
import { useInfiniteQuery } from '@tanstack/vue-query';

const { data, hasNextPage, fetchNextPage } = useInfiniteQuery({ … });

const grid = useDataGrid({
	columns,
	rows: () => data.value?.pages.flatMap(page => page.rows) ?? [],
	rowKey: 'id',
	rowHeight: 36,
});

useGridEdge(grid, {
	edge: 'bottom',
	hasMore: hasNextPage,
	onReach: () => fetchNextPage(),
});
```

One call watches one edge; call it once more for another, such as `'top'` for the pages before.
[Pages and infinite scrolling](/guides/paging) shows it with TanStack Query and Nuxt.

## Arguments

<PropsTable
	label="Argument"
	:data="[
		{ name: 'grid', type: 'Pick<DataGrid, \'scope\' | \'holdAnchorAtTop\'>', required: true, description: 'The grid: the rows and columns in view come from its `scope`; at the top it holds the rows in view in place.' },
		{ name: 'options', type: 'GridEdgeOptions', required: true, description: 'The edge and what to do there, below.' },
	]"
/>

### Options

<PropsTable
	:data="[
		{ name: 'edge', type: '\'top\' | \'bottom\' | \'start\' | \'end\'', required: true, description: 'The edge to watch: `top` and `bottom` of the rows, `start` and `end` of the columns in the reading direction. Read once.' },
		{ name: 'onReach', type: '(context: { edge }) => unknown', required: true, description: 'Loads more and puts it into the rows or the columns. A promise it returns holds further calls until it settles.' },
		{ name: 'hasMore', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Whether there is more to load at the edge, such as `hasNextPage` of TanStack Query.' },
		{ name: 'busy', type: 'MaybeRefOrGetter<boolean>', default: 'false', description: 'Whether a load is on its way that `onReach` did not return, such as `isFetching` of a query that loads both edges. The edge waits for it as for a pending promise, and is checked again once it is over.' },
		{ name: 'threshold', type: 'MaybeRefOrGetter<number>', default: '10 rows, 2 columns', description: 'How many rows or columns may be left between the ones in view and the edge when it counts as reached.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'reached', type: 'ComputedRef<boolean>', description: 'Whether the rows or columns in view are within `threshold` of the edge now.' },
		{ name: 'pending', type: 'Readonly<Ref<boolean>>', description: 'Whether the promise the last `onReach` returned is still unsettled.' },
	]"
/>

## When it calls

- When the rows or the columns in view come within `threshold` of the edge, `hasMore` is not
  `false`, and neither a promise from `onReach` nor `busy` holds it.
- Again once the rows or the columns changed and the edge is still that close, such as when a short
  page does not fill the view, or a new query brought a first page as long as the old one.
- Not again for a load that brought nothing, until the edge is left and reached again: a failing
  request does not repeat in a loop.
- Never for an empty grid, or before the grid is mounted: the first page is yours to load, and
  on a server nothing is in view.

Pinned columns are always in view and are not counted: the `'start'` and `'end'` edges are those of
the columns that scroll.

At `'start'` the grid does not keep the columns in view in place yet, as it does with rows at the
top: columns added before them push them away, and the edge is reached again at once. Scroll the
root by the width of the columns you added, after they render.

## Examples

### With a plain fetch

Return the promise, and `pending` tells you when to show that more is coming:

```ts
const people = shallowRef<Person[]>([]);
const total = shallowRef(Infinity);

const bottom = useGridEdge(grid, {
	edge: 'bottom',
	hasMore: () => people.value.length < total.value,
	onReach: async () => {
		const page = await fetchPeople({ offset: people.value.length });

		people.value = [...people.value, ...page.rows];
		total.value = page.total;
	},
});
```

```vue
<GridPlaceholderRows v-if="bottom.pending.value" :count="3" />
```

### Pages above

Rows added at the top do not move the rows in view: the grid keeps them where they were on the
screen, so people keep reading while earlier rows load above them. Without a watched top edge, rows
that come in while the grid is scrolled to the very top show there, as new entries of a feed do; the
top edge holds the rows in place there too, or each page would bring the edge back into view and
load the next one.

```ts
useGridEdge(grid, {
	edge: 'top',
	hasMore: hasPreviousPage,
	onReach: () => fetchPreviousPage(),
});
```

### Two edges and one request

A data layer may run one request for a list at a time: TanStack Query drops the answer to a request
on its way when it is asked for another page. Pass its busy state as `busy`: the edge waits for the
request of the other edge, and is checked again once it is over.

```ts
useGridEdge(grid, { edge: 'bottom', hasMore: hasNextPage, busy: isFetching, onReach: () => fetchNextPage() });
useGridEdge(grid, { edge: 'top', hasMore: hasPreviousPage, busy: isFetching, onReach: () => fetchPreviousPage() });
```

## Accessibility

- Say the size of the list while it grows: `rowCount` of `useDataGrid` with the whole size, or `-1`
  while it is unknown, so a screen reader does not read the loaded rows as all of them.
- Mark the grid busy while more loads, with `GridPlaceholderRows` or `GridLoading`: both set
  `aria-busy` and the announcer says the grid is loading.
- Loading follows the rows in view, and the rows in view follow the focus, so moving with the
  keyboard toward an edge loads more the same way scrolling does.

## See also

- [Pages and infinite scrolling](/guides/paging): pages, infinite scrolling both ways, TanStack Query
  and Nuxt.
- [Empty and loading](/components/empty-and-loading): `GridPlaceholderRows`, the rows that stand for
  rows on their way.
- [Loading and empty states](/guides/data-loading)
