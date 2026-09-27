---
title: Editors
description: Ready editors for text, numbers, choices, dates and yes-or-no values, and how to write your own.
---

# Editors

<Description>
The fields a cell turns into while it is edited: ready editors for text, numbers, choices, dates and
yes-or-no values, and a small contract for writing your own.
</Description>

<Demo name="part-editors" />

## Features

<Highlights
	:features="[
		'Two modes, as in a spreadsheet: type over a cell and the arrows save and move on; press Enter and the arrows stay in the field.',
		'Values are checked by the column\'s `validate`; an invalid draft keeps the editor open with its error.',
		'A list editor that filters its choices as you type, and opens above the cell when there is more room there.',
		'A checkbox in the cell for yes-or-no columns, which writes on a click, with no editor at all.',
		'Any editor of your own from one function of the editor context, such as the Reka UI date picker of the demo.',
	]"
/>

## Anatomy

An editor belongs to a column, next to what makes the column editable: `editable` and a `setValue`
that returns the row with the new value.

```ts
import { defineColumn, defineColumns, numberField, selectEditor } from '@vue-stack/table';

const column = defineColumn<Product>({ editable: true });

const columns = defineColumns({
	name: column(product => product.name, {
		label: 'Product',
		setValue: (product, name) => ({ ...product, name }),
	}),
	category: column(product => product.category, {
		label: 'Category',
		editor: selectEditor({ options: categories }),
		setValue: (product, category) => ({ ...product, category }),
	}),
	price: column(product => product.price, {
		label: 'Price',
		...numberField({ min: 0, digits: 2 }),
		setValue: (product, price) => ({ ...product, price }),
	}),
});
```

The table edits with the `editing` feature, which hands every commit to you: write it into your rows,
and save it wherever they live.

```ts
import { editing, navigation, useDataTable } from '@vue-stack/table';

const rows = shallowRef(products);

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation(),
		editing: editing({ onCommit: commit => (rows.value = commit.apply(rows.value)) }),
	},
});
```

`TableCells` renders the editor in the cell being edited, and the rest of the table does not render.
A column without `editor` edits with `textEditor()`.

## API reference

### textEditor

An editor of text on an `input`, or a `textarea` that grows over the rows below with `multiline`.
The draft comes through the column's `parse`, and the text stays as it was typed.

<PropsTable
	label="Option"
	:data="[
		{ name: 'format', type: '(value) => string', description: 'The text of a value the editor starts with; `String(value)`, and `\'\'` for `null`, by default.' },
		{ name: 'placeholder', type: 'string', description: 'The placeholder of the field.' },
		{ name: 'maxLength', type: 'number', description: 'The longest text the field takes.' },
		{ name: 'multiline', type: 'boolean', default: 'false', description: 'A text area of several lines: Alt+Enter breaks a line, Enter saves. It grows up to `--tc-editor-text-max-height`.' },
	]"
/>

### numberEditor and numberField

An editor of a number on a text field with a numeric keyboard: `.` and `,` both mark the fraction,
empty text is `null`, and text that is not a number is `NaN`, for `validate` to refuse. In the full
mode ↑ and ↓ step the number. `numberField(options)` gives `{ editor, parse }` to spread into a
column, so a paste and a cleared cell read text the same way.

<PropsTable
	label="Option"
	:data="[
		{ name: 'min', type: 'number', description: 'The smallest value ↑ and ↓ step to.' },
		{ name: 'max', type: 'number', description: 'The largest value ↑ and ↓ step to.' },
		{ name: 'step', type: 'number', default: '1', description: 'The step of ↑ and ↓.' },
		{ name: 'digits', type: 'number', description: 'How many digits after the point the editor starts with; as the value has them by default.' },
	]"
/>

### selectEditor

An editor that picks one of `options`, as a combobox: its field filters the choices as you type, and
the list opens under the cell, or above it where there is more room. The highlighted choice is the
draft; Enter or Tab saves it, and so does a click on a choice.

<PropsTable
	label="Option"
	:data="[
		{ name: 'options', type: 'SelectEditorOption[] | (row) => SelectEditorOption[]', required: true, description: 'The choices, `{ value, label, disabled? }`, or a function of the row for choices that depend on it.' },
		{ name: 'filter', type: '(option, text) => boolean', description: 'Whether a choice matches the text typed; its label holds the text, in any case, by default.' },
	]"
/>

### dateEditor and dateField

An editor of a date on the browser's date field, by the local calendar. The draft is a `Date` at
local midnight, or `YYYY-MM-DD` text with `value: 'text'`; an empty field is `null`. A date field
cannot start from one typed character, so typing on the cell opens it with the value.
`dateField(options)` gives `{ editor, parse }`.

