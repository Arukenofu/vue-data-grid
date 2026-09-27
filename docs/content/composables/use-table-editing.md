---
title: useTableEditing
description: Editing the cells of a table — editors, the keys of a spreadsheet, validation, and immutable writes you apply to your rows.
---

# useTableEditing

<Description>
Editing the cells of a table: editors that open on a key, the keys of a spreadsheet around them,
validation of the draft, and writes that never touch your rows — you get a commit and apply it.
</Description>

<Demo name="api-use-table-history" />

Type on a cell to replace its value, press <kbd>Enter</kbd> or <kbd>F2</kbd> to edit it, or double
click. Arrows move on while you type a value, as in a spreadsheet; <kbd>Tab</kbd> goes to the next
cell. Select a range and press <kbd>Delete</kbd> to clear it.

## Usage

A column is editable when it says so and knows how to write a value into a row:

```ts
import { defineColumn, defineColumns, editing, navigation, numberField, useDataTable } from 'vue-data-grid';
import { shallowRef } from 'vue';

const rows = shallowRef<readonly Product[]>(products);

const column = defineColumn<Product>();

const columns = defineColumns({
	name: column(product => product.name, {
		label: 'Name',
		editable: true,
		setValue: (product, name) => ({ ...product, name }),
		validate: name => (name.trim() === '' ? 'A name is required' : null),
	}),
	stock: column(product => product.stock, {
		label: 'In stock',
		align: 'right',
		editable: product => !product.archived,
		...numberField({ min: 0 }),
		setValue: (product, stock) => ({ ...product, stock: stock ?? 0 }),
	}),
});

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation(),
		editing: editing({
			onCommit: (commit) => {
				rows.value = commit.apply(rows.value);
			},
		}),
	},
});
```

`setValue` returns a new row: rows stay immutable, so the memo of each row, sorting by `delta` and
streams all see the change. `onCommit` gets every change as one commit, whatever wrote it — a typed
value, a paste, a fill, a clear — and `commit.apply(rows)` gives you the array with the changed rows
replaced. Save it to a server there too.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'onCommit', type: '(commit: CellCommit<TRow>) => void', required: true, description: 'Writes a commit into your rows, such as `rows.value = commit.apply(rows.value)`. The table shows the new values once its rows have them.' },
		{ name: 'onBeforeCommit', type: '(request: { edits, source }) => CellEdit[] | false | void', description: 'Called before every commit: return the edits to commit instead, such as with values corrected or some left out, or `false` to commit none.' },
		{ name: 'onWrite', type: '(result: CellWriteResult<TRow>) => void', description: 'Called after every write with what it did: the commit, the cells it skipped and the values `validate` refused, such as to tell the person that a paste left read-only cells alone.' },
		{ name: 'invalid', type: '\'block\' | \'revert\'', default: '\'block\'', description: 'What committing an invalid draft does: keep the cell in editing with its error, or end editing and keep the old value.' },
		{ name: 'editor', type: 'CellEditor', default: 'textEditor()', description: 'The editor of an `editable` column without an `editor` of its own.' },
		{ name: 'enterMove', type: '\'down\' | \'right\' | \'none\'', default: '\'down\'', description: 'Where Enter goes after it saves; Shift+Enter goes the other way. After Tab moved along a row, Enter goes down to the column where Tab started.' },
		{ name: 'focus', type: 'BodyCellFocus', description: 'Focus of the body cells, which a commit moves; the navigation\'s by default.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'true' },
	]"
/>

The column fields that editing reads:

<PropsTable
	label="Column field"
	:data="[
		{ name: 'editable', type: 'boolean | ((row: TRow) => boolean)', default: 'false', description: 'Whether the cells can be edited, or which of them. Service columns never are.' },
		{ name: 'setValue', type: '(row: TRow, value: TValue) => TRow', description: 'The row with the new value, as a new object. Required to edit.' },
		{ name: 'parse', type: '(text: string, row: TRow) => TValue', description: 'The value from text, such as a paste or a text editor gives; the text itself by default.' },
		{ name: 'validate', type: '(value: TValue, row: TRow) => string | null | void', description: 'What is wrong with a value, in words for the person; nothing when it is right.' },
		{ name: 'editor', type: 'CellEditor | false', description: 'The editor of the column, such as `numberEditor()`. `false` for a column whose cell edits itself with a control, such as `checkboxCell()`.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'cell', type: 'Readonly<Ref<EditingCell | null>>', description: 'The cell being edited: its key, column, row, value, draft, text and error.' },
		{ name: 'mode', type: 'Readonly<Ref<\'quick\' | \'full\'>>', description: '`quick` when a typed character started editing, so the arrows save and move; `full` otherwise. F2 switches.' },
		{ name: 'lastCommit', type: 'Readonly<Ref<CellCommit | null>>', description: 'The last commit, for what builds on commits, such as the history.' },
		{ name: 'start', type: '(cell: CellAddress, init?: { text?, draft? }) => boolean', description: 'Starts editing a cell with its value, with `text` in the quick mode, or with a `draft`.' },
		{ name: 'commit', type: '(move?: EditorMove) => boolean', description: 'Commits the draft and moves focus: `down`, `up`, `right`, `left`, `next`, `previous` or `none`. `false` while the draft is invalid.' },
		{ name: 'cancel', type: '() => void', description: 'Ends editing without a write; focus goes back to the cell.' },
		{ name: 'write', type: '(writes: CellWrite[], source: string) => CellWriteResult', description: 'Writes values into cells as one commit, through `validate`: for a control in a cell, an import, a button.' },
		{ name: 'writeText', type: '(cells: CellTextWrite[], source: string) => CellWriteResult', description: 'Writes text into cells through each column\'s `parse`.' },
		{ name: 'paste', type: '(text: string) => CellWriteResult | null', description: 'Writes rows of tab-separated text over the selection, as a spreadsheet lays them.' },
		{ name: 'clear', type: '(source?: string) => CellWriteResult', description: 'Clears the selected cells: each gets the value of empty text.' },
		{ name: 'fillSelection', type: '() => boolean', description: 'Writes the draft into every selected cell, as Ctrl+Enter does.' },
		{ name: 'canEdit', type: '(cell: CellAddress) => boolean', description: 'Whether a cell can be edited now.' },
		{ name: 'isEditing', type: '(cell: CellAddress) => boolean', description: 'Whether this cell is being edited. Reactive per row.' },
		{ name: 'getEditor', type: '(column: RuntimeColumn) => CellEditor | null', description: 'The editor a column\'s cells open.' },
		{ name: 'getEditorContext', type: '(cell: CellContext) => EditorContext | null', description: 'What the editor of the cell being edited renders from; `TableCells` calls it.' },
		{ name: 'hasSelection', type: '() => boolean', description: 'Whether there are cells to paste over or clear.' },
	]"
