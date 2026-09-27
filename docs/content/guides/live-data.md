---
title: Live data
description: Tables that update many times a second, where only the rows that changed render, sorted tables re-sort only what moved, and changed cells flash.
---

# Live data

<Description>
Price feeds, monitoring dashboards, order books: tables that change many times a second. Only the
rows that changed render again, a sorted table re-sorts only the rows that moved, and each changed
cell can flash up or down.
</Description>

<Demo name="live-data" />

The numbers on the right tell the story: every second dozens of quotes arrive, and only the cells of
those rows render again, not the whole table. Push the slider up, then pause the feed: the table
stays sorted by the change of the day the whole time.

## Why it stays fast

The table compares rows **by reference**. A row that is the same object as before is the same row:
its component does not render again, its cells are not touched. A row that changed is a new object,
and only it renders.

So the one rule of live data is: never change a row in place, replace it.

```ts
const next = { ...stock, price: 184.2 };
```

Everything below builds on that rule.

## Collecting updates with `useRowStream`

A feed sends updates one by one, often several for the same row within a frame. Rendering after each
of them would waste most of the work. `useRowStream` collects them and applies them in one batch per
animation frame:

```ts
import { useDataTable, useRowStream } from '@vue-stack/table';

const stream = useRowStream({ rows: initialStocks, rowKey: 'id' });

const table = useDataTable({
	columns,
	rows: stream.rows,
	rowKey: 'id',
	rowHeight: 40,
});

socket.on('quote', (quote) => {
	stream.patch(quote.id, { price: quote.price });
});
```

<ReturnsTable
	:data="[
		{ name: 'rows', type: 'ComputedRef<readonly TRow[]>', description: 'The rows with every batch applied: a new array only when a batch changed something, and every untouched row the same object.' },
		{ name: 'apply(transaction)', type: 'void', description: 'Queues `{ add, update, remove }`: rows to add or replace by key, rows to replace, and keys to remove. The last change of a key wins.' },
		{ name: 'patch(key, fields)', type: 'boolean', description: 'Queues the row as `{ ...row, ...fields }`, for plain-object rows; `false` when there is no row with that key.' },
		{ name: 'getRow(key)', type: 'TRow | undefined', description: 'The row with the changes still waiting for the batch, to build the next update from.' },
		{ name: 'flush()', type: 'void', description: 'Applies the waiting changes now instead of at the next frame.' },
		{ name: 'reset(rows)', type: 'void', description: 'Starts over from a new snapshot and drops the waiting changes.' },
	]"
/>

`wait: 250` collects for a quarter of a second instead of a frame, for a calmer table. A tab in the
background has no frames at all: its changes collect, one per key, until it is visible again, so a
hidden table costs nothing.

## Sorting a moving target

A table sorted by price has to re-sort whenever a price changes. Sorting everything again each frame
is wasteful when three rows of a thousand changed, so the sorting feature can re-sort only the rows
that arrived as new objects and put them into their places among the others:

```ts
import { sorting } from '@vue-stack/table';

const table = useDataTable({
	columns,
	rows: stream.rows,
	rowKey: 'id',
	rowHeight: 40,
	sort: [{ name: 'change', direction: 'desc' }],
	features: { sorting: sorting({ delta: true }) },
});
```

The rows that did not change keep their order, and the changed ones are sorted and merged in among
them: the same order a full sort gives, but for rows with equal values, which may stand in another
order among themselves. It relies on the rule above: a row changed in place would not be seen as
changed at all.

## Showing what changed

`useCellChanges` watches the rows for changed values and remembers each change for a moment, with its
direction:

```ts
import { useCellChanges } from '@vue-stack/table';

const changes = useCellChanges(table.scope, { duration: 900, columns: ['price', 'change'] });
```

`changes.getChange(key, column)` gives `{ direction, at }` while the change is fresh: `direction` is
`'up'` or `'down'` by the column's own comparison, and `at` is when it arrived. Render it in the cell,
and use `at` as the key of the element, so that a second change restarts its animation instead of
being lost in the first one:

```ts
price: column(stock => stock.price, {
	label: 'Price',
	align: 'right',
	cell: ({ key, value }) => {
		const change = changes.getChange(key, 'price');

		return h('span', { key: change?.at, class: change && `quote-${change.direction}` }, value.toFixed(2));
	},
}),
```

```css
.quote-up {
	animation: flash-up 0.9s ease-out;
}

@keyframes flash-up {
	from {
		background: rgb(48 164 108 / 22%);
	}
}
```

Reading a change is reactive **per row**: a change in one row wakes only that row, never its
neighbours. Comparing costs nothing for rows that are the same object as before, and new rows are not
changes, so the first load does not light up the whole table.

## Moving rows

With [`useTableMotion`](/guides/animation), rows that change places in a sorted table slide there
instead of jumping. At very high rates constant movement becomes noise; `when` turns it off by any
rule you like, such as a switch or the size of a batch:

```ts
useTableMotion(table, { when: () => animated.value });
```

## Accessibility

- The table does not announce data changes: its live region speaks only of the sort, the selection
  and loading. A screen reader user reads the current values when moving through the cells, rather
  than hearing every tick.
- A flash is decoration. The direction is also in the text, as the sign of the change and its
  colour, so nobody needs to see the animation to know which way a price went. Turn the flash off
  for people who prefer reduced motion, with a `prefers-reduced-motion` media query, as the demo does.
- Content that updates on its own should be possible to pause, as the
  [WCAG criterion 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) asks. The
  demo has a Pause button; so should your dashboard.
- Focus is held by row key, so a focused row stays focused while the sort moves it around.

## See also

- [Stock screener](/examples/screener): a complete live table.
- [Sorting](/guides/sorting): sort state, multi-sort and server-side sorting.
- [Animation](/guides/animation): engines and what animates.
- [Performance](/overview/performance): why references matter everywhere in the table.
