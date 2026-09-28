---
title: Sales report
description: Sales grouped by region, product or quarter, with totals on every level, column groups that fold away and a footer.
pageClass: site-wide
aside: false
---

# Sales report

<Description>
A year of sales grouped by region and country, by product, or by quarter, with totals on every level
of the tree, column groups that fold away to a summary, and a footer with the grand total.
</Description>

<Demo name="example-sales-report" />

## What it shows

- Rows grouped by the values of your choice, with the totals of every group:
  [Trees and grouping](/guides/trees-and-grouping).
- Groups shown as a tree, sorted level by level from the headers: [Sorting](/guides/sorting).
- Column groups with a toggle that folds them to their summary columns:
  [Column groups](/guides/column-groups), [the group parts](/components/column-groups).
- A footer that adds up the whole report: [Footer](/components/footer).
- Cells of your own for the margin, and currency through `Intl.NumberFormat`:
  [Columns](/guides/columns).

Switch the grouping at the top, open the regions and countries, fold the Money group with its arrow,
and sort by any column: every level of the tree sorts on its own.

## How it works

### Lines, then groups

The raw data is a list of sales. The report first adds them up into one line per product, country
and quarter, and hands those lines to the grid. Each line keeps its sale, so the grouping levels
can read the region, the country or the product from it:

```ts
function level(field: SaleField): RowGroupLevel<ReportRow> {
	return { name: field, value: row => row.sale?.[field] };
}

export const GROUPINGS = {
	region: { levels: [level('region'), level('country')], describe: sale => `${sale.product} · ${sale.quarter}` },
	category: { levels: [level('category'), level('product')], describe: sale => `${sale.country} · ${sale.quarter}` },
	quarter: { levels: [level('quarter'), level('region')], describe: sale => `${sale.product} · ${sale.country}` },
};
```

### The grouping feature

`grouping()` puts the lines into groups by those levels. For every group it calls `createGroup`
with the group's key, its value, its children and the aggregates of the columns that declare an
`aggregate`, and you build the group's row from them, of the same type as a line:

```ts
const grid = useDataGrid({
	columns,
	groups,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	sort: [{ name: 'revenue', direction: 'desc' }],
	features: {
		grouping: grouping<ReportRow, typeof columns>({
			by: () => GROUPINGS[groupBy.value].levels,
			createGroup: group => ({
				id: group.key,
				label: String(group.value),
				units: group.aggregates.units ?? 0,
				revenue: group.aggregates.revenue ?? 0,
				cost: group.aggregates.cost ?? 0,
				children: group.children,
			}),
		}),
		tree: tree<ReportRow>({ childrenField: 'children', expanded, defaultExpanded: 1 }),
		navigation: navigation(),
	},
});
```

- `by` is a getter, so switching the grouping regroups the same lines.
- `group.aggregates` is typed by the columns: `units`, `revenue`, `cost` and `profit` declare
  `aggregate: 'sum'`, so each is a `number | null`. The type parameters of `grouping` tell it which
  columns those are.
- A group row has the same fields as a line, so the columns read both with the same `value`. Profit
  and margin are computed from revenue and cost, so they are right for groups too.
- Groups are rebuilt only under the lines that changed, and a group's totals are merged from its
  subgroups rather than read again from every line.

`tree({ childrenField: 'children' })` then turns the groups into the rows the grid shows, with
the top level open, and sorts every level by the column state. A sort by revenue orders the regions,
the countries in each and the lines in each by their own totals.

### Folding column groups

`defineColumnGroups` puts the columns under two headers. `showWhen` names the columns that are only
shown while their group is open; a group with any makes a toggle appear in its header:

```ts
export const groups = defineColumnGroups({
	volume: {
		label: 'Volume',
		children: ['units', 'price'],
		showWhen: { price: 'expanded' },
	},
	money: {
		label: 'Money',
		children: ['revenue', 'cost', 'profit', 'margin'],
		showWhen: { revenue: 'expanded', cost: 'expanded' },
	},
});
```

Folded, Money keeps profit and margin, the summary of the columns it hides. The folded state is part
of the column layout, so it could be kept with `persist` like widths and order.

The "All columns" switch in the toolbar opens or folds both groups at once, through the scope, in
one layout write:

```ts
const detailed = computed({
	get: () => !grid.scope.isGroupCollapsed('money'),
	set: (value: boolean) => grid.scope.batch(() => {
		for (const name of Object.keys(groups)) {
			if (grid.scope.isGroupCollapsed(name) === value) {
				grid.scope.toggleGroup(name);
			}
		}
	}),
});
```

### The footer

The `footer` field of a column renders its footer cell. It gets the column's `aggregate` over the
leaves of the tree, every line, open or not, so the total does not depend on what is expanded:

```ts
revenue: column(row => row.revenue, {
	label: 'Revenue',
	aggregate: 'sum',
	format: revenue => money.format(revenue),
	footer: ({ aggregate }) => money.format(aggregate ?? 0),
}),
margin: column(row => getMargin([row]), {
	label: 'Margin',
	cell: ({ value }) => h(MarginCell, { value }),
	footer: ({ rows }) => h(MarginCell, { value: getMargin(rows) }),
}),
```

The margin is not a sum, so its footer computes it from the rows it gets. `aggregate` comes before
`footer` in the object on purpose: TypeScript types the functions of an object in order, and that is
what gives the footer its typed `aggregate`.

## Accessibility

- The grid is a `treegrid`: group rows have `aria-level`, `aria-expanded`, `aria-posinset` and
  `aria-setsize`, so a screen reader says "level 2, 3 of 4, expanded" as you move through the tree.
- Group headers are column headers over their columns with `aria-colspan`. Their toggles are
  buttons named "Collapse Money" or "Expand Money", with `aria-expanded`.
- The group rows of the header are rows of the keyboard grid: ↑ from a column header reaches its
  group, and <kbd>Enter</kbd> there folds or unfolds it. The "All columns" switch in the toolbar folds
  both at once.
- The header and the footer rows count in `aria-rowcount` and `aria-rowindex`, so the total row is
  announced as the last row of the grid.
- The margin bar is decoration; the percentage next to it is the value.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['→'], description: 'In the first column: opens a closed group.' },
		{ keys: ['←'], description: 'In the first column: closes an open group, or moves from a line to its group.' },
		{ keys: ['↑', '↓'], description: 'Moves through the rows, from the headers to the footer.' },
		{ keys: ['Enter'], description: 'On a header: sorts by that column; with Shift, adds it to the sort.' },
		{ keys: ['Enter'], description: 'On a group header, Volume or Money: folds or unfolds the group.' },
		{ keys: ['Home', 'End'], description: 'Moves to the first or the last cell of the row.' },
	]"
/>
