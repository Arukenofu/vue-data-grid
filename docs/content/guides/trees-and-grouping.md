---
title: Trees and grouping
description: Rows inside rows, from a parent key, nested arrays, or groups the grid builds by value with totals on every level.
---

# Trees and grouping

<Description>
Rows inside rows. The tree feature shows rows that already have a hierarchy, and the grouping
feature builds one out of flat rows by their values, with totals on every level.
</Description>

<Demo name="tree" />

## A tree from your data

The `tree` feature takes the hierarchy from your rows in one of two ways:

- **`parentKey`**: each row names its parent, as rows from a database usually do. The demo builds an
  organization from `manager`, the key of each person's manager:

  ```ts
  features: { tree: tree({ parentKey: 'manager' }) },
  ```

  A row whose parent is `null`, `undefined`, `''` or a key no row has is at the top level.
  `parentKey` also takes a function of the row.
- **`childrenField`**: each row holds its children in an array, as a nested document does:

  ```ts
  features: { tree: tree({ childrenField: 'children' }) },
  ```

The feature flattens the tree into the rows the grid shows: the rows of the top level, then the
children of every expanded row under it, in order. A row with children, even an empty array of them,
is a group.

## The tree column

`treeColumn()` turns a column into the one that shows the hierarchy. Each of its cells starts with an
indent for the row's level and a toggle for a group, then the column's own content:

```ts
import { tree, treeColumn } from '@vue-data-grid/core';

const columns = defineColumns({
	name: treeColumn(column('name', { label: 'Name', width: 240 })),
	title: column('title', { label: 'Title' }),
});
```

The toggle is a `GridTreeToggle`. A leaf gets an empty space of the same width, so names line up
across levels. The indent is `--dg-tree-indent` per level, `16px` by default. To place the toggle
yourself, put a `GridTreeToggle` in a `cell` of your own; it finds its row in the `GridRow` it is in.

### Renaming in the tree column

The tree column edits as any column with the [`editing`](/guides/editing) feature: make it `editable`
and give it `setValue`. The content alone turns into the editor, the indent and the toggle stay where
they were. In the demo, double-click a name, or press <kbd>Enter</kbd> on it, to rename a person:
<kbd>Enter</kbd> on a cell that can be edited edits it, and a double click on the toggle only expands
or collapses the row.

```ts
const members = shallowRef(org);

const columns = defineColumns({
	name: treeColumn(column('name', { label: 'Name', editable: true, setValue: (member, name) => ({ ...member, name }) })),
});

const grid = useDataGrid({
	columns,
	rows: members,
	rowKey: 'id',
	rowHeight: 44,
	features: {
		tree: tree({ parentKey: 'manager' }),
		editing: editing({ onCommit: commit => (members.value = commit.apply(members.value)) }),
	},
});
```

`commit.apply` replaces the changed rows in a flat list, as the one of a tree by `parentKey`. The rows
of a tree by `childrenField` lie inside other rows: put the new rows from `commit.rows`, by key, where
they are in your nesting.

## Expanding and collapsing

By default every group starts collapsed. `defaultExpanded` opens that many levels from the top, and
a negative number opens all of them. To own the state, pass a `ref` of expanded keys as `expanded`: the
tree writes into it and follows it. `undefined` in it means "as `defaultExpanded` says".

```ts
const expanded = shallowRef<string[] | undefined>(undefined);

tree({ parentKey: 'manager', expanded, defaultExpanded: 2 }),
```

The demo's buttons write the keys of every manager, or none. The handle of the feature,
`grid.tree`, also has:

<ReturnsTable
	:data="[
		{ name: 'isExpanded', type: '(key: string) => boolean', description: 'Whether a group is expanded.' },
		{ name: 'setExpanded', type: '(key: string, value: boolean) => void', description: 'Expands or collapses a group.' },
		{ name: 'toggle', type: '(key: string) => void', description: 'Expands a collapsed group, collapses an expanded one.' },
		{ name: 'reveal', type: '(key: string) => boolean', description: 'Expands every group above a row so that it is shown, such as a search result.' },
		{ name: 'getNode', type: '(key: string) => RowNode | undefined', description: 'The place of any row in the tree: `level`, `parent`, `group`, `count` of leaves under it, `position` and `setSize` among its siblings.' },
		{ name: 'getChildren', type: '(key: string | null) => readonly string[]', description: 'The keys of a group\'s children; `null` for the top level.' },
		{ name: 'leaves', type: 'ComputedRef<readonly TRow[]>', description: 'Every leaf, collapsed ones included: what totals are computed from.' },
	]"
