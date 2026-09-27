---
title: useClipboard
description: Copy, cut and paste of a table the way a spreadsheet does it, and CSV files with downloadCsv.
---

# useClipboard

<Description>
The clipboard of a table, the way a spreadsheet does it: Ctrl+C copies the last range as
tab-separated text, and with editing Ctrl+X cuts and Ctrl+V pastes rows of cells over the selection.
`downloadCsv` saves the same data as a file.
</Description>

<Demo name="api-use-clipboard" />

Select cells and press <kbd>Ctrl</kbd>+<kbd>C</kbd>, or the button. Paste the text into a
spreadsheet, or copy cells from a spreadsheet and paste them into the table: the numbers land in
their columns through each column's `parse`.

## Usage

```ts
import { clipboard, editing, navigation, ranges, useDataTable } from '@vue-stack/table';

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 36,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		editing: editing({
			onCommit: (commit) => {
				rows.value = commit.apply(rows.value);
			},
		}),
		clipboard: clipboard({ headers: false }),
	},
});
```

The feature is the one owner of the `copy`, `cut` and `paste` events of the table element. Without
`editing` the table only copies. Without `ranges` it copies the focused cell.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'headers', type: 'MaybeRefOrGetter<boolean>', default: 'false', description: 'Start the copied text with a line of column headers.' },
		{ name: 'focus', type: 'BodyCellFocus', description: 'Focus of the body cells, whose cell is copied when there is no range; the navigation\'s by default.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'true' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'copy', type: '() => Promise<boolean>', description: 'Copies through `navigator.clipboard`, such as from a button. `false` when there was nothing to copy or the browser refused.' },
		{ name: 'getText', type: '() => string', description: 'What a copy puts on the clipboard now: the last range, else the focused cell; `\'\'` for nothing. Reactive, so a preview can show it.' },
	]"
/>

## downloadCsv

`downloadCsv(csv, options?)` saves text as a `.csv` file through a download link. It starts the file
with a byte order mark, so Excel reads UTF-8 correctly. Make the text with `toCsv` of the core:

```ts
import { downloadCsv, toCsv } from '@vue-stack/table';

function download() {
	const columns = table.scope.columns.value.flatMap(item => (item.column ? [item.column] : []));

	downloadCsv(toCsv({ columns, rows: table.rows.value }), { name: 'orders' });
}
```

<PropsTable
	label="Option"
	:data="[
		{ name: 'name', type: 'string', default: '\'table\'', description: 'The file name; `.csv` is added when it is not there.' },
	]"
/>

`toCsv` reads each cell through its column's `format`, skips service columns, quotes what needs
quoting and, by default, guards text a spreadsheet would run as a formula with a leading `'`.

## Examples

### What a copy takes

- Values go through each column's `format`, the text the cell shows, so a pasted price reads as it
  looked.
- Only the last range is copied: a spreadsheet cannot paste several at once.
- Service columns, such as the checkbox column, are left out.

### What a paste does

A paste writes rows of tab-separated text over the last range, or from the focused cell, as a
spreadsheet lays them, and selects the cells it wrote. Each value goes through its column's `parse`
and `validate`; cells that cannot be edited are skipped. The whole paste is one commit, one step to
undo.

### Leaving the clipboard to the browser

Inside a text field, an open editor included, and with text selected in the table, the clipboard is
the browser's. So a person can still copy a word out of a cell.

## Accessibility

- The clipboard works from the keyboard alone, from any focused cell, with the shortcuts people
  know from spreadsheets.
- `copy()` for a button uses the async clipboard API, which browsers allow from a click; the
  keyboard shortcuts need no permission at all.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Ctrl+C'], description: 'Copies the last range, or the focused cell.' },
		{ keys: ['Ctrl+X'], description: 'Copies and clears the cells, with `editing`.' },
		{ keys: ['Ctrl+V'], description: 'Pastes over the selection, with `editing`.' },
	]"
/>

On macOS <kbd>⌘</kbd> works wherever <kbd>Ctrl</kbd> does, and Copy, Cut and Paste of the browser's
menu do the same.

## See also

- [Cell ranges and clipboard](/guides/cell-ranges): the guide.
- [useTableEditing](/composables/use-table-editing): what a paste writes through.
- [The core](/composables/core): `toCsv`, `parseDelimited` and `resolvePaste`.
