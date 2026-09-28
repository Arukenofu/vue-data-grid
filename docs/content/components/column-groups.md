---
title: Column groups
description: Header rows above the column headers that group columns under a shared label and fold them away.
---

# Column groups

<Description>
Header rows above the column headers: a shared label over related columns, and groups that fold
away the columns you do not need right now.
</Description>

<Demo name="part-column-groups" />

## Features

<Highlights
	:features="[
		'Any number of levels: groups nest inside groups.',
		'A group folds to fewer columns with `showWhen`, and remembers it in the layout.',
		'`keepTogether` stops a move from splitting the group or landing a column inside it.',
		'A group cell stays over its columns while they resize, pin and scroll, without a render.',
		'A column with no group above it reaches up over the empty group rows with its header.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import {
	GridGroupCell,
	GridGroupContent,
	GridGroupRow,
	GridGroupToggle,
	GridHeader,
	GridHeaderCell,
	GridHeaderRow,
} from '@vue-data-grid/core';
</script>

<template>
	<GridHeader v-slot="{ groups }">
		<GridGroupRow v-for="(cells, level) in groups" :key="level" :level="level">
			<GridGroupCell v-for="cell in cells" :key="cell.key" :cell="cell">
				<GridGroupContent />
				<GridGroupToggle />
			</GridGroupCell>
		</GridGroupRow>
		<GridHeaderRow v-slot="{ columns }">
			<GridHeaderCell v-for="column in columns" :key="column.key" :column="column" />
		</GridHeaderRow>
	</GridHeader>
</template>
```

Groups are declared next to the columns, with `defineColumnGroups`, and passed to `useDataGrid`:

```ts
import { defineColumnGroups, useDataGrid } from '@vue-data-grid/core';

const groups = defineColumnGroups({
	item: { label: 'Product', children: ['product', 'category'] },
	revenue: { label: 'Revenue 2026', children: ['firstHalf', 'secondHalf'], keepTogether: true },
	firstHalf: { label: 'First half', children: ['q1', 'q2', 'h1'], showWhen: { q1: 'expanded', q2: 'expanded' } },
	secondHalf: { label: 'Second half', children: ['q3', 'q4', 'h2'], showWhen: { q3: 'expanded', q4: 'expanded' } },
});

