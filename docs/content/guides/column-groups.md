---
title: Column groups
description: Headers above headers, groups that fold down to a total, and columns that stay together when people move them.
---

# Column groups

<Description>
Headers above headers: put related columns under a shared label, let a group fold down to its total,
and keep its columns together when people move them around.
</Description>

<Demo name="column-groups" />

## Declaring groups

A group names its children, columns and nested groups, in order. `defineColumnGroups` takes an object
by name, as `defineColumns` does, and the table takes it as `groups`:

```ts
import { defineColumnGroups, useDataTable } from '@vue-data-grid/core';

const groups = defineColumnGroups({
	item: { label: 'Product', children: ['product', 'category'] },
	revenue: { label: 'Revenue 2026', children: ['firstHalf', 'secondHalf', 'year'] },
	firstHalf: { label: 'Jan – Jun', children: ['q1', 'q2', 'h1'] },
	secondHalf: { label: 'Jul – Dec', children: ['q3', 'q4', 'h2'] },
});

const table = useDataTable({ columns, groups, rows, rowKey: 'id', rowHeight: 40 });
```

A name in `children` that is also the name of a group is that group; any other name is a column. So
give groups and columns different names, as `item` and `product` above. The columns keep their own
order, from the column declarations and the layout: a group labels the columns of it that stand
next to each other. When a move or a pin splits a group, it shows as several cells, one over each
run of its columns.

## Rendering the header rows

Each level of groups is one more row above the column headers. The slot of `TableHeader` gives the
cells of every level; render a `TableGroupRow` for each level and a `TableGroupCell` for each cell:

```vue
<TableHeader v-slot="{ groups: levels }">
	<TableGroupRow v-for="(cells, level) in levels" :key="level" :level="level">
		<TableGroupCell v-for="cell in cells" :key="cell.key" :cell="cell">
			<TableGroupContent />
			<TableGroupToggle />
		</TableGroupCell>
	</TableGroupRow>
	<TableHeaderRow v-slot="{ columns }">
		<TableHeaderCell v-for="column in columns" :key="column.key" :column="column" />
	</TableHeaderRow>
</TableHeader>
```

- `TableGroupCell` spans the columns of its group, and grows and shrinks with them as they resize,
  without a render.
- `TableGroupContent` shows the group's label, or its `header` field when it has one. A cell without
  a slot shows it on its own.
- `TableGroupToggle` is the button that folds the group, and renders nothing for a group that cannot
  fold. Its slot takes an icon of your own, as the demo's chevrons.

Columns that have no group at some level get an empty cell there. When the theme sets
`--dg-group-row-height`, the height of a group row, the header of such a column reaches up over the
empty cells above it, as `Name` and `Year` do in the demo.

## Folding a group

A group folds when its `showWhen` says which of its children show only while it is expanded, and
which only while it is collapsed. Children it does not name are always shown:

```ts
firstHalf: {
	label: 'Jan – Jun',
	children: ['q1', 'q2', 'h1'],
	showWhen: { q1: 'expanded', q2: 'expanded', h1: 'collapsed' },
},
```

Expanded, the first half of the year shows its quarters; collapsed, it shows its total. Keep at least one child
visible while collapsed: a group with no columns has no cell to unfold it from. `collapsedByDefault`
starts a group folded.

From code, `table.scope.toggleGroup(name)` folds or unfolds a group and
`table.scope.isGroupCollapsed(name)` tells where it stands. The demo's buttons fold both halves in one
`table.scope.batch()`. What people fold is part of the [column layout](/guides/column-layout), in
`layout.collapsed`, so it is saved with the rest of the layout.

## Keeping columns together

`keepTogether: true` makes a group move as one: no move splits its columns, and no other column lands
between them. A column moved with <kbd>Alt</kbd> and the arrow keys steps over such a group in one
step, rather than stopping in the middle of it.

```ts
revenue: { label: 'Revenue 2026', children: ['firstHalf', 'secondHalf', 'year'], keepTogether: true },
```

## A header of your own

Like a column, a group takes a `header` field when its label is not enough. It gets the group and
whether it is collapsed:

```ts
import { h } from 'vue';

const groups = defineColumnGroups({
	revenue: {
		label: 'Revenue 2026',
		children: ['firstHalf', 'secondHalf', 'year'],
		header: ({ group }) => h('span', { class: 'revenue-title' }, [h(IconChartLine), group.label]),
	},
});
```

`meta` holds data of your own about a group, as it does for columns.

## Styling

Group cells carry `data-dg-group` with the group's name and `data-dg-columns` with the tokens of its
columns. The toggle carries `data-dg-part="group-toggle"` and `data-dg-state` of `expanded` or
`collapsed`.

<CssVariablesTable
	:data="[
		{ name: '--dg-group-row-height', description: 'The height of a group row. With it, the header of a column without a group reaches up over the empty cells above it.' },
	]"
/>

## Accessibility

- Group rows are rows of the grid, with `role="row"` and their own `aria-rowindex`, and
  `aria-rowcount` counts them. Their cells are `role="columnheader"` with `aria-colindex` and
  `aria-colspan`, so a screen reader reads a quarter's header as part of its half.
- The toggle is a native button with `aria-expanded` and a name that says what it does, "Collapse
  Jan – Jun" or "Expand Jul – Dec", from the `expandGroup` and `collapseGroup` messages.
- With the [navigation](/guides/keyboard-navigation), group rows are rows of the keyboard grid:
  ↑ from a column header goes to the group above it, and <kbd>Enter</kbd> on a group cell presses its
  toggle. The empty cells over columns without a group are passed over. In a table without the
  navigation, as in the demo, each toggle is a Tab stop.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'Space'], description: 'On a group toggle: folds or unfolds its group.' },
		{ keys: ['↑', '↓'], description: 'With the navigation: moves between a column header and the group above it.' },
		{ keys: ['Enter'], description: 'With the navigation, on a group cell: folds or unfolds its group.' },
		{ keys: ['Alt+←', 'Alt+→'], description: 'On a header cell: moves a `movable` column, over a `keepTogether` group in one step.' },
	]"
/>

## See also

- [Column groups parts](/components/column-groups): `TableGroupRow`, `TableGroupCell` and the rest.
- [Column layout](/guides/column-layout): folding is saved with the layout.
- [Columns](/guides/columns): aggregates and footers, as the totals of the demo.