/>

Every write has a `source`: `edit`, `paste`, `fill`, `clear`, `cut`, `undo`, `redo`, or a name of your
own. It reaches `onBeforeCommit`, `onCommit` and the history, so you can treat a paste differently
from a keystroke.

## Examples

### An editor of your own

An editor is a function of its context that renders the field. Bind `inputProps` to the element that
takes input: it focuses it, gives it the keys of editing, its label and its error.

```ts
import type { CellEditor } from 'vue-data-grid';
import { h } from 'vue';

const PRIORITIES = ['low', 'medium', 'high'] as const;

type Priority = (typeof PRIORITIES)[number];

function isPriority(value: string): value is Priority {
	return PRIORITIES.some(priority => priority === value);
}

export const priorityEditor: CellEditor<Task, Priority> = context => h('select', {
	...context.inputProps,
	value: context.draft,
	onChange: (event: Event) => {
		const select = event.target;

		if (select instanceof HTMLSelectElement && isPriority(select.value)) {
			context.setDraft(select.value);
		}
	},
}, PRIORITIES.map(priority => h('option', { value: priority }, priority)));
```

The built-in editors — `textEditor`, `numberEditor`, `selectEditor`, `dateEditor` and
`checkboxCell` — are on the [Editors](/components/editors) page.

### Saving to a server

Apply the commit at once and save it in the background; put the old rows back if the server says
no. Every row a commit changes is in `commit.rows`, by key.

```ts
editing({
	onCommit: async (commit) => {
		const before = rows.value;

		rows.value = commit.apply(before);

		try {
			await api.saveProducts([...commit.rows.values()]);
		} catch {
			rows.value = before;
		}
	},
});
```

### Refusing some writes

```ts
editing({
	onCommit,
	onBeforeCommit: ({ edits, source }) => (source === 'paste'
		? edits.filter(edit => edit.column !== 'price')
		: undefined),
});
```

## Accessibility

- Editors are named after their column with `aria-label`, and a field that takes input is focused
  as it opens; the caret goes to the end of what was typed.
- An invalid draft sets `aria-invalid="true"` on the field and points `aria-describedby` at the error,
  so the screen reader reads the problem with the field.
- The cell being edited carries `data-tc-state="editing"`, and focus returns to the cell after a
  commit or a cancel, where the grid keys work again.
- The keys of an input method's composition are left to it: Enter that picks a word does not save.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'F2'], description: 'On a cell, starts editing it with its value.' },
		{ keys: ['A character'], description: 'On a cell, starts editing with that character in place of the value; the arrows then save and move.' },
		{ keys: ['Delete', 'Backspace'], description: 'On a cell, clears the selected cells.' },
		{ keys: ['Enter'], description: 'In an editor, saves and moves down, or as `enterMove` says.' },
		{ keys: ['Shift+Enter'], description: 'In an editor, saves and moves the other way.' },
		{ keys: ['Tab', 'Shift+Tab'], description: 'Saves and moves to the next or the previous cell that can be edited, on to the next row.' },
		{ keys: ['Ctrl+Enter'], description: 'Writes the draft into every selected cell.' },
		{ keys: ['F2'], description: 'In an editor, switches between moving the caret and moving to the next cell with the arrows.' },
		{ keys: ['Escape'], description: 'Cancels editing and keeps the old value.' },
	]"
/>

A double click on a cell starts editing it too, and leaving the editor saves it.

## See also

- [Editing](/guides/editing): the guide.
- [Editors](/components/editors): the built-in editors and fields.
- [useTableHistory](/composables/use-table-history): undo and redo of the commits.
