---
title: Editing
description: Editable cells with the keys of a spreadsheet, validation, paste, the fill handle, and undo.
---

# Editing

<Description>
Make a column editable with two fields, and the grid brings the rest: editors for text, numbers,
dates and choices, the keys of a spreadsheet, validation, paste, the fill handle, and undo.
</Description>

<Demo name="editing" />

Type over a price and press <kbd>Enter</kbd>. Double-click a category to pick another, clear a cell
with <kbd>Delete</kbd>, select a few cells and drag the square at the corner of the selection to
fill them, then undo it all with <kbd>Ctrl</kbd>+<kbd>Z</kbd>. A price below zero is refused with a
message under the cell.

## 1. Make a column editable

A cell can be edited when its column says `editable` and knows how to write a new value into a row,
with `setValue`:

```ts
const column = defineColumn<Product>();

const columns = defineColumns({
	name: column(product => product.name, {
		label: 'Product',
		editable: true,
		setValue: (product, name) => ({ ...product, name }),
		validate: name => (name.trim() === '' ? 'Give the product a name' : undefined),
	}),
});
```

`setValue` returns a **new** row rather than changing the old one. That is not a matter of taste:
the grid finds out what to re-render by comparing rows by reference, so a row changed in place
would never show its new value. `editable` can also be a function of the row, such as
`product => !product.archived`, and `defineColumn<Product>({ editable: true })` makes every column of
the builder editable at once.

## 2. Write the changes back

The grid never touches your data. It hands you a **commit** and you decide what to do with it: put
it into your rows, send it to a server, or both. That is the `editing` feature:

```ts
import { editing, navigation, ranges, useDataGrid } from '@vue-data-grid/core';

const rows = shallowRef(products);

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		editing: editing({
			onCommit: (commit) => {
				rows.value = commit.apply(rows.value);
			},
		}),
	},
});
```

`commit.apply` returns your array with the changed rows replaced; the other rows keep their
references, so only the changed rows render again. A commit also lists its `edits`, each with the
row key, the column, and the value `before` and `after`, and its `source`: `'edit'`, `'paste'`,
`'fill'`, `'clear'`, `'cut'`, `'undo'` or `'redo'`.

Editing needs a focused cell to start from, which is why `navigation` comes with it. With `ranges`,
<kbd>Delete</kbd>, paste and the fill handle work on the selected cells rather than the focused one.
The commit knows what a row is from the grid: in `features`, `commit.apply` takes and returns
`Product` rows. A factory called apart from `useDataGrid`, such as into a variable of its own, takes
the row type as an argument: `editing<Product>({ … })`.

## Editors

A column without an `editor` is edited as text. For other values, the package has editors ready,
each a function you put in the column:

| Helper | For | What it brings |
| --- | --- | --- |
| `textEditor(options?)` | text | a text field; `multiline` for a text area that grows over the rows below |
| `numberField(options?)` | `number \| null` | a numeric field with `min`, `max`, `step` and `digits`, and a `parse` that reads `,` and `.` alike |
| `selectEditor({ options })` | one of a list | a combobox that filters as you type, opening up or down where there is room |
| `dateField(options?)` | dates | the browser's date field, with `min` and `max`, as a `Date` or as `YYYY-MM-DD` text |
| `checkboxField()` | `boolean` | a checkbox in the cell itself, which writes on a click, with no editor to open |

The helpers ending in `Field` give several fields of the column at once, an `editor` and a `parse`,
so spread them into it:

```ts
price: column(product => product.price, {
	label: 'Price',
	align: 'right',
	editable: true,
	setValue: (product, price) => ({ ...product, price }),
	...numberField({ min: 0, step: 0.5, digits: 2 }),
}),
```

An empty number cell is `null`, and text that is not a number is `NaN`, so type the value of such a
column as `number | null` and let `validate` refuse `NaN`.

### An editor of your own

An editor with markup of your own is a `GridEditorTemplate` of its column, in the template of the
grid. Bind `inputProps` to the element to type in: they focus it, give it the keys of the grid, a
label, and the error state.