const grid = useDataGrid({ columns, groups, rows, rowKey: 'id', rowHeight: 40 });
```

`children` lists columns and other groups by name, so `revenue` above holds two halves, each of
three columns. The engine lays the groups out in `scope.headerGroups`, one array of cells per row,
from the top; `GridHeader` hands them to its slot as `groups`.

## API reference

### GridGroupRow

A row of group cells, `level` rows from the top.

<PropsTable
	:data="[
		{ name: 'level', type: 'number', required: true, description: 'The level from the top, an index into `groups` of the `GridHeader` slot.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ cells: RenderedGroup[] }', description: 'The cells of the row, for a `GridGroupCell` each: the same array as `groups[level]`.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['row'] },
	]"
/>

### GridGroupCell

A cell over the columns of one group, or over the columns without a group at this level. It carries
the geometry of its columns, so it grows as they resize and sticks when they are pinned. It gives
the parts inside, such as a `GridGroupToggle`, their cell. Without a slot it shows its content as
`GridGroupContent` does.

<PropsTable
	:data="[
		{ name: 'cell', type: 'RenderedGroup', required: true, description: 'The cell, from the slot of `GridGroupRow` or from `scope.headerGroups`.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ cell: RenderedGroup; group: ColumnGroup | null; collapsed: boolean; collapsible: boolean; toggle: () => void }', description: '`group` is `null` for the cell over columns without a group at this level; `toggle` collapses or expands a group that can.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-group]', values: 'The name of the group; absent on a cell over columns without one.' },
		{ attribute: '[data-dg-columns]', values: 'The tokens of the columns under the cell, by which a resize reaches it.' },
		{ attribute: '[data-dg-pinned]', values: ['start', 'end'] },
	]"
/>

<CssVariablesTable
	:data="[
		{ name: '--dg-group-row-height', description: 'The height of a group row. A column header without a group above it reaches up by as many of these; without the variable it stays in its own row.' },
	]"
/>

### GridGroupContent

The content of the group cell it is in: the group's `header` field when it has one, else its
`label` (or name) on one line with an ellipsis. It renders no element of its own.

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['cell-text'] },
	]"
/>

### GridGroupToggle

The button that folds and unfolds the group of the cell it is in. It renders nothing for a group
that cannot collapse, that is one without `showWhen`, so you can put it in every cell.

<PropsTable
	:data="[
		{ name: 'as', type: 'string | Component', default: '\'button\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ collapsed: boolean }', description: 'The content of the button; without it, `+` or `−`.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['group-toggle'] },
		{ attribute: '[data-dg-state]', values: ['expanded', 'collapsed'] },
	]"
/>

### Group options

What `defineColumnGroups` takes for each group:

<PropsTable
	label="Option"
	:data="[
		{ name: 'children', type: 'string[]', required: true, description: 'Columns and nested groups by name, in order. A name listed in two groups stays in the first.' },
		{ name: 'label', type: 'string', description: 'The name of the group for people: the text of its cell, and of the toggle\'s accessible name.' },
		{ name: 'showWhen', type: 'Record<string, \'expanded\' | \'collapsed\'>', description: 'Children shown only while the group is expanded, or only while it is collapsed. A group with an entry here can collapse. Keep one child visible either way, or the group has no cell to expand it from.' },
		{ name: 'collapsedByDefault', type: 'boolean', default: 'false', description: 'Start collapsed. What the user sets later is kept in `layout.collapsed`.' },
		{ name: 'keepTogether', type: 'boolean', default: 'false', description: 'Moves never split the group\'s columns, and no other column lands between them.' },
		{ name: 'header', type: '(context: { group, collapsed }) => VNodeChild', description: 'The content of the group cell, when the label is not enough.' },
		{ name: 'meta', type: 'unknown', description: 'Your data; the grid never reads it.' },
	]"
/>

## Examples

### Fold a group to its total

Name the columns a folded group hides in `showWhen`. The columns not named stay in both states,
so a folded half of a year still shows its total:

```ts
const groups = defineColumnGroups({
	firstHalf: {
		label: 'First half',
		children: ['q1', 'q2', 'h1'],
		showWhen: { q1: 'expanded', q2: 'expanded' },
	},
});
```

### Fold groups from your own controls

The scope knows whether a group is folded and flips it. `batch` writes every change to the layout
at once, so the grid lays out once:

```ts
function setCollapsed(collapsed: boolean) {
	grid.scope.batch(() => {
		for (const name of ['firstHalf', 'secondHalf']) {
			if (grid.scope.isGroupCollapsed(name) !== collapsed) {
				grid.scope.toggleGroup(name);
			}
		}
	});
}
```

### An icon for the toggle

The slot of `GridGroupToggle` replaces the `+` and `−`:

```vue
<GridGroupToggle v-slot="{ collapsed }">
	<IconPlus v-if="collapsed" />
	<IconMinus v-else />
</GridGroupToggle>
```

## Accessibility

- A group cell is a `columnheader` with `aria-colindex` of its first column and `aria-colspan` of
  the columns under it, so a screen reader knows which columns a group label belongs to.
- Group rows count into `aria-rowindex` and `aria-rowcount`: the row of column headers comes after
  them.
- The toggle is a `button` with `aria-expanded`, named by the grid's messages: "Collapse Revenue",
  "Expand Revenue". Change the words with `messages.collapseGroup` and `messages.expandGroup` of
  [`GridRoot`](/components/root).
- The cell over columns without a group is a plain header cell with no text; the column header below
  it reaches up over it.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'Space'], description: 'On the focused toggle: collapses or expands its group.' },
		{ keys: ['↑', '↓'], description: 'With the navigation: moves between a column header and the group cell above it.' },
		{ keys: ['Enter'], description: 'With the navigation, on a group cell: collapses or expands its group.' },
	]"
/>

With the `navigation` feature, group rows are rows of the keyboard grid: ↑ from a column header
reaches the group cell above it, ← and → move between the groups of a row, and <kbd>Enter</kbd> on a
group cell presses its toggle. The empty cells over columns without a group are passed over. In a
grid without that feature each toggle is an ordinary Tab stop.