/>

### Sorting a tree

The tree sorts the siblings of every level by the grid's sort, so children stay under their
parent. Make columns `sortable` and leave the `sorting` feature out: a grid with a tree does not need
it. Pass `sort: false` to `tree()` to keep the order of your data.

## Grouping flat rows

Flat rows can be grouped by their values: sales by region, then by country. The `grouping` feature
builds the groups, and the `tree` feature shows them.

<Demo name="grouping" />

A level of grouping is a name and a function of the row; a column fits as is. The levels can change
at run time, as the switch in the demo shows:

```ts
const LEVELS = {
	region: [{ name: 'region', value: row => row.region }],
	country: [
		{ name: 'region', value: row => row.region },
		{ name: 'country', value: row => row.country },
	],
};

features: {
	grouping: grouping({ by: () => LEVELS[groupBy.value], createGroup }),
	tree: tree({ childrenField: 'children', defaultExpanded: 1 }),
},
```

### Building a group row

A group row is a row of the same type as the others, so the same columns can show it. `createGroup`
builds it from the group: its key, its value, its rows and its children, and the aggregates of every
column that has an `aggregate`:

```ts
function createGroup(group: RowGroup<SalesRow, ColumnAggregates<typeof columns>>): SalesRow {
	const [first] = group.rows;

	return {
		...first,
		id: group.key,
		label: String(group.value),
		units: group.aggregates.units ?? 0,
		revenue: group.aggregates.revenue ?? 0,
		cost: group.aggregates.cost ?? 0,
		count: group.rows.length,
		children: group.children,
	};
}
```

- `group.key` is the path of the group from the top, unique in the tree and never equal to the key of
  a row. Put it in the key field.
- `group.children` are the ready rows under the group: the rows of its subgroups, or its rows at the
  last level. Put them in the field the tree reads.
- `group.aggregates` is typed by your columns: `revenue` above is a `number | null`, because its column
  sums. The margin column then needs no aggregate of its own: it reads `revenue` and `cost` from the
  group row, as from any row.

A group whose rows did not change keeps its row object between updates, so it does not render again.

## Totals in the footer

`grid.leaves` holds every leaf of the tree, collapsed ones included, and a footer aggregates over it.
Totals therefore stay right whichever groups are open. In the demo each amount column has
`aggregate: 'sum'` and a `footer`, and the margin column computes its footer from the rows it gets:

```ts
margin: amount(row => (row.revenue - row.cost) / row.revenue, {
	label: 'Margin',
	footer: ({ rows }) => formatMargin(sum(rows, row => row.revenue), sum(rows, row => row.cost)),
}),
```

## Accessibility

- A grid with a tree has `role="treegrid"`. Every row carries `aria-level`, `aria-posinset` and
  `aria-setsize`, so a screen reader says "level 2, 3 of 4", and a group row carries `aria-expanded`.
- The toggle is a button named "Expand" or "Collapse", from the grid's messages, with
  `data-dg-state` of `expanded` or `collapsed`.
- With the `navigation` feature the arrow keys open and close groups in the tree column, as the
  treegrid pattern asks.
- With the `selection` feature, selecting a group selects every leaf under it, and a group with some of
  its leaves selected shows a partly checked checkbox, announced as "mixed".

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['→'], description: 'In the tree column, on a collapsed group: expands it. Elsewhere it moves to the next cell.' },
		{ keys: ['←'], description: 'In the tree column: collapses an expanded group, or moves from a child to its parent.' },
		{ keys: ['Enter'], description: 'On a cell whose only button is the toggle: expands or collapses the row.' },
	]"
/>

## See also

- [Tree toggle](/components/tree-toggle): the part in the tree column.
- [Service columns](/components/service-columns): `treeColumn()` and the other ready-made columns.
- [File explorer](/examples/file-explorer): a tree with sizes that add up and drag and drop.
- [Sales report](/examples/sales-report): grouping with column groups and totals.