```vue
<GridRoot :grid="grid" label="Labels">
	<GridEditorTemplate v-slot="{ inputProps, text, draft, setText }" :column="columns.color">
		<span class="color-editor">
			<span class="color-swatch" :style="{ background: draft }" />
			<input
				v-bind="inputProps"
				:value="text ?? draft"
				@input="setText(($event.target as HTMLInputElement).value)"
			>
		</span>
	</GridEditorTemplate>
	<!-- the header and the body -->
</GridRoot>
```

`:column` types the slot by the column, so `draft` is a `string` here. `setText` keeps the text as
typed and reads the value through the column's `parse`; `setDraft` sets a value as it is. The
template renders the editor in place of the column's `editor`. What a character typed on the cell
does is the column's `typing`: this field starts from the character, as text does; an editor that
cannot start from one letter, such as a date picker, sits on a column with `typing: 'value'`, and
typing on the cell opens it with the value.

## Two ways to edit a cell

Editing starts in one of two modes, as in Excel:

- **Typing a character** on a cell replaces its value with that character, and the arrow keys save
  and move on. It is the fast way to fill in value after value.
- **<kbd>Enter</kbd>, <kbd>F2</kbd> or a double click** opens the editor with the value, and the
  arrow keys move inside the text.

<kbd>F2</kbd> switches between the two. <kbd>Enter</kbd> saves and moves down, and
<kbd>Tab</kbd> saves and moves to the next cell that can be edited, wrapping to the next row;
`editing({ enterMove: 'right' })` or `'none'` changes where <kbd>Enter</kbd> goes. Leaving the
editor, by a click elsewhere, saves too.

## Validation

`validate` returns what is wrong with a value, in words for the person, or nothing when it is
right. While the draft is wrong, the editor shows the message under the cell and stays open; with
`editing({ invalid: 'revert' })` it closes and keeps the old value instead.

A paste or a fill writes many cells at once and cannot stop at each wrong one. It writes the valid
values and reports the rest, which `onWrite` hears about:

```ts
editing({
	onCommit: (commit) => {
		rows.value = commit.apply(rows.value);
	},
	onWrite: (result) => {
		if (result.invalid.length > 0) {
			notify(`${result.invalid.length} values were not valid and were left out`);
		}
	},
}),
```

## Changing a commit before it lands

`onBeforeCommit` sees every commit before it is written. Return the edits to write instead, such as
with values rounded or some left out, or `false` to write nothing:

```ts
editing({
	onBeforeCommit: ({ edits }) => edits.map(edit => (
		edit.column === 'price' && typeof edit.after === 'number'
			? { ...edit, after: Math.round(edit.after * 100) / 100 }
			: edit
	)),
	onCommit: (commit) => {
		rows.value = commit.apply(rows.value);
	},
}),
```

Edits that come back are checked again, so returning an edit of a read-only cell writes nothing.

## Paste, clear and fill

