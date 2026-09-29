---
title: Pages and infinite scrolling
description: Rows a page at a time, or more as people scroll in either direction, with TanStack Query, Nuxt or a plain fetch doing the loading.
---

# Pages and infinite scrolling

<Description>
Rows a page at a time, or more of them as people scroll, up as well as down. Your data layer loads
them and keeps them; the grid shows what it has, says how many there are in all, tells you when to
load more and keeps the rows people read in place.
</Description>

## Who does what

The grid does not fetch, and it has no pager and no data source of its own. Loading, caching,
retries and cancelling belong to your data layer, and a pager to your design system. What is left
to the grid is what they cannot know:

- `rowCount` and `rowIndexOffset` of `useDataGrid`: the size of the whole set and where the rows it
  has stand in it, for `aria-rowcount` and `aria-rowindex`.
- [`useGridEdge`](/composables/use-grid-edge): when the rows in view come close to an edge.
- Rows added above the ones in view keep those in place on the screen.
- [`GridPlaceholderRows`](/components/empty-and-loading#gridplaceholderrows): skeleton rows that
  stand for rows on their way.

The demos use [TanStack Query](https://tanstack.com/query/latest/docs/framework/vue/overview) with a
pretend server. Each demo gives its own `QueryClient`; an app installs the plugin once:

```ts
import { VueQueryPlugin } from '@tanstack/vue-query';

app.use(VueQueryPlugin);
```

## Pages

<Demo name="paging" />

Sort a column or change the page size, and the grid goes back to the first page. While the next
page is on its way, the one you had stays, under a loading bar.

```ts
import { keepPreviousData, useQuery } from '@tanstack/vue-query';

const page = shallowRef(0);
const size = shallowRef(20);
const sort = shallowRef<readonly GridSort[]>([]);

const { data, isPending, isPlaceholderData } = useQuery({
	queryKey: ['people', page, size, sort],
	queryFn: () => fetchPeoplePage({ page: page.value, size: size.value, sort: sort.value }),
	placeholderData: keepPreviousData,
});

const grid = useDataGrid({
	columns,
	rows: () => data.value?.rows ?? [],
	rowKey: 'id',
	rowHeight: 40,
	sort,
	rowCount: () => data.value?.total,
	rowIndexOffset: () => data.value?.offset ?? 0,
});
```

```vue
<GridRoot :grid="grid" label="People">
	<UiDataGridHeader />
	<GridBody>…</GridBody>
	<GridPlaceholderRows v-if="isPending" :count="size" />
	<GridEmpty />
	<GridLoading v-if="isPlaceholderData" />
</GridRoot>
<Pager v-model:page="page" :pages="Math.ceil((data?.total ?? 0) / size)" />
```

- `rowCount` is the size of the whole set and `rowIndexOffset` the rows before the page, so the first
  row of the third page of twenty is "row 41 of 500" to a screen reader. Take the offset from the
  answer, not from `page`: with `keepPreviousData` the rows on screen are still those of the page
  before while the next one loads.
- Without the `sorting` feature the grid does not sort the rows itself: header clicks change `sort`,
  the query key changes with it, and the server sorts.
- The skeleton rows show only while there is nothing yet; after that the old page stays and
  `GridLoading` says that another is coming.

### With Nuxt

`useFetch` follows the refs in `query` and fetches again when they change. Awaited in `setup`, the
first page renders on the server, see [Server rendering and Nuxt](/guides/server-rendering):

```ts
const page = ref(0);

const { data, status } = await useFetch<PeoplePage>('/api/people', {
	query: { page, size: 20 },
});

const grid = useDataGrid({
	columns,
	rows: () => data.value?.rows ?? [],
	rowKey: 'id',
	rowHeight: 40,
	rowCount: () => data.value?.total,
	rowIndexOffset: () => data.value?.offset ?? 0,
});
```

```vue
<GridLoading v-if="status === 'pending'" />
```

## Infinite scrolling

<Demo name="infinite-rows" />

The log opens in the middle of the day. Scroll down for later events and up for earlier ones: the
events you are reading stay where they are while earlier ones load above them.

```ts
import { useInfiniteQuery } from '@tanstack/vue-query';

const {
	data, isFetching, isFetchingNextPage, isFetchingPreviousPage,
	hasNextPage, hasPreviousPage, fetchNextPage, fetchPreviousPage,
} = useInfiniteQuery({
	queryKey: ['events'],
	queryFn: ({ pageParam }) => fetchEvents(pageParam),
	initialPageParam: START_PAGE,
	getNextPageParam: page => page.next,
	getPreviousPageParam: page => page.previous,
});

const grid = useDataGrid({
	columns,
	rows: () => data.value?.pages.flatMap(page => page.rows) ?? [],
	rowKey: 'id',
	rowHeight: 36,
	virtual: true,
	rowCount: () => (hasNextPage.value || hasPreviousPage.value ? -1 : undefined),
});

useGridEdge(grid, {
	edge: 'bottom',
	hasMore: hasNextPage,
	busy: isFetching,
	onReach: () => fetchNextPage(),
});

useGridEdge(grid, {
	edge: 'top',
	hasMore: hasPreviousPage,
	busy: isFetching,
	onReach: () => fetchPreviousPage(),
});
```

```vue
<GridRoot :grid="grid" label="Event log">
	<UiDataGridHeader />
	<GridPlaceholderRows v-if="isFetchingPreviousPage" edge="top" :count="3" />
	<GridBody>…</GridBody>
	<GridPlaceholderRows v-if="isFetchingNextPage" :count="3" />
</GridRoot>
```

- `useGridEdge` calls `onReach` when the rows in view come within ten rows of the edge, and again
  when a page came in and the edge is still that close. It waits for a promise `onReach` returns.
- TanStack Query runs one request for the list at a time and drops the answer to one on its way when
  asked for another page, so each edge waits while the other loads: `busy: isFetching`. Once it is
  over, the edge is checked again.
- Rows the flattened pages add at the top move the rows in view by as much as the new rows are tall,
  so they stay where they were on the screen, even at the very top while the top edge is watched. So
  do the placeholder rows at the top: they show once people scroll up to them.
- The placeholder rows take the height of the rows.
- `-1` for `rowCount` tells a screen reader that the size of the log is not known yet.
- The rows are windowed with `virtual: true`: however many pages come in, the grid renders only the
  rows in view.

### Rows added above

The grid keeps the rows in view in place when rows come in or go above them and the rows in view kept
their order, as when a page is prepended, or prepended while one is dropped at the bottom with
`maxPages`: it scrolls by as much as the rows above them grew. A sort or a filter that changes the
rows in view leaves the scroll where it is. At the very top it does so only while something holds
the rows there, as a watched top edge does (`grid.holdAnchorAtTop()`); otherwise rows that come in
there show, as in a feed.

The browser's own scroll anchoring is off in the grid's structural styles, so that browsers do not
move the rows a second time. With markup of your own and without those styles, give the root
`overflow-anchor: none`.

### With Nuxt

Keep the pages you have in a ref, and move the cursor of `useFetch` to load the next one. `onReach`
returns nothing here, and the edge waits for the rows to change before it calls again:

```ts
const cursor = ref<number | null>(null);
const events = shallowRef<readonly LogEvent[]>([]);

const { data, status } = await useFetch<EventPage>('/api/events', { query: { cursor } });

watch(data, (page) => {
	if (page) {
		events.value = [...events.value, ...page.rows];
	}
}, { immediate: true });

const grid = useDataGrid({ columns, rows: events, rowKey: 'id', rowHeight: 36, virtual: true });

useGridEdge(grid, {
	edge: 'bottom',
	hasMore: () => data.value?.next != null,
	onReach: () => {
		cursor.value = data.value?.next ?? null;
	},
});
```

```vue
<GridPlaceholderRows v-if="status === 'pending'" :count="3" />
```

### Columns as well

`'start'` and `'end'` watch the columns the same way, for a timeline that loads more days as people
scroll sideways; see the demo of [`useGridEdge`](/composables/use-grid-edge). The grid keeps rows in
place when they come in above, but not yet columns that come in at the start: scroll the root by
their width yourself, or the edge is reached again at once.

## Accessibility

- `rowCount` and `rowIndexOffset` keep `aria-rowcount` and `aria-rowindex` true to the whole set:
  "row 41 of 500" on the third page, not "row 1 of 20". `-1` says the size is not known.
- `GridPlaceholderRows` and `GridLoading` mark the grid `aria-busy` while they are shown, and the
  announcer says that it is loading. The placeholder rows are hidden from screen readers and are not
  rows of the grid.
- Give the pager a `nav` with a name, and buttons that say which page they go to.
- Moving with the keyboard scrolls the focused row into view, so loading follows the keys as it
  follows the scroll.

## See also

- [`useGridEdge`](/composables/use-grid-edge)
- [Empty and loading](/components/empty-and-loading): `GridPlaceholderRows`, `GridLoading` and
  `GridEmpty`.
- [Loading and empty states](/guides/data-loading): loading with a plain `fetch`, sorting and
  searching on a server.
- [Virtualization](/guides/virtualization)
