---
title: TypeScript
description: How the row type and the column names flow from your data into cells, features and slots, and how to type components that take a grid.
---

# TypeScript

<Description>
Types flow from your data: the row type from the columns and the rows, the value of each column
from its <code>value</code>, the names of the columns from <code>defineColumns</code>. In the common case you write one
type argument, on <code>defineColumn</code>, and none on the grid.
</Description>

## Rows and columns

`defineColumn<Person>()` makes a builder for columns of one row type, with defaults they share.
Each column's value type comes from its `value` function, and flows into its `format`, `compare`,
`cell` and `footer`:

```ts
import { defineColumn, defineColumns } from '@vue-data-grid/core';

interface Person {
	id: string;
	name: string;
	salary: number;
}

const column = defineColumn<Person>({ sortable: true });

const columns = defineColumns({
	name: column(person => person.name, { label: 'Name' }),
	salary: column(person => person.salary, {
		label: 'Salary',
		// `salary` is a number here, and `person` a Person in `cell`.
		format: salary => salary.toLocaleString('en-US'),
	}),
});
```

The keys of `defineColumns` are the names of the columns: `'name' | 'salary'` here.

## The grid

`useDataGrid` takes the row type from `columns` and `rows`, and each feature handle from the
features you pass. A handle you did not ask for is `undefined` in the type too:

```ts
const grid = useDataGrid({
	columns,
	rows: people,
	rowKey: 'id',
	rowHeight: 36,
	features: { selection: selection() },
});

grid.rows.value; // readonly Person[]
grid.selection.toggle('a'); // the selection is there
grid.sorting; // undefined: no sorting feature
```

Do not write `useDataGrid<Person>({ … })`: an explicit type argument fixes the other parameters at
their defaults, and every feature handle becomes `undefined`. Type the rows or the columns instead.

A feature that needs another one is a type error without it, at the place you pass it: `fill()`
without `ranges` and `editing`, `history()` without `editing`.

### Features that take the row

A factory in `features` gets the row type from the grid. `editing` is the one where it shows, in
`onCommit`:

```ts
features: {
	editing: editing({
		// `commit.apply` takes and returns Person rows.
		onCommit: (commit) => {
			rows.value = commit.apply(rows.value);
		},
	}),
},
```

A factory called apart from `useDataGrid`, such as into a variable of its own, has no grid to learn
from: give it the row type, `editing<Person>({ … })`.

## Column names

`ColumnName<typeof columns>` is the union of the names, for names you keep in your own code:

```ts
import type { ColumnName, GridSort } from '@vue-data-grid/core';

type PersonColumn = ColumnName<typeof columns>; // 'name' | 'salary'

const pinned: PersonColumn = 'name';
const initialSort: GridSort<PersonColumn>[] = [{ name: 'salary', direction: 'desc' }];
```

The `sort` option of `useDataGrid` checks the names of a list against the columns, so a typo fails
the build. A `ref` passed as a model may hold any names, as a `defineModel` of a component does;
type the ref with `GridSort<ColumnName<typeof columns>>` to check it too.

The methods of `grid.scope` take names as plain strings, so a name from `column.name`, a prop or a
stored setting fits without a cast. A method that changes the grid by a name that is not a
declared column, such as `scope.pinColumn('nmae', 'start')`, ignores it and warns once in
development.

## Components that take a grid

A component that renders any grid of people takes a `DataGrid<Person>`, where every feature handle
may be `undefined`. Name the handles it needs in the second parameter, and the parent must pass a
grid that has them:

```vue
<script setup lang="ts">
import type { DataGrid, GridSelectionFeature } from '@vue-data-grid/core';

const props = defineProps<{
	grid: DataGrid<Person, { selection: GridSelectionFeature }>;
}>();

props.grid.selection.toggleAll(); // no `?.`: the selection is there
</script>
```

A grid with more features fits where one with fewer is taken, so no generic component is needed.
The handle types are `GridSelectionFeature`, `GridNavigationFeature`, `GridRangesFeature`,
`GridClipboardFeature`, and, with the row type, `GridRowsFeature<Person>` for `sorting` and
`grouping`, `GridTreeFeature<Person>`, `GridEditingFeature<Person>`, `GridHistoryFeature<Person>`
and `GridFillFeature<Person>`.

## Slots

The parts take the grid from their context, where its row type is not known, so their slots type
the row as `unknown`: `GridBody` gives `GridBodyRow` items, `GridCells` a `CellSlotContext`. Four
ways to a typed row:

