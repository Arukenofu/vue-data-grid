---
title: Spreadsheet
description: A small spreadsheet with cell ranges, editing, a fill handle, copy and paste from Excel, and undo and redo.
pageClass: site-wide
aside: false
---

# Spreadsheet

<Description>
A quarterly budget as a spreadsheet: select ranges with the mouse or the keyboard, type over a cell,
drag the fill handle, paste straight from Excel or Google Sheets, and undo any of it. The formula bar
shows the active cell, and the status bar adds up the selection.
</Description>

<Demo name="example-spreadsheet" />

## What it shows

- **Cell ranges** with the `ranges` feature: click and drag, <kbd>Shift</kbd> to extend,
  <kbd>Ctrl</kbd> to add a second range or cut cells out of one. See
  [Cell ranges and clipboard](/guides/cell-ranges).
- **Editing** with the `editing` feature: type over a cell to replace it, or press <kbd>Enter</kbd>
  to change it; numbers, a list and a checkbox each get the editor they need. See
  [Editing](/guides/editing).
- **Undo and redo** with the `history` feature: every commit is one step, a whole paste or fill
  included.
- **A fill handle** with the `fill` feature: drag the square at the corner of the range to continue
  it; `100, 150` goes on as `200, 250`, and anything else repeats.
- **The clipboard** with the `clipboard` feature: copy a range as tab-separated text, cut it, and
  paste rows of text over the selection as a spreadsheet lays them.
- **A row header** with `rowNumberColumn({ rowHeader: true })`: the number names each row for screen
  readers, as a spreadsheet's row number does.

## How it works

### Six features, one grid

Each capability is a feature of `useDataGrid`. They are built in order, each on what the ones
before it give: the ranges read the navigation's focused cell, editing writes over the ranges, the
history records editing's commits, the fill writes through editing, and the clipboard pastes
through it.

```ts
const grid = useDataGrid({
	columns,
	rows: lines,
	rowKey: 'id',
	rowHeight: 34,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		editing: editing({
			onCommit: (commit) => {
				lines.value = commit.apply(lines.value);
			},
		}),
		history: history(),
		fill: fill(),
		clipboard: clipboard(),
	},
});
```

`onCommit` is the one place where data changes. A commit carries the edited cells and the new rows;
`commit.apply` swaps them into your array and returns a new one, so the rows stay immutable and only
the changed rows render again. A feature that needs another, such as `fill` without `ranges`, does
not compile.

### Columns that know how to be edited

`editable` lets a column be edited, and `setValue` returns the row with the new value, as a new
object. `numberField()` brings the number editor and a `parse` that reads pasted text as a number;
`validate` refuses what is not one, and the editor stays open with the error until it is fixed.

```ts
function quarter(name: Quarter, label: string) {
	return column(line => line[name], {
		label,
		align: 'right',
		...numberField<BudgetLine>({ step: 50 }),
		cell: ({ value }) => formatAmount(value),
		validate: value => (value !== null && Number.isNaN(value) ? 'Type a number' : undefined),
		setValue: (line, value) => ({ ...line, [name]: value }),
	});
}
```

The cell shows `12,500` through `cell`, while `format` stays the plain `12500`. Copying uses
`format`, so what you copy pastes back as the same number, here or in Excel.

The category takes a `selectEditor`, a list you can type into to filter; the approval column spreads
`checkboxField()`, whose checkbox writes a click at once, with no editor to open. The total has no
`editable` at all: it follows the quarters.

### The formula bar and the status bar

Both are plain `computed`s over the features' state. The focused cell comes from the navigation, the
draft from editing, and the selected cells from the ranges:

```ts
const selected = computed(() => {
	const values = grid.ranges.getCells().map((cell) => {
		const line = grid.rows.value[grid.scope.getRowIndex(cell.key)];
		const rendered = grid.scope.getColumn(cell.column)?.column;

		return line && rendered ? rendered.value(line) : undefined;
	});

	return {
		cells: values.length,
		numbers: values.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value)),
	};
});
```

Cells are addressed by row key and column name, so a range, a step of the history or a copied
block stays on the same data while rows move.

### The toolbar

The buttons call the same handles the keys do: `grid.history.undo()`, `grid.fill.fillDown()`,
`grid.clipboard.copy()`. The CSV download is two utilities: `toCsv` writes the rows through each
column's `format`, and `downloadCsv` saves the text as a file Excel opens as UTF-8.

## Accessibility

- The grid has the `grid` role and `aria-multiselectable`, and every cell in a range has
  `aria-selected="true"`, so a screen reader hears which cells are selected. The outline drawn over
  a range is hidden from it.
- The row number column is a `rowheader`: moving across a row, a screen reader says which row the
  cell is in.
- An editor is a real input, labelled by its column, with `aria-invalid` and the error linked by
  `aria-describedby` while the value is wrong. The number editor is a `spinbutton` with its limits.
- Everything the mouse does has keys: the fill handle is `aria-hidden`, since <kbd>Ctrl</kbd>+<kbd>D</kbd>
  and <kbd>Ctrl</kbd>+<kbd>R</kbd> fill without it.
- The status bar is a polite live region: the sum of a new selection is read out after the move.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['↑', '↓', '←', '→'], description: 'Moves the active cell and collapses the selection to it.' },
		{ keys: ['Shift+↑', 'Shift+↓', 'Shift+←', 'Shift+→'], description: 'Extends the selection from the active cell.' },
		{ keys: ['Ctrl+Shift+↓'], description: 'Extends the selection to the edge of the data, in any direction.' },
		{ keys: ['Ctrl+A'], description: 'Selects every cell.' },
		{ keys: ['Ctrl+Space'], description: 'Selects the whole column of the active cell.' },
		{ keys: ['Enter', 'F2'], description: 'Edits the active cell; the arrows then move the caret.' },
		{ keys: ['A letter or digit'], description: 'Replaces the cell with what you type; the arrows save and move on.' },
		{ keys: ['Enter', 'Tab'], description: 'In an editor, saves and moves down or right; with Shift, up or left.' },
		{ keys: ['Ctrl+Enter'], description: 'In an editor, writes the value into every selected cell.' },
		{ keys: ['Escape'], description: 'Cancels the edit, or collapses the selection to the active cell.' },
		{ keys: ['Delete', 'Backspace'], description: 'Clears the selected cells.' },
		{ keys: ['Ctrl+C', 'Ctrl+X', 'Ctrl+V'], description: 'Copies, cuts or pastes the selection as tab-separated text.' },
		{ keys: ['Ctrl+D', 'Ctrl+R'], description: 'Fills the selection down from its first row, or right from its first column.' },
		{ keys: ['Ctrl+Z'], description: 'Undoes the last change.' },
		{ keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], description: 'Redoes it.' },
		{ keys: ['Space'], description: 'On an approval cell, ticks or unticks it.' },
	]"
/>

On a Mac, <kbd>⌘</kbd> works wherever <kbd>Ctrl</kbd> does.
