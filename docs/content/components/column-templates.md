---
title: Column templates
description: The markup of a column's cells, header, footer and editor, written in the template and typed by the column.
---

# Column templates

<Description>
The content of a column's body cells, header cell, footer cell and editor, written as markup in the
template of the grid: components, directives and scoped styles, with the slot typed by the column.
</Description>

<Demo name="part-column-templates" />

## Features

<Highlights
	:features="[
		'Markup of a column in the template, next to the rest of the grid: no render functions.',
		'The slot is typed by the column given: `value`, `row`, `aggregate` and `draft` come from `defineColumns`.',
		'No component per cell: the template renders inside `GridCells`, as the column\'s `cell` field does.',
		'Content that renders nothing falls back to the column\'s own field, as a `<slot>` falls back.',
		'Templates come and go with their part: a `v-if` takes one away, and `KeepAlive` keeps one only while it is shown.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import {
	GridCellTemplate,
	GridEditorTemplate,
	GridFooterTemplate,
	GridHeaderTemplate,
	GridRoot,
} from '@vue-data-grid/core';
</script>

<template>
	<GridRoot :grid="grid">
		<GridCellTemplate v-slot="{ value }" :column="columns.status" />
		<GridHeaderTemplate v-slot="{ column }" :column="columns.status" />
		<GridFooterTemplate v-slot="{ aggregate }" :column="columns.amount" />
		<GridEditorTemplate v-slot="{ inputProps, text, draft, setText }" :column="columns.amount" />

		<!-- the header, the body and the footer -->
	</GridRoot>
</template>
```

A template part renders nothing where it stands. It gives its slot to the grid for its column, and
the part that renders that column's cells calls it. The templates are the content of a column
wherever the column is shown: a grid component of your own that renders the body takes them in its
slot, and so does the kit's grid of these pages.

Put the templates first in the slot of `GridRoot`, before the header, the body and the footer. Each
registers itself as it is set up, before the cells it fills render, on the server too; a template
inside a component of your own counts where the component stands. A template after its cells in the
first render fills them once the grid has mounted, but a server render leaves it out and the page
does not hydrate: in development it warns. A template a `v-if` shows later fills its cells as it
comes.

`column` is the column object of `defineColumns`, such as `columns.status`, not its name: it gives
the slot the types of the column's rows, values and `aggregate`.

::: info A workaround for now
Templates are separate parts because the slots of the cell parts cannot be typed by the columns: a
part with a prop for each column is how the type reaches the template. For one body you write
yourself, [`defineGridCells`](/components/body#definegridcells) gives `GridCells` a typed slot for
each column instead. See [why the templates are a workaround](/guides/cells#why-the-templates-are-a-workaround)
and every other way to fill a cell in [Cell content](/guides/cells).
:::

### What a cell shows

The first of these that renders something:

1. The slot of the cell's part: the slot of `GridCells` named as the column, then its default slot;
   the default slot of `GridHeaderCell` or `GridFooterCell`.
2. The column's template.
3. The column's own field: `cell`, `header` or `footer`.
4. The text: the value through `format`, or the label.

A template whose content renders nothing for a cell, such as a `v-if` that does not hold, leaves
that cell to the next one. To leave a cell empty on purpose, render an empty element, such as
`<span v-else />`.

A column's `cellFrame` goes around whichever of these renders: in the column of the tree, from
`treeColumn()`, the indent and the `GridTreeToggle` come before the content of a slot, a template, a
`cell` field or the text alike, and before the editor while the cell is edited. The column fields stay for text and for columns shared as modules,
such as the service columns and `treeColumn`.

Two templates of one column warn in development, and the first one set up renders; when it goes,
the next one takes over.

## API reference

### GridCellTemplate

The content of the body cells of a column.

<PropsTable
	:data="[
		{ name: 'column', type: 'GridTemplateColumn<TRow, TValue>', required: true, description: 'The column, from `defineColumns`; it types the slot.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: 'CellContext<TRow, TValue>', description: 'The content of each cell: `{ row, value, key, index, column, node, write }`. `write` is there with the `editing` feature on a cell that can be edited.' },
	]"
/>

### GridHeaderTemplate

The content of the header cell of a column. The sort indicator and the resize handle stay in
`GridHeaderCell`: the template takes the place of `GridHeaderContent`.

<PropsTable
	:data="[
		{ name: 'column', type: 'GridTemplateColumn', required: true, description: 'The column, from `defineColumns`.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ column: RuntimeColumn; direction?: SortDirection; sortIndex?: number }', description: 'The content of the header cell, with the sort state of the column.' },
	]"
/>

### GridFooterTemplate

The content of the footer cells of a column, in every footer row whose cells have no slot.

<PropsTable
	:data="[
		{ name: 'column', type: 'GridTemplateColumn<TRow, TValue, TAggregate>', required: true, description: 'The column, from `defineColumns`; its `aggregate` types the slot.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: 'FooterContext<TRow, AggregateResult<TValue, TAggregate>>', description: '`{ column, rows, aggregate }`: the rows the footer counts and the column\'s `aggregate` over them.' },
	]"
/>

### GridEditorTemplate

The editor of the cells of a column, with the `editing` feature. It takes the place of the column's
`editor` in the cell being edited; a cell its slot renders nothing for gets the column's `editor`.
What a character typed on the cell does is the column's `typing`: set `typing: 'value'` on a column
whose template cannot start from one character, such as a date picker. A column with `editor: false`
opens no editor, and a template for it warns in development.

<PropsTable
	:data="[
		{ name: 'column', type: 'GridTemplateColumn<TRow, TValue>', required: true, description: 'The column, from `defineColumns`; it types the slot.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: 'EditorContext<TRow, TValue>', description: 'The cell context with `draft`, `text`, `mode`, `error`, `errorId`, `setDraft`, `setText`, `commit`, `cancel`, `ownFocus` and `inputProps`. Bind `inputProps` to the element that takes input.' },
	]"
/>

### Content utilities

The order above, as the grid's parts follow it, for a part of your own that renders cells: each takes
the context of the cell and the templates of `useGridTemplatesContext(null)`, and passes on content
that renders nothing.

<PropsTable
	:data="[
		{ name: 'renderCellContent(context, templates, own?)', type: 'VNodeChild', description: 'A body cell: `own` content, such as that of a slot, the template, the `cell` field, else the text, with the `cellFrame` of the column around it.' },
		{ name: 'renderHeaderContent(context, templates)', type: 'VNodeChild', description: 'A header cell: the template, the `header` field, else the label.' },
		{ name: 'renderFooterContent(context, templates)', type: 'VNodeChild', description: 'A footer cell: the template, else the `footer` field.' },
		{ name: 'renderCellEditor(context, templates, editor)', type: 'VNodeChild', description: 'The cell being edited: the template, else `editor`, the one `getEditor` of the editing gives.' },
	]"
/>

```ts
const templates = useGridTemplatesContext(null);