With the [`clipboard`](/guides/cell-ranges#copy-and-paste) feature, <kbd>Ctrl</kbd>+<kbd>V</kbd>
lays the rows of the clipboard over the selection the way a spreadsheet does, and
<kbd>Ctrl</kbd>+<kbd>X</kbd> cuts. <kbd>Delete</kbd> clears the selected cells, each to the value of
empty text through its column's `parse`. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> in an editor writes its
draft into every selected cell.

The `fill` feature adds the fill handle: a small square at the corner of the last range. Drag it
down, up or sideways, and the new cells continue the range: numbers as a series, `1, 2` going on
`3, 4`, and everything else repeated. Hold <kbd>Ctrl</kbd> while dragging to repeat numbers too.
<kbd>Ctrl</kbd>+<kbd>D</kbd> and <kbd>Ctrl</kbd>+<kbd>R</kbd> fill down and right from the keyboard.

```ts
import { editing, fill, navigation, ranges } from '@vue-data-grid/core';

features: {
	navigation: navigation(),
	ranges: ranges(),
	editing: editing({ onCommit }),
	fill: fill(),
},
```

Put the handle in the corner of the range overlay, and the preview of the range being filled next
to it:

```vue
<GridBody v-slot="{ rows }">
	<GridRow v-for="row in rows" :key="row.key" :row="row">
		<GridCells />
	</GridRow>
	<GridRangeOverlay v-slot="{ corner }">
		<GridFillHandle v-if="corner" />
	</GridRangeOverlay>
	<GridFillPreview />
</GridBody>
```

A fill needs both `ranges` and `editing`, and TypeScript says so when one is missing.

## Undo and redo

The `history` feature keeps the commits as steps:

```ts
import { history } from '@vue-data-grid/core';

features: {
	editing: editing({ onCommit }),
	history: history({ limit: 50 }),
},
```

<kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes, <kbd>Ctrl</kbd>+<kbd>Y</kbd> or
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redoes, and the handle has the same for buttons:
`grid.history.undo()`, `redo()`, `canUndo`, `canRedo` and `clear()`. An undo is an ordinary commit
with the source `'undo'`, so it reaches your `onCommit` and your server like any other edit.

History survives sorting and streaming: steps are held by row key, and an undo writes the old value
back only while the cell still holds the value of that step. A price that a live feed changed since
is left alone rather than overwritten.

## Writing from code

The handle of the feature writes cells the same way the keys do, through validation and
`onCommit`:

```ts
grid.editing.write([{ key: 'p3', column: 'stock', value: 20 }], 'restock');
grid.editing.writeText([{ key: 'p3', column: 'price', text: '219.90' }], 'import');
grid.editing.start({ key: 'p3', column: 'name' });
```

The second argument is the source of the commit, any string you like, so `onCommit` can tell a
restock from an edit.

## Accessibility

- The editor is named by its column's label, and a wrong draft gets `aria-invalid` and
  `aria-describedby` pointing at its message, so a screen reader reads the error with the field.
- Focus goes into the editor when it opens and back to the cell when it closes, so the grid keys go
  on where they left off.
- `numberField` is a `spinbutton` with its value and limits; `selectEditor` is a combobox with a
  listbox; the checkbox of `checkboxField` is named by its column.
- The fill handle is hidden from assistive technology, because <kbd>Ctrl</kbd>+<kbd>D</kbd> and
  <kbd>Ctrl</kbd>+<kbd>R</kbd> do the same from the keyboard.
- Keys of an input method's composition are left to it, so typing Japanese into a cell does not
  commit on the <kbd>Enter</kbd> that ends a word.

### Keyboard interactions

On a cell:

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'F2'], description: 'Opens the editor with the value; the arrows move in the text.' },
		{ keys: ['A character'], description: 'Opens the editor with that character in place of the value; the arrows save and move.' },
		{ keys: ['Delete', 'Backspace'], description: 'Clears the selected cells.' },
		{ keys: ['Ctrl+D', '⌘+D'], description: 'Fills the range down from its first row, with the `fill` feature.' },
		{ keys: ['Ctrl+R', '⌘+R'], description: 'Fills the range right from its first column, with the `fill` feature.' },
		{ keys: ['Ctrl+Z', '⌘+Z'], description: 'Undoes the last commit, with the `history` feature.' },
		{ keys: ['Ctrl+Y', 'Ctrl+Shift+Z', '⌘+Shift+Z'], description: 'Redoes it.' },
		{ keys: ['Ctrl+V', '⌘+V'], description: 'Pastes over the selection, with the `clipboard` feature.' },
	]"
/>

In an editor:

<KeyboardTable
	:data="[
		{ keys: ['Enter'], description: 'Saves and moves down, or where `enterMove` says; Shift+Enter goes the other way.' },
		{ keys: ['Tab', 'Shift+Tab'], description: 'Saves and moves to the next or the previous cell that can be edited.' },
		{ keys: ['Ctrl+Enter', '⌘+Enter'], description: 'Writes the draft into every selected cell.' },
		{ keys: ['↑', '↓', '←', '→'], description: 'After typing a character: save and move. After Enter or F2: move in the text.' },
		{ keys: ['F2'], description: 'Switches between the two modes.' },
		{ keys: ['Escape'], description: 'Closes the editor without saving.' },
	]"
/>

## See also

- [Editors](/components/editors): every editor and its options.
- [`useGridEditing`](/composables/use-grid-editing), [`useGridHistory`](/composables/use-grid-history)
  and [`useGridFill`](/composables/use-grid-fill): the features for markup of your own.
- [Cell ranges and clipboard](/guides/cell-ranges): selecting what to paste over and fill.
- [Spreadsheet](/examples/spreadsheet): all of it together.
