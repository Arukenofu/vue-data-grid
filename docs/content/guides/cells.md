---
title: Cell content
description: Every way to fill a body, header or footer cell and an editor, what each costs, and why column templates are shaped as they are.
---

# Cell content

<Description>
A cell can get its content from several places: a template of its column, the slot of its part, a
field of the column, or its text. This page lists them all, what each is for and what it costs, and
explains why the templates are shaped the way they are.
</Description>

<Demo name="part-body" />

The demo uses three of them at once: the status badge and the assignee come from templates of their
columns, the progress bar from a slot of `defineGridCells` in the body the demo writes, and the due
date is the text of `format`.

## Which one to use

Each way has its own job, from the most common to the lowest level:

1. **A template of the column**, `GridCellTemplate` and the others: the content of a column wherever
   the column is shown, in any body, header and footer of the grid, the kit's included. The first
   choice for markup.
2. **A slot of `defineGridCells`**: the cells of one body you write yourself, with a slot for each
   column, typed by it. For a change that belongs to that body, not to the column.
3. **The default slot of `GridCells`, `GridHeaderCell` or `GridFooterCell`**: one slot for every
   cell of the part, not typed by the columns. For a change across columns at once.
4. **A field of the column**, `cell`, `header` or `footer`: a function, for text, and for columns
   shared as a module between grids, such as the service columns.
5. **`format` and `label`**: the text, which CSV, copying and autosize read too.
6. **A part of your own**: the utility level, for markup of your own.

## Which one renders

A cell renders the first of these that gives it content:

1. the slot of its part: the slot of `GridCells` named as its column, then the default slot of its
   part;
2. the template of its column: `GridCellTemplate`, `GridHeaderTemplate` or `GridFooterTemplate`;
3. the field of its column: `cell`, `header` or `footer`;
4. the text: `format` of the value in a body cell, the label in a header cell.

So a slot of the body overrides the template of the column in that body, and the template overrides
the column's field. A slot or a template whose `v-if` renders nothing passes the cell on to the next;
to leave a cell empty on purpose, render an empty element. A column's `cellFrame` goes around
whichever renders: in the column of the tree, from `treeColumn()`, the indent and the toggle come
before it. An editor follows the same order: a `GridEditorTemplate`, the column's `editor`, the
`editor` of the `editing` feature, `textEditor()`.

| Way | In the template | Typed by the column | Where it applies |
| --- | --- | --- | --- |
| Column template | yes | yes | every body, header and footer of the grid |
| Column slot of `GridCells`, from `defineGridCells` | yes | yes | the one body it stands in |
| Default slot of a part | yes | no | the one part it stands in |
| Field of the column | no, a function | yes | every grid of the column |
| `format`, `label` | text only | yes | every grid, CSV and copying |
| A part of your own | as you write it | as you type it | where you render it |

## Body cells

### A template of the column

```vue
<GridRoot :grid="grid">
	<GridCellTemplate v-slot="{ value, row }" :column="columns.status">
		<UiBadge :tone="STATUS[value].tone" dot>{{ STATUS[value].label }}</UiBadge>
	</GridCellTemplate>
	<!-- the header, the body and the footer -->
</GridRoot>
```

The first choice for markup: components, directives and scoped styles, with `value` and `row` typed
by the column given to `:column`. It stands first in the slot of `GridRoot`, and it reaches the cells
wherever the body is rendered. See [Column templates](/components/column-templates).

Costs:

- It comes before the cells it fills: first in the slot of `GridRoot`, or of a root of your own with
  `createGridTemplatesContext`. One after its cells fills them once mounted, but a server render
  misses it, and it warns in development.
- One part fills one column: markup shared by several columns is repeated, or goes to a component.
- Its types come from the way `vue-tsc` reads a generic component, which is not a public contract of
  Vue.
- Two templates for one column warn in development, and the first one renders.

### A slot for each column: `GridCells` from `defineGridCells`

```ts
const Cells = defineGridCells(columns);
```

```vue
<GridRow v-for="row in rows" :key="row.key" :row="row">
	<Cells>
		<template #progress="{ value }">
			<UiProgress :value="value" />
		</template>
	</Cells>
</GridRow>
```