- **A template of the column.** `GridCellTemplate`, `GridHeaderTemplate`, `GridFooterTemplate` and
  `GridEditorTemplate` take the column from `defineColumns` as `:column`, and the column types their
  slot: the row, the value and the column's `aggregate`. They are the first choice: the content of a
  column wherever the body is rendered, such as by a grid component of yours, and they cover headers,
  footers and editors.

```vue
<GridCellTemplate v-slot="{ value, row }" :column="columns.status">
	<!-- value: Status, row: Person -->
	<StatusBadge :status="value" :name="row.name" />
</GridCellTemplate>
```

- **`defineGridCells`.** It gives `GridCells` typed by the columns you pass: a slot for each column,
  and a slot named after no column is a type error. It overrides the templates in one body you write
  yourself.

```vue
<script setup lang="ts">
const Cells = defineGridCells(columns);
</script>

<template>
	<GridRow v-for="row in rows" :key="row.key" :row="row">
		<Cells>
			<template #status="{ value, row: person }">
				<!-- value: Status, person: Person -->
				<StatusBadge :status="value" :name="person.name" />
			</template>
		</Cells>
	</GridRow>
</template>
```

- **Render in the column.** The `cell` field of a column gets a context of its own row and value
  types too, for text or for columns shared as a module.
- **Read the row from the grid.** In a slot of a part, the index points into the grid's typed rows:

```vue
<GridCells v-slot="{ column, index }">
	<StatusBadge v-if="column.name === 'status'" :status="grid.rows.value[index].status" />
</GridCells>
```

## Editors

An editor of your own is a `GridEditorTemplate` of its column: the slot gets an `EditorContext`
with the draft typed as the column's value, `number` for a column of numbers.

```vue
<GridEditorTemplate v-slot="{ inputProps, draft, setDraft }" :column="columns.rating">
	<input
		v-bind="inputProps"
		type="range"
		:value="draft"
		@input="setDraft(Number(($event.target as HTMLInputElement).value))"
	>
</GridEditorTemplate>
```

`setDraft` takes a `number` here: a string is a type error in the template. The built-in editors
say what they edit: `numberEditor()` is a `CellEditor<TRow, number | null>`, which fits a column of
`number | null` only.

## Types to know

<ReturnsTable
	label="Type"
	:data="[
		{ name: 'DataGrid<TRow, THandles>', type: 'interface', description: 'The grid object of `useDataGrid`, for props and variables.' },
		{ name: 'GridCellsComponent<TColumns>', type: 'type', description: 'What `defineGridCells` returns: `GridCells` with its slots typed by the columns.' },
		{ name: 'GridCellsSlots<TColumns>', type: 'type', description: 'Its slots: one for each column, typed by it, and `default`.' },
		{ name: 'DataGridOptions<TRow, TColumns, TFeatures>', type: 'type', description: 'The options of `useDataGrid`, for a wrapper that builds grids.' },
		{ name: 'GridColumns', type: 'type', description: 'Columns of a grid: an object from `defineColumns`, or an array.' },
		{ name: 'ColumnName<TColumns>', type: 'type', description: 'The names of columns from `defineColumns`; `string` for an array.' },
		{ name: 'GridSort<TName>', type: 'interface', description: 'One column of the sort: `{ name, direction }`.' },
		{ name: 'CellContext<TRow, TValue>', type: 'interface', description: 'What a `cell` field gets: the row, its value, key and index, the column and the tree node.' },
		{ name: 'HeaderContext, FooterContext', type: 'interface', description: 'What `header` and `footer` fields get.' },
		{ name: 'CellEditor<TRow, TValue>, EditorContext<TRow, TValue>', type: 'interface', description: 'An editor, and what it renders from.' },
		{ name: 'GridTemplateColumn<TRow, TValue, TAggregate>', type: 'interface', description: 'The column a template part takes as `:column`, which types its slot.' },
		{ name: 'GridMessages', type: 'interface', description: 'Every string of the interface, for a language of your own.' },
	]"
/>

## Accessibility

- Type a translation as a whole with `satisfies GridMessages` rather than `Partial<GridMessages>`:
  a string left out is then a build error instead of a control that speaks English on a page in
  another language.

```ts
import { DEFAULT_MESSAGES, type GridMessages } from '@vue-data-grid/core';

const german = {
	...DEFAULT_MESSAGES,
	selectRow: 'Zeile auswählen',
	// …
} satisfies GridMessages;
```

- The functions among the messages, such as `selected(count)` and `dragRow(label)`, are typed, so a
  language builds its own sentence around the value instead of gluing words.

## See also

- [Columns](/guides/columns): the fields of a column and their contexts.
- [useDataGrid](/composables/use-data-grid): the options and the grid object.
- [Features](/composables/features): the factories and their handles.
- [Contexts](/composables/contexts): the contexts that parts of your own read.
