---
title: Stock screener
description: A live stock screener with streaming prices, flashing cells, a sorted grid that re-sorts only what moved, and a watchlist.
pageClass: site-wide
aside: false
---

# Stock screener

<Description>
Prices stream in several times a second. Each changed price flashes up or down, the grid stays sorted
by the day's change and re-sorts only the rows that moved, and the rows glide to their new places.
Star a stock to put it on the watchlist.
</Description>

<Demo name="example-screener" />

## What it shows

- **Streaming rows** with `useRowStream`: quotes arrive as small transactions and are applied in one
  batch per frame, so a burst of updates costs one render. See [Live data](/guides/live-data).
- **Sorting that keeps up** with `sorting({ delta: true })`: a row that did not change stays the same
  object, and only the rows that arrived as new objects are placed again. See [Sorting](/guides/sorting).
- **Flashing cells** with `useCellChanges`: it compares each new row with the one it replaces and
  remembers, for a second, which way each price went.
- **Motion** with `useGridMotion`: when the order changes, the rows slide from where they were.
  See [Animation](/guides/animation).
- **A watchlist on the row selection**: the stars are `GridSelectionCheckbox` parts rendered
  `asChild` onto a button, and the selected keys are a plain `ref` the filter reads. See
  [Row selection](/guides/selection).
- **Pinned columns, resizing and totals**: the star and the symbol stay put while the grid scrolls
  sideways, every column can be resized, and the footer adds the volumes and caps up.

## How it works

### A market that streams

`useMarket` in `use-market.ts` owns the feed. `useRowStream` keeps the rows; a timer picks a few
stocks and hands their new quotes to `apply`, which collects them until the next animation frame:

```ts
const stream = useRowStream<Stock>({ rows: createStocks(), rowKey: 'id' });

function tick() {
	const quotes = Array.from({ length: QUOTES_PER_TICK }, () => random.pick(stream.rows.value));

	stream.apply({ update: quotes.map(stock => tickStock(stock, random)) });
}
```

Every update is a new object, and every untouched stock stays the same object. That one rule is what
the rest of the grid builds on: delta sorting, cell changes and the row memo all compare by reference.
The timer starts in `onMounted` and stops when the component goes, so the page renders on the server
without a feed.

### Filters are just a computed

The toolbar narrows the stocks with an ordinary `computed`, and the grid takes it as its rows:

```ts
const rows = computed(() => quotes.value.filter(stock => (sector.value === 'all' || stock.sector === sector.value)
	&& (view.value === 'all' || watchlist.value.includes(stock.id))));

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 52,
	sort: [{ name: 'change', direction: 'desc' }],
	features: {
		sorting: sorting({ delta: true }),
		selection: selection({ selection: watchlist }),
		navigation: navigation(),
	},
});
```

`selection({ selection: watchlist })` makes the watchlist the model of the row selection. The
selection writes the starred keys into it, and keys of stocks the filter hides stay in it, so the
watchlist survives switching sectors.

### Cells that flash

`useCellChanges` watches the rows of the grid and, for each price that changed, keeps its direction
and the time it arrived. The template of the price column renders a small component with it:

```vue
<UiDataGrid :grid="grid" label="Stock screener" footer>
	<GridCellTemplate v-slot="{ key, value }" :column="columns.price">
		<PriceCell :text="formatPrice(value)" :change="changes.getChange(key, 'price')" />
	</GridCellTemplate>
</UiDataGrid>
```

```vue
<!-- PriceCell.vue -->
<template>
	<span :key="change?.at" class="price" :data-flash="change?.direction ?? undefined">{{ text }}</span>
</template>
```

`getChange` is reactive per row: a change in one row wakes that row alone. `change.at` is new with
every change, so keying the element on it restarts the flash when the same price moves twice in a
row.

### Stars on the selection

The star column is a service column, so CSV, ranges and autosize leave it out. Its cell renders the
selection checkbox part `asChild`: the part gives the button its `role`, `aria-checked`, label and
click, and the button keeps its own look.

```vue
<template>
	<GridSelectionCheckbox v-slot="{ selected }" :row="rowKey" :label="`Watch ${symbol}`" as-child>
		<button type="button" class="watch" :data-watched="selected ? '' : undefined">
			<IconStar aria-hidden="true" />
		</button>
	</GridSelectionCheckbox>
</template>
```

### Totals in the footer

A column's `aggregate` reduces its values over the rows the footer sees, and its `footer` field
renders the result. Because `aggregate` comes before `footer` in the object, the footer's `aggregate`
is typed: `number | null` for `'avg'` and `'sum'`.

```ts
volume: column(stock => stock.volume, {
	label: 'Volume',
	align: 'right',
	format: formatVolume,
	aggregate: 'sum',
	footer: ({ aggregate }) => (aggregate === null ? '' : formatVolume(aggregate)),
}),
```

## Accessibility

- The grid has the `grid` role with the `navigation` feature: one Tab stop, arrow keys between cells, and
  <kbd>Space</kbd> on a star cell toggles the star, as it would on a checkbox.
- Each star is a `role="checkbox"` button named "Watch AURA" and so on, with `aria-checked` following
  the watchlist, and the rows carry `aria-selected`. The announcer says how many stocks are starred
  whenever that changes.
- The flash is decoration: the price itself is the text of the cell, so a screen reader reads the
  current price, not a colour. Under `prefers-reduced-motion` the flash, the pulse and the row motion
  are all off.
- Sorting is announced in full, and the sorted column carries `aria-sort`.
- The feed can be paused: moving content that updates on its own must be possible to stop
  ([WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)).

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['↑', '↓', '←', '→'], description: 'Moves between cells.' },
		{ keys: ['Space'], description: 'On a star cell, adds the stock to the watchlist or takes it off.' },
		{ keys: ['Shift+Space'], description: 'Toggles the watchlist star of the focused row.' },
		{ keys: ['Enter'], description: 'On a header, sorts by the column; again to reverse.' },
		{ keys: ['Shift+←', 'Shift+→'], description: 'On a header, makes the column narrower or wider.' },
	]"
/>