`GridCells` takes a slot named after each column; `defineGridCells` gives it typed by the columns of
`useDataGrid`: `value` is the value of that column, `row` your row, and a slot named after no column
is an error in the template. The slots are the part's own, so there is nothing to register and a
server render has them. Its types are the plain component types of Vue. See
[Body](/components/body#definegridcells).

It overrides the column's template in this one body: use it for what belongs to the body, and the
template for what belongs to the column.

Costs:

- You render the body yourself; a grid of your own components has to let you replace its body, as
  the `body` slot of the kit's grid does.
- It takes the columns for their type only: pass the same columns as to `useDataGrid`. A component
  that takes any grid, typed `DataGrid`, has no columns type to give, and renders `GridCells`, whose
  slots are not typed.
- It fills body cells only: headers, footers and editors take templates or slots of their parts.
- The `default` slot types the row but not the value, and a column named `default` has no slot of
  its own.

### The default slot of `GridCells`

```vue
<GridRow v-for="row in rows" :key="row.key" :row="row">
	<GridCells v-slot="{ column, value }">
		<UiProgress v-if="column.name === 'progress'" :value="Number(value)" />
	</GridCells>
</GridRow>
```

For a change across columns of one body: the slot runs for every cell, and a cell it renders nothing
for keeps its own content.

Costs:

- It is not typed by the columns: `row` and `value` are `unknown`, hence `Number(value)`.
- The names in `column.name === '…'` are strings nothing checks.
- Many columns make a long chain of `v-if`, which every cell runs through.
- You render the body yourself; a grid of your own components has to let you replace its body.
- It belongs to this one body: another grid with the same columns does not get it.

### The `cell` field of the column

```ts
status: column('status', {
	label: 'Status',
	cell: ({ value }) => STATUS[value].label,
}),
```

A function of the same context that returns what to render, as a render function does. The place for
text, and for columns shared as a module between grids, where there is no template: `checkboxCell()`
and the service columns are built on it. Its neighbour `cellFrame` goes around the content instead of
replacing it, whichever gives it: `treeColumn()` puts the indent and the toggle there.

Costs:

- Markup needs `h()`, and nested `h()` calls read poorly.
- No scoped styles, directives or `v-model`: only what a render function has.
- The markup lives in the script, away from the template of the grid.

### `format` and `cellClass`

```ts
amount: column('amount', {
	format: amount => money.format(amount),
	cellClass: ({ value }) => (value < 0 ? 'negative' : undefined),
}),
```

`format` is the text of the value, on one line with an ellipsis; `cellClass` adds classes to the cell
element from the same context.

Costs:

- `format` is text only, and the same text goes to CSV, copying and autosize: the text on screen and
  in an export cannot differ.
- `cellClass` changes the class, never the content, and runs for every cell of a row on every render
  of the row, so keep it cheap.

### A part of your own

```ts
const MyCells = defineComponent({
	setup() {
		const grid = useDataGridContext();
		const row = useBodyRowContext();
		const templates = useGridTemplatesContext(null);

		return () => grid.scope.renderedColumns.value.map((rendered) => {
			const { column } = rendered;
			const current = row();
			const context = column && {
				row: current.original,
				value: column.value(current.original),
				key: current.key,
				index: current.index,
				column,
			};

			return h('div', { key: rendered.key, ...grid.getCellProps(rendered) }, [
				context ? renderCellContent(context, templates) : null,
			]);
		});
	},
});
```

The utility level: the props of each cell from `getCellProps`, the content in the order above from
`renderCellContent`, which takes the templates of `useGridTemplatesContext`, and markup entirely your
own. Its third argument is content of your own, such as that of a slot, which comes first when it
renders something. See [Your own markup](/guides/custom-markup).

Costs:

- `GridCells` already does most of it: `write`, `aria-selected`, the editor and the spacers of the
  column window are yours to redo; `renderCellEditor` gives the editor of a cell being edited.
- It is easy to break the row memo and the stable references the grid relies on.
- Code at this level is usually a render function.

## Header cells

```vue
<GridHeaderTemplate v-slot="{ column }" :column="columns.amount">
	<abbr title="Amount in US dollars">{{ column.label }}</abbr>
</GridHeaderTemplate>
```

```vue
<GridHeaderCell v-for="header in headers" :key="header.key" v-slot="{ direction }" :column="header">
	<GridHeaderContent />
	<GridSortIndicator><UiSortIcon :direction="direction" /></GridSortIndicator>
</GridHeaderCell>
```

```ts
amount: column('amount', { label: 'Amount', header: () => 'Amount, USD' }),
```

The template replaces the label only: the sort indicator and the resize handle stay in
`GridHeaderCell`. The slot of `GridHeaderCell` replaces everything in the cell, so put
`GridHeaderContent` in it to keep the label, and the indicator and the handle yourself; it is shared
by every column and not typed by them. The `header` field needs `h()` for markup. `label` is text,
and is read by CSV, the names of controls and the announcer, so set it even when a template renders
the header.

## Footer cells

```vue
<GridFooterTemplate v-slot="{ aggregate }" :column="columns.amount">
	<strong>{{ money.format(aggregate ?? 0) }}</strong>
</GridFooterTemplate>
```

```vue
<GridFooterRow v-slot="{ columns: footers }" :index="1">
	<GridFooterCell v-for="footer in footers" :key="footer.key" v-slot="{ column, rows }" :column="footer">
		{{ average(column, rows) }}
	</GridFooterCell>
</GridFooterRow>
```

```ts
amount: column('amount', {
	aggregate: 'sum',
	footer: ({ aggregate }) => money.format(aggregate ?? 0),
}),
```

What a footer computes is the column's `aggregate`; the three ways above only show it. The template
fills the column in every footer row whose cells have no slot, so a second row with other content
needs the slot of `GridFooterCell`, which is not typed. The `footer` field needs `h()` for markup,
and `aggregate` has to come before it in the object for its type.

## Editors

```vue
<GridEditorTemplate v-slot="{ inputProps, text, draft, error, errorId, setText }" :column="columns.estimate">
	<input v-bind="inputProps" inputmode="numeric" :value="text ?? draft" @input="setText(readText($event))">
	<span v-if="error" :id="errorId" data-dg-part="editor-error">{{ error }}</span>
</GridEditorTemplate>
```

```ts
price: column('price', { editable: true, setValue, ...numberField({ step: 0.5 }) }),
active: column('active', { editable: true, setValue, ...checkboxField() }),
```

```ts
features: { editing: editing({ editor: textEditor({ multiline: true }), onCommit }) },
```

The template renders the editor of its column, and a cell its slot renders nothing for gets the
column's `editor`. What a typed character does is the column's `typing`, and `editor: false` opens no
editor. The ready editors, `textEditor`,
`numberEditor`, `selectEditor`, `dateEditor` and the fields, are set with options. The `editor` of
the `editing` feature is the default of every editable column without one. A column of yes and no
edits itself with a control and `write`, as `checkboxField()` does. See
[Editors](/components/editors).

Costs:

- An editor that starts from the value, such as a date picker, needs `typing: 'value'` on its
  column: the template renders, the column says how editing starts.
- Forget `v-bind="inputProps"` or `errorId`, and the editor loses its focus, keys, label and
  `aria-invalid`.
- A function editor of your own needs `h()`.
- The default editor of the feature takes a function only.

## Group header cells

```vue
<GridGroupCell v-for="cell in cells" :key="cell.key" v-slot="{ group, collapsed }" :cell="cell">
	<GridGroupContent />
	<GridGroupToggle />
</GridGroupCell>
```

A group has no template: its header comes from the slot of `GridGroupCell`, which is shared by every
group of the row, from the group's `header` field, a function, or from its `label`. See
[Column groups](/guides/column-groups).

## Why the templates are a workaround

The column templates are a workaround, not the design we are aiming for.

A cell is typed by its column only where something hands the column's type to the template. The parts
do not have it: they find the grid through `inject`, and a type does not travel through `inject` into
a template. So the slots of `GridCells`, `GridHeaderCell` and `GridFooterCell` cannot know your
columns, and their contexts are `unknown`.

A template part takes the column as a prop, `:column="columns.status"`, and a prop carries a type:
that is the whole reason for a separate part per column. The parts that render the cells stand
elsewhere in the tree, inside the body, the header and the footer, so the templates reach them
through a registry of the grid, where each template registers itself as it is set up. The costs
above come from that: a template has to come before the cells it fills; there can be two for one
column; and the types of a part generic in its column rest on how `vue-tsc` reads a generic
component.

`defineGridCells` hands the type over the other way: `const Cells = defineGridCells(columns)` is
`GridCells`, the part that renders the cells, typed by the columns in your script, so its own slots
are typed, with no registry, by the plain component types of Vue. It needs the body written where the columns are,
and it covers body cells only. That is why the templates stay: for bodies that are not yours, such as
a grid component of your own that renders it, and for headers, footers and editors.

## Accessibility

- Whatever fills a cell, the cell element stays the part's: its role, `aria-colindex`,
  `aria-selected` and focus do not depend on the content.
- A header that renders an icon or anything but the label keeps the column's name in it, visible or
  visually hidden: the header names the cells of its column for a screen reader.
- Controls in the content keep working with the keyboard: a cell whose only content is a button or
  a link acts as one on <kbd>Enter</kbd>, and a cell with several controls takes focus into them, as
  [Keyboard navigation](/guides/keyboard-navigation#controls-inside-cells) describes.
- An editor binds `inputProps` for its label, keys and `aria-invalid`, and gives its error the id
  `errorId`, so the error is read with the field.
