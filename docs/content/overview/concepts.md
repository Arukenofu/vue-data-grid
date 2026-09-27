---
title: How it fits together
description: The few ideas the whole library is built on - columns, the table object, features, parts and state.
---

# How it fits together

<Description>
The whole library rests on five ideas: columns describe data, a table object holds everything,
features add behaviour, parts render it, and state is yours to keep. Once they click, every page
after this one is a variation on them.
</Description>

<FlowSteps
	:steps="[
		{ title: 'Columns', text: 'What each column reads from a row, and how to show it.' },
		{ title: 'The table object', text: '`useDataTable` turns columns and rows into one object.' },
		{ title: 'Features', text: 'Sorting, selection, navigation… each a function you pass in.' },
		{ title: 'Parts', text: 'Components that render the object, each one element.' },
		{ title: 'State', text: 'Sort and layout, in refs you may own, keep and restore.' },
	]"
/>

## Columns describe, they do not render

A column is a small record: a `value` function that reads the cell from a row, plus facts about the
column. It is not a component and holds no state.

```ts
const column = defineColumn<Invoice>();

const columns = defineColumns({
	number: column(invoice => invoice.number, { label: 'Invoice', width: 120 }),
	customer: column(invoice => invoice.customer.name, { label: 'Customer', flex: 1 }),
	total: column(invoice => invoice.total, {
		label: 'Total',
		align: 'right',
		format: total => currency.format(total),
		aggregate: 'sum',
	}),
});
```

Three things are kept apart on purpose:

- **`value`** is the data: sorting, grouping, totals and editing work with it.
- **`format`** is the text: cells, CSV, copying and autosize read it.
- **`cell`**, when you need more than text, is how the cell renders: a badge, an avatar, a button.

A sort by `total` sorts numbers, not the formatted strings, and a copied range gives the text people
see. More in [Columns](/guides/columns).

## The table object holds everything

`useDataTable` is the one entry point. It takes the columns, the rows and a few options, and returns
a plain object with everything the table is:

```ts
const table = useDataTable({
	columns,
	rows: invoices,
	rowKey: 'id',
	rowHeight: 40,
	features: { sorting: sorting(), selection: selection() },
});

table.rows.value; // the rows as shown: sorted, filtered by a tree, and so on
table.selection.selectedCount.value; // what a feature gives, typed by the feature
table.scope.scrollToRow(120); // the core underneath: columns, windows, geometry
table.state.sort.value; // the sort and the layout of the columns
```

It is not reactive itself: it is a bag of refs and functions, so it can be destructured, passed to
a child as a prop, or given to a composable, and nothing is lost. Parts receive it once, through
`TableRoot`.

## Features add behaviour

A feature is a function of the table that returns a handle. The factories, `sorting()`,
`selection()`, `navigation()` and the rest, create those functions with their options:

```ts
features: {
	sorting: sorting({ delta: true }),
	selection: selection({ selectionMode: 'single' }),
	navigation: navigation(),
}
```

The table builds them in a fixed order, and each is built on what the ones before give. First come
the features that change the rows, then the engine renders them, and then the features that work on
the rendered table:

<FlowSteps
	:steps="[
		{ title: 'Rows', text: 'Your array, as it is.' },
		{ title: 'grouping, sorting, tree', text: 'Change which rows are shown and in what order.' },
		{ title: 'selection', text: 'Selects among the shown rows.' },
		{ title: 'The engine', text: 'Windows of rows and columns, geometry, positions.' },
		{ title: 'navigation, ranges, editing…', text: 'Work on the rendered table: keys, cells, clipboard.' },
	]"
/>

A feature that needs another one says so in its type: `fill()` without `ranges()` and `editing()` does
not compile. And since every factory is just a function, one of your own can take its place. More
in [Features](/composables/features).

## Parts render it

The parts are small components that render one element each and read the table from the
`TableRoot` around them. A part hands its slot what the next level needs: the header row gives you
its columns, the body gives you its rows, a row gives you its cells.

```vue
<TableRoot :table="table" label="Invoices">
	<TableHeader>
		<TableHeaderRow v-slot="{ columns }">
			<TableHeaderCell v-for="column in columns" :key="column.key" :column="column">
				<TableHeaderContent />
				<TableSortIndicator />
			</TableHeaderCell>
		</TableHeaderRow>
	</TableHeader>
	<TableBody v-slot="{ rows }">
		<TableRow v-for="row in rows" :key="row.key" :row="row">
			<TableCells />
		</TableRow>
	</TableBody>
</TableRoot>
```

A part never renders other parts by itself. A header cell does not come with a sort indicator: you
put one in. That is what makes each part replaceable: swap `TableSortIndicator` for an icon of your
own, render a header cell with `asChild` onto your element, or write a part from scratch with the
same composables. More in [Your own markup](/guides/custom-markup).

## State is yours to keep

The column state is small and plain: the sort, and the layout of the columns, meaning their order,
widths, pins, hidden ones and collapsed groups. It lives in `table.state` as refs. Sort, resize, pin
or hide a column here and watch it change:

<Demo name="table-state" />

The layout stays `null` until you change something: `null` means "as declared". You can keep the
state in the table, pass refs of your own to own it, or let the table keep it in `localStorage`
between visits:

```ts
const sort = ref([{ name: 'total', direction: 'desc' }]);

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	sort,
	persist: localStorageStore('invoices'),
});
```

More in [Column layout](/guides/column-layout) and [Sorting](/guides/sorting).

## Rows stay immutable

Rows are compared by reference. A row that changes arrives as a new object, and a row that does not
change stays the same object, so the table re-renders exactly the rows that changed. Replace the
array, or return a new object for a row, rather than mutating in place:

```ts
invoices.value = invoices.value.map(invoice => (invoice.id === id ? { ...invoice, paid: true } : invoice));
```

Keys, from `rowKey`, are what the table follows a row by, while it moves between sorts, pages and
trees. They must be unique, and a development build warns when they are not.

## Accessibility

Every idea above carries its part of accessibility without extra work:

- **Columns** name the cells: the first data column is the row header, `role="rowheader"`, so a
  screen reader announces a cell together with the row it belongs to. `rowHeader` picks another one.
- **The table object** knows the whole data set, so the markup gets `aria-rowcount`, `aria-colcount`
  and `aria-rowindex` right even when only a window of rows is rendered.
- **Features** bring their semantics: `aria-sort` with sorting, `aria-selected` and
  `aria-multiselectable` with selection, `aria-level`, `aria-expanded` and `aria-setsize` with a tree.
- **Parts** apply all of it through prop-getters, and your own markup can use the same getters.

See [Accessibility](/overview/accessibility) for the full picture.

## See also

- [Getting started](/overview/getting-started)
- [useDataTable](/composables/use-data-table)
- [Features](/composables/features)