return () => h('div', grid.getCellProps(rendered), renderCellContent(context, templates));
```

### useGridTemplatesContext

The templates of the grid around: `get(kind, column)` gives the template of a kind (`'cell'`,
`'header'`, `'footer'`, `'editor'`) for a column, and a render that reads it renders again when it
changes; `register(kind, column, template)` adds one and gives back `update` and `unregister`. Pass
`null` for a part that renders without templates too.

### A root of your own

`GridRoot` gives each grid its templates. A root of your own does the same with two calls in
`setup`; without the second, its template parts throw, and its cells render without templates:

```ts
createDataGridContext(grid);
createGridTemplatesContext();
```

## Examples

### An editor in the template

The editor binds `inputProps`, which carry focus, the keys, the label and `aria-invalid`, shows the
text as typed, and gives the text back through `setText`, which reads it with the column's `parse`:

```vue
<GridEditorTemplate v-slot="{ inputProps, text, draft, error, errorId, setText }" :column="columns.estimate">
	<input v-bind="inputProps" inputmode="numeric" :value="text ?? draft" @input="setText(readText($event))">
	<span v-if="error" :id="errorId" data-dg-part="editor-error">{{ error }}</span>
</GridEditorTemplate>
```

### Templates with the kit's grid

A grid of your own components can take the templates in its slot and forward them into its
`GridRoot`, first, before the header and the body, as the kit's grid of these pages does:

```vue
<UiDataGrid :grid="grid" label="Invoices">
	<GridCellTemplate v-slot="{ value }" :column="columns.status">
		<UiBadge :tone="STATUS[value].tone" dot>{{ STATUS[value].label }}</UiBadge>
	</GridCellTemplate>
</UiDataGrid>
```

## Accessibility

- A template renders the content of a cell, not the cell: the role, `aria-colindex`, `aria-selected`
  and focus stay with the cell's part, whatever the template renders.
- A header template takes the place of the label: keep the column's name in it, visible or visually
  hidden, as the column header names the cells of the column for a screen reader.
- An editor template gets its label, its keys and `aria-invalid` from `inputProps`, and its error is
  announced through `errorId`: bind both, or the editor loses them.