<PropsTable
	label="Option"
	:data="[
		{ name: 'min', type: 'Date | string', description: 'The earliest date, as a `Date` or `YYYY-MM-DD`.' },
		{ name: 'max', type: 'Date | string', description: 'The latest date.' },
		{ name: 'value', type: '\'date\' | \'text\'', default: '\'date\'', description: 'What the draft is: a `Date`, or `YYYY-MM-DD` text.' },
	]"
/>

### checkboxCell and checkboxField

A checkbox as the `cell` of a column of yes and no, which writes a click at once, as Enter and Space
do through the navigation. It is disabled where the cell cannot be edited. `checkboxField()` gives
`{ cell, editor: false, parse }`: no editor opens, and a paste of `true`, `1` or `yes` is `true`.

<DataAttributesTable
	:data="[
		{ attribute: '[data-tc-part]', values: ['editor', 'editor-error', 'editor-list', 'editor-option', 'editor-empty', 'cell-checkbox'] },
		{ attribute: '[data-tc-state]', values: ['quick', 'full'] },
		{ attribute: '[data-tc-side]', values: ['top', 'bottom'] },
	]"
/>

`editor` is the field, `editor-error` the error under it, `editor-list` the list of `selectEditor`
with its `editor-option`s and `editor-empty`, and `cell-checkbox` the box of `checkboxCell()`. The
field carries the mode in `data-tc-state`, and a checked choice of the list `data-tc-state="checked"`;
the list says in `data-tc-side` which side of the cell it opened on.

<CssVariablesTable
	:data="[
		{ name: '--tc-error-color', default: '#d93025', description: 'The outline of an invalid draft and the background of its error.' },
		{ name: '--tc-editor-list-max-height', default: '16em', description: 'The list of `selectEditor`, which also keeps to the room in view.' },
		{ name: '--tc-editor-text-max-height', default: '12em', description: 'A text area of `textEditor({ multiline: true })`, growing with its text.' },
	]"
/>

### EditorContext

What an editor of your own renders from: the cell context and the draft.

<ReturnsTable
	label="Field"
	:data="[
		{ name: 'draft', type: 'TValue', description: 'The value being typed, which a commit writes.' },
		{ name: 'text', type: 'string | undefined', description: 'The text typed, when the draft comes from text.' },
		{ name: 'mode', type: '\'quick\' | \'full\'', description: 'How editing started: a typed character, or Enter, F2 or a double click.' },
		{ name: 'error', type: 'string | null', description: 'What `validate` says of the draft.' },
		{ name: 'errorId', type: 'string', description: 'The id for an element with the error.' },
		{ name: 'setDraft', type: '(value: TValue) => void', description: 'Sets the draft to a value.' },
		{ name: 'setText', type: '(text: string, draft?: TValue) => void', description: 'Sets the draft from text, through the column\'s `parse` or as `draft` says.' },
		{ name: 'commit', type: '(move?: EditorMove) => void', description: 'Saves the draft and moves focus: `down`, `up`, `right`, `left`, `next`, `previous` or `none`.' },
		{ name: 'cancel', type: '() => void', description: 'Ends editing without a write.' },
		{ name: 'inputProps', type: 'Record<string, unknown>', description: 'Props for the element that takes input: focus on mount, the keys, a commit on blur, the label and `aria-invalid`.' },
		{ name: 'row, value, key, index, column, node', type: 'CellContext', description: 'The cell, as a `cell` field gets it.' },
	]"
/>

## Examples

### Validation

`validate` gets the value and the row, and returns what is wrong in words for the person, or nothing.
An invalid draft keeps the editor open, marked `aria-invalid`, with the error under it:

```ts
price: column(product => product.price, {
	label: 'Price',
	...numberField({ min: 0 }),
	setValue: (product, price) => ({ ...product, price }),
	validate: price => (price === null || Number.isNaN(price) || price < 0 ? 'Enter zero or more' : undefined),
}),
```

`editing({ invalid: 'revert' })` ends editing and keeps the old value instead.

### An editor of your own

An editor is a function of its context that renders the field. Bind `inputProps` to the element
that takes input: it brings focus, the keys, the commit on blur and the accessible name.

```ts
import type { CellEditor } from '@vue-stack/table';
import { h } from 'vue';

function ratingEditor(): CellEditor<Product, number> {
	return context => h('input', {
		...context.inputProps,
		type: 'range',
		min: 0,
		max: 5,
		value: context.draft,
		onInput: (event: Event) => {
			if (event.target instanceof HTMLInputElement) {
				context.setDraft(Number(event.target.value));
			}
		},
	});
}
```

