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

## When there is nothing to show

`GridEmpty` renders only while the grid has no rows: one row with a cell across every column, so the
grid stays valid for assistive technology. It sticks to the start edge and takes the height the
header and the footer leave.

```vue
<GridEmpty v-if="!loading">No one matches “{{ query }}”</GridEmpty>
```

The `v-if` keeps it away while the first page is loading: "no rows" is not true yet. Without a slot it
shows the `empty` message.

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

`grid.scope.visibleRange` holds the rows in view. When its end comes close to the last row, load the
next page and append it:

```ts
watch(() => grid.scope.visibleRange.value.end, (end) => {
	const more = people.value.length < total.value;

	if (more && !loading.value && end >= people.value.length - PREFETCH_ROWS) {
		void load(people.value.length);
	}
});
```

The appended rows keep the ones already shown as they are: their objects do not change, so they do not
render again. With [virtualization](/guides/virtualization) on, the grid stays light however many
pages people load.

### The size of the whole set

Tell the grid how many rows there are in all with `rowCount`, while some are not loaded yet. It goes
into `aria-rowcount`, so a screen reader says "row 12 of 500" rather than "of 40":

```ts
rowCount: () => (total.value > people.value.length ? total.value : undefined),
```

Leave it `undefined` once everything is loaded, and `-1` when the size is unknown. For pages that
replace each other rather than add up, leave `rowCount` out: rows are counted from the first row the
grid has.

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

- [Empty and loading](/components/empty-and-loading): both parts and their props.
- [Sorting](/guides/sorting): the sort as state, and sorting on a server.
- [Localization](/guides/localization): the `empty` and `loading` messages in other languages.
