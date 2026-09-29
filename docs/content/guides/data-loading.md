---
title: Loading and empty states
description: Rows that come from a server, a loading bar while they are on their way, and a friendly message when there are none.
---

# Loading and empty states

<Description>
Rows often come from a server: page by page, sorted there, filtered there. The grid shows what it
has, a loading bar while more is on its way, and a message when there is nothing to show.
</Description>

<Demo name="data-loading" />

The demo talks to a pretend server with a latency you can set. Scroll to the end to load the next
page, click a header to sort on the server, or search for someone who is not there.

## The grid does not fetch

`useDataGrid` shows the rows you give it, and nothing else. Loading is your code: keep the rows in a
`ref`, fill it from your API, and the grid follows. That keeps any data layer you like, a plain
`fetch`, TanStack Query or Pinia, in charge of caching, retries and errors.

```ts
const people = shallowRef<readonly Person[]>([]);
const loading = shallowRef(true);

const grid = useDataGrid({ columns, rows: people, rowKey: 'id', rowHeight: 40 });

onMounted(async () => {
	people.value = await fetchPeople();
	loading.value = false;
});
```

Start requests in `onMounted` rather than in `setup`, so a page rendered on a server does not wait for
them, and keep `loading` `true` from the start, so the first paint shows the loading bar rather than
the empty state.

## Showing that it loads

`GridLoading` is a bar stuck to the bottom of the grid, over the rows and above a footer. Render it
while a request is on its way:

```vue
<GridRoot :grid="grid" label="People">
	<GridHeader>…</GridHeader>
	<GridBody>…</GridBody>
	<GridLoading v-if="loading">Loading people…</GridLoading>
</GridRoot>
```

While it is mounted the grid is `aria-busy`, and the announcer says that it is loading. Put it after
`GridBody` and before `GridFooter`. Without a slot it shows the `loading` message of the grid.

To mark the grid busy without the bar, such as while a spinner of your own turns elsewhere, call
`grid.markBusy()`; it returns the function that ends it.

For the first page, skeleton rows often say more than a bar: `GridPlaceholderRows` shows `count` rows
laid out as the columns, as tall as the rows, and marks the grid busy too. The demo shows ten of them
for the first page, three below the rows for each next one, and the bar only while a new search
replaces rows already shown.

```vue
<GridPlaceholderRows v-if="loading && people.length === 0" :count="10" />
<GridPlaceholderRows v-else-if="loadingMore" :count="3" />
<GridLoading v-if="loading && !loadingMore && people.length > 0">Loading people…</GridLoading>
```

## When there is nothing to show

`GridEmpty` renders only while the grid has no rows: one row with a cell across every column, so the
grid stays valid for assistive technology. It sticks to the start edge and takes the height the
header and the footer leave.

```vue
<GridEmpty>No one matches “{{ query }}”</GridEmpty>
```

It waits while the grid is busy, with `GridLoading` or `GridPlaceholderRows` mounted: "no rows" is not
true until the rows come. Without a slot it shows the `empty` message.

## Sorting and searching on the server

Leave the `sorting` feature out when the server sorts, pass your own `sort` ref, and fetch again when
it changes. Header clicks change the sort as before; the grid only stops reordering the rows itself.

```ts
const sort = shallowRef<readonly GridSort[]>([]);

const grid = useDataGrid({ columns, rows: people, rowKey: 'id', rowHeight: 40, sort });

watch([query, sort], () => {
	void load(0);
});
```

Answers can come back out of order, the answer to an old search after the one to a new search. The
demo counts its requests and drops any answer that is not the latest one.

## Loading more as people scroll

`useGridEdge` says when the rows in view come within ten rows of the last one. Load the next page
there and append it:

```ts
useGridEdge(grid, {
	edge: 'bottom',
	hasMore: () => people.value.length < total.value,
	busy: loading,
	onReach: () => load(people.value.length),
});
```

`onReach` returns the promise of `load`, and the edge waits for it before it calls again. `busy`
holds it while another load runs, such as the first page of a new search, without counting as a call:
once that is over, the edge is checked again. `hasMore` stays a fact about the data. The
appended rows keep the ones already shown as they are: their objects do not change, so they do not
render again. With [virtualization](/guides/virtualization) on, the grid stays light however many
pages people load.

Pages loaded at the top, skeleton rows and TanStack Query are in
[Pages and infinite scrolling](/guides/paging).

### The size of the whole set

Tell the grid how many rows there are in all with `rowCount`, while some are not loaded yet. It goes
into `aria-rowcount`, so a screen reader says "row 12 of 500" rather than "of 40":

```ts
rowCount: () => (total.value > people.value.length ? total.value : undefined),
```

Leave it `undefined` once everything is loaded, and `-1` when the size is unknown. For pages that
replace each other rather than add up, pass the size of the whole set as `rowCount` and the rows
before the page as `rowIndexOffset`, so the first row of the third page of twenty is "row 41": see
[Pages and infinite scrolling](/guides/paging#pages).

## Accessibility

- `GridLoading` sets `aria-busy` on the grid while it is mounted, and the announcer says the
  `loading` message once. The bar itself is `aria-hidden`: it would only repeat that.
- `GridEmpty` is a real row of the grid, with one cell spanning every column, counted into
  `aria-rowcount` while it shows. People who move into the grid with the keyboard land on the message
  rather than on nothing.
- `rowCount` keeps `aria-rowcount` true to the whole set while it loads in parts.
- Keep focus where it was when rows are appended: the grid does, since appending does not move the
  rows that are there.

## See also

- [Empty and loading](/components/empty-and-loading): the parts and their props.
- [Pages and infinite scrolling](/guides/paging): pages, loading at the top, TanStack Query and Nuxt.
- [`useGridEdge`](/composables/use-grid-edge)
- [Sorting](/guides/sorting): the sort as state, and sorting on a server.
- [Localization](/guides/localization): the `empty` and `loading` messages in other languages.