An editor that cannot start from one typed character, as a date field cannot, says so with
`typing = 'value'`: typing on the cell then opens it with the value, in the full mode.

### A date picker of Reka UI

The dates of the demo are edited with the [Date Picker](https://reka-ui.com/docs/components/date-picker)
of Reka UI: a field of segments, and a calendar that opens with it. It is a component of its own,
and the editor is a function that renders it:

```ts
import type { CellEditor } from '@vue-stack/table';
import { h } from 'vue';

import DateEditor from './DateEditor.vue';

export function rekaDateEditor<TRow>(): CellEditor<TRow, string | null> {
	const editor: CellEditor<TRow, string | null> = context => h(DateEditor, { context });

	editor.typing = 'value';

	return editor;
}
```

```ts
restock: column(product => product.restock, {
	label: 'Restock',
	editor: rekaDateEditor<Product>(),
	parse: parseDay,
	setValue: (product, restock) => ({ ...product, restock }),
}),
```

A picker is several elements rather than one: the segments of the field, a trigger, and a calendar
in a popover outside the table. So the component spreads `inputProps` on the field, which gives it
the keys, the name and the error, but keeps two of them for itself:

- `ref`, which would focus the field: the calendar takes focus when it opens.
- `onBlur`, which would commit as soon as focus moved from the field to the calendar. The component
  calls it when focus leaves the field and the calendar together:

```ts
const fieldProps = computed(() => Object.fromEntries(
	Object.entries(props.context.inputProps).filter(([name]) => name !== 'ref' && name !== 'onBlur'),
));

function leave(event: FocusEvent) {
	const commitOnLeave = props.context.inputProps.onBlur;

	if (!isInside(event.relatedTarget) && typeof commitOnLeave === 'function') {
		commitOnLeave(event);
	}
}
```

The draft follows the picker through `setDraft`, and a day chosen in the calendar commits at once
with `commit('none')`, which puts focus back on the cell. In the calendar the arrows move between
days and <kbd>Enter</kbd> picks one; <kbd>Escape</kbd> closes the calendar, and a second
<kbd>Escape</kbd> in the field cancels the edit. The full component is in the Code view of the demo.

## Accessibility

- The field of an editor is named after its column, has `aria-invalid` with an error, and
  `aria-describedby` points at the error, so a screen reader reads the problem with the field.
- The list of `selectEditor` is a `combobox` with a `listbox`: the highlighted choice is its
  `aria-activedescendant`, and a list that finds nothing says so, "No matches".
- `numberEditor` is a `spinbutton` with `aria-valuemin`, `aria-valuemax` and `aria-valuenow`.
- The date picker of Reka UI names every day of its calendar in full, "Wednesday, October 14, 2026",
  and its field segments are spin buttons a screen reader reads one by one.
- Focus goes back to the cell after a commit or a cancel, or on to the next cell as the key says, so
  editing never loses the place in the grid.

### Keyboard interactions

On a cell, with the `navigation` and `editing` features:

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'F2'], description: 'Starts editing with the value, in the full mode.' },
		{ keys: ['A character'], description: 'Starts editing with that character in place of the value, in the quick mode.' },
		{ keys: ['Delete', 'Backspace'], description: 'Clears the selected cells.' },
	]"
/>

In an editor:

<KeyboardTable
	:data="[
		{ keys: ['Enter'], description: 'Saves and moves down, or as `enterMove` says; Shift+Enter moves up.' },
		{ keys: ['Tab', 'Shift+Tab'], description: 'Saves and moves to the next or the previous cell that can be edited, on to the next row at the end of one.' },
		{ keys: ['↑', '↓', '←', '→'], description: 'In the quick mode: save and move. In the full mode: move within the field.' },
		{ keys: ['F2'], description: 'Switches between the quick and the full mode.' },
		{ keys: ['Ctrl+Enter'], description: 'Writes the draft into every selected cell.' },
		{ keys: ['Escape'], description: 'Cancels: the cell keeps its value.' },
		{ keys: ['Alt+Enter'], description: 'In a multiline text editor: breaks the line.' },
	]"
/>

In the calendar of the date picker of the demo:

<KeyboardTable
	:data="[
		{ keys: ['↑', '↓', '←', '→'], description: 'Moves between days, across months.' },
		{ keys: ['Enter', 'Space'], description: 'Picks the day and saves it.' },
		{ keys: ['Escape'], description: 'Closes the calendar; focus goes to the field, where a second Escape cancels.' },
	]"
/>
