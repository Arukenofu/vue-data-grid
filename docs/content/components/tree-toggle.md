---
title: Tree toggle
description: The button that expands and collapses a group row of a tree.
---

# Tree toggle

<Description>
The button that expands and collapses a group row of a tree, and keeps the room of one on the leaves
beside it, so their text lines up.
</Description>

<Demo name="part-tree-toggle" />

## Features

<Highlights
	:features="[
		'Expands and collapses the group row it is in, or the row given by key.',
		'On a leaf it leaves an empty placeholder of the same width while the tree has groups; in a flat list, nothing.',
		'Any content through the slot; `▾` and `▸` without one.',
		'A `button` named &quot;Expand&quot; or &quot;Collapse&quot;, from the table\'s messages.',
		'Works with the arrow keys of the tree when the column is marked `tree`.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { TableTreeToggle } from '@vue-stack/table';
</script>

<template>
	<TableTreeToggle />
</template>
```

The toggle needs the `tree` feature, which turns the rows into a tree by a parent key or by an array
of children:

```ts
import { tree, useDataTable } from '@vue-stack/table';

const table = useDataTable({
	columns,
	rows: files,
	rowKey: 'id',
	rowHeight: 38,
	features: { tree: tree({ parentKey: 'parent' }) },
});
```

The quickest way to show a tree is [`treeColumn()`](/components/service-columns): it indents a
column by level and puts a toggle in front of its content. Use the toggle on its own for a cell of
your own design, as the demo does with a folder that opens.

## API reference

### TableTreeToggle

<PropsTable
	:data="[
		{ name: 'row', type: 'string | TableBodyRow', description: 'The row: its key or its body row. The row of the `TableRow` around by default.' },
		{ name: 'as', type: 'string | Component', default: '\'button\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ expanded: boolean }', description: 'The content of the button; `▾` or `▸` without it.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-tc-part]', values: ['tree-toggle'] },
		{ attribute: '[data-tc-state]', values: ['expanded', 'collapsed'] },
	]"
/>

The placeholder of a leaf is a `span` with the same `data-tc-part`, `aria-hidden` and without
`data-tc-state`, so both take the same width from the same rule.

<CssVariablesTable
	:data="[
		{ name: '--tc-tree-indent', default: '16px', description: 'The indent of one level, in the cells of `treeColumn()`.' },
	]"
/>

### Tree options

What `tree()` takes, to shape the tree the toggle opens:

<PropsTable
	label="Option"
	:data="[
		{ name: 'parentKey', type: 'keyof TRow | (row) => string | null', description: 'The parent of each row of a flat list: a field or a function. Read once.' },
		{ name: 'childrenField', type: 'keyof TRow', description: 'The field with an array of child rows, for nested data.' },
		{ name: 'expanded', type: 'Ref<string[] | undefined>', description: 'The keys of expanded rows, as a model: the tree writes to it and follows it.' },
		{ name: 'defaultExpanded', type: 'number', default: '0', description: 'How many levels start expanded; a negative number expands all.' },
		{ name: 'sort', type: 'boolean', default: 'true', description: 'Sort the siblings of every level by the table\'s sort.' },
	]"
/>

## Examples

### A cell of your own

The demo renders the name column with a component of its own: an indent by level, the toggle with a
chevron that turns, and a folder that opens. The cell context carries the row's tree node:

```ts
const columns = defineColumns({
	name: column(file => file.name, {
		label: 'Name',
		tree: true,
		cell: ({ row, node }) => h(FileCell, { file: row, node }),
	}),
});
```

```vue
<template>
	<span class="indent" :style="{ width: `${(node?.level ?? 0) * 20}px` }" />
	<TableTreeToggle v-slot="{ expanded }">
		<IconChevronRight :class="{ turned: expanded }" />
	</TableTreeToggle>
	<IconFolderOpen v-if="node?.expanded" />
	<IconFolder v-else-if="file.kind === 'folder'" />
	{{ file.name }}
</template>
```

`tree: true` marks the column as the one the arrow keys expand and collapse rows in.

### Expand and collapse all

Pass `expanded` as a ref, and the whole tree opens or closes by writing it:

```ts
const expanded = shallowRef<string[] | undefined>(['design']);

const table = useDataTable({
	columns,
	rows: files,
	rowKey: 'id',
	rowHeight: 38,
	features: { tree: tree({ parentKey: 'parent', expanded }) },
});

expanded.value = folders.map(folder => folder.id);
expanded.value = [];
```

## Accessibility

Adheres to the [Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) of WAI-ARIA.

- With the `tree` feature the table is a `treegrid`, and each row has `aria-level`, `aria-posinset`
  and `aria-setsize`; a group row has `aria-expanded`.
- The toggle is a `button`, named "Expand" or "Collapse" from the `expandRow` and `collapseRow`
  messages. The row it is in says which row it is, so the name stays short.
- The placeholder of a leaf is `aria-hidden`: it is only room.

### Keyboard interactions

With the `navigation` feature, in the column marked `tree`:

<KeyboardTable
	:data="[
		{ keys: ['→'], description: 'On a collapsed group row: expands it. Otherwise moves to the next cell.' },
		{ keys: ['←'], description: 'On an expanded group row: collapses it. On a child row: moves to its parent.' },
		{ keys: ['Enter', 'Space'], description: 'On the toggle, or on a cell whose only control is the toggle: expands or collapses the row.' },
	]"
/>
