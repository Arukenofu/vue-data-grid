---
title: Cell ranges and clipboard
description: Select rectangles of cells with the pointer and the keys, sum them, copy them to a spreadsheet and export CSV.
---

# Cell ranges and clipboard

<Description>
Select rectangles of cells the way a spreadsheet does, read what is in them, copy them to Excel or
Google Sheets, and export the whole table as CSV.
</Description>

<Demo name="cell-ranges" />

Drag across the numbers and watch the sum under the table. <kbd>Shift</kbd>+click extends the range,
<kbd>Ctrl</kbd>+click adds another one, and <kbd>Shift</kbd> with the arrow keys grows it from the
keyboard. <kbd>Ctrl</kbd>+<kbd>C</kbd> copies the last range as text a spreadsheet pastes into cells.

## Turn it on

Cell ranges are the `ranges` feature. It works best with `navigation`, which gives the ranges a
focused cell to start from, as the active cell of a spreadsheet:

```ts
import { navigation, ranges, useDataTable } from '@vue-data-grid/core';

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation(),
		ranges: ranges(),
	},
});
```

Then draw the ranges: put a `TableRangeOverlay` in the body, after the rows.

```vue
<TableBody v-slot="{ rows }">
	<TableRow v-for="row in rows" :key="row.key" :row="row">
		<TableCells />
	</TableRow>
	<TableRangeOverlay />
</TableBody>
```

The overlay draws an outline around each range, and the structural styles tint the cells inside it.
Selecting more cells re-renders the overlay and nothing else: not the rows, not the cells.

## Gestures

Everything a spreadsheet user reaches for works:

- **Click** a cell to select it. **Drag** to select the cells between, and the table scrolls when
  the pointer nears an edge, the sticky header and pinned columns included.
- **Shift+click** extends the last range to the cell. **Ctrl+click** (<kbd>⌘</kbd> on macOS) starts
  another range; on a selected cell it takes that cell out of the selection instead, as Excel does.
- **Shift with the arrows**, <kbd>Home</kbd>, <kbd>End</kbd>, <kbd>PageUp</kbd> and
  <kbd>PageDown</kbd> extend the range from the focused cell; add <kbd>Ctrl</kbd> to jump to the
  edge of the data.
- <kbd>Ctrl</kbd>+<kbd>A</kbd> selects every cell, <kbd>Ctrl</kbd>+<kbd>Space</kbd> the whole
  columns of the last range, and <kbd>Escape</kbd> collapses the selection to the focused cell.

The focused cell stays where the range started while <kbd>Shift</kbd> moves the other corner, and an
arrow without <kbd>Shift</kbd> collapses the selection to the cell it moves to.

## Reading the selection

`table.ranges` holds the selection and everything computed from it. The most useful pieces:

<ReturnsTable
	:data="[
		{ name: 'getCells()', type: 'CellAddress[]', description: 'Every selected cell once, as a row key and a column name: what to sum, count or send to a server.' },
		{ name: 'getText(options?)', type: 'string', description: 'The last range as tab-separated text, each value through its column\'s `format`; `{ headers: true }` adds a line of labels.' },
		{ name: 'selectedRanges', type: 'ComputedRef<readonly CellRange[]>', description: 'The ranges as the model holds them: two corners each.' },
		{ name: 'bounds', type: 'ComputedRef<readonly RangeBounds[]>', description: 'Each range as indexes of rows and columns, half-open.' },
		{ name: 'rects', type: 'ComputedRef<readonly RangeRect[]>', description: 'Each range as a rectangle to draw over the body; what `TableRangeOverlay` renders.' },
		{ name: 'isSelected(cell)', type: 'boolean', description: 'Whether a cell is in any range. Reactive per row: only the rows whose cells change wake up.' },
		{ name: 'selectAll()', type: 'void', description: 'Selects every cell, and keeps every row selected through sorting and new rows.' },
		{ name: 'selectBounds(bounds)', type: 'void', description: 'Replaces the selection with one range, such as the cells a paste wrote.' },
		{ name: 'clear()', type: 'void', description: 'Selects nothing.' },
	]"
/>

The status bar of the demo sums the selected numbers, whatever columns they are in, by reading each
cell through its column:

```ts
const summary = computed(() => {
	const cells = table.ranges.getCells();
	const numbers = cells.flatMap((cell) => {
		const row = table.rows.value[table.scope.getRowIndex(cell.key)];
		const value = row === undefined ? undefined : table.scope.getColumn(cell.column)?.column?.value(row);

		return typeof value === 'number' ? [value] : [];
	});

	return { cells: cells.length, sum: numbers.reduce((total, value) => total + value, 0) };
});
```

### Options

`ranges()` takes these options:

<PropsTable
	label="Option"
	:data="[
		{ name: 'ranges', type: 'Ref<readonly CellRange[]>', description: 'A model of your own, for `v-model` or to keep the selection in a store; without it the table keeps its own.' },
		{ name: 'canSelectColumn', type: '(column: RuntimeColumn) => boolean', description: 'Which columns ranges can span; the data columns by default, so a checkbox or row number column stays out.' },
		{ name: 'corners', type: '\'key\' | \'index\'', default: '\'key\'', description: 'What the corners of a range hold on to: the rows by key, so a range stays on its rows through a sort, or the places on screen by index. Read once.' },
		{ name: 'autoScroll', type: 'AutoScrollOptions | false', description: 'How the table scrolls while a drag nears its edges; `false` turns it off.' },
		{ name: 'focus', type: 'BodyCellFocus', description: 'The focused cell ranges start from; the `navigation` of the table by default.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Turn the gestures off for a while.' },
	]"
/>

## Copy and paste

The `clipboard` feature owns the `copy`, `cut` and `paste` events of the table:

```ts
import { clipboard, navigation, ranges, useDataTable } from '@vue-data-grid/core';

const withHeaders = shallowRef(false);

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		clipboard: clipboard({ headers: withHeaders }),
	},
});
```

<kbd>Ctrl</kbd>+<kbd>C</kbd>, or Copy in the browser's menu, puts the last range on the clipboard as
tab-separated text, each value through its column's `format`: exactly what a spreadsheet pastes
back into separate cells. Without a range, the focused cell is copied. The events need no
permission from the browser.

A button cannot fire a copy event, so the handle has `copy()`, which goes through
`navigator.clipboard` and resolves to `false` when there was nothing to copy or the browser refused:

```ts
async function copy() {
	const copied = await table.clipboard.copy();

	status.value = copied ? 'Copied' : 'Select some cells first';
}
```

With the [`editing`](/guides/editing) feature the same shortcuts cut and paste as well:
<kbd>Ctrl</kbd>+<kbd>X</kbd> clears the cells it copied, and <kbd>Ctrl</kbd>+<kbd>V</kbd> lays the
rows of the clipboard over the selection, as a spreadsheet does. Text fields inside cells, an open
editor among them, keep the clipboard to themselves.

## Export to CSV

`toCsv` turns rows into CSV through the columns, and `downloadCsv` saves it as a file, with the byte
order mark Excel needs to read UTF-8:

```ts
import { downloadCsv, toCsv } from '@vue-data-grid/core';

function download() {
	const shown = table.scope.columns.value.flatMap(item => (item.column ? [item.column] : []));

	downloadCsv(toCsv({ columns: shown, rows: table.rows.value }), { name: 'budget' });
}
```

Pass `scope.columns` for the columns as the user sees them, in their order, without the hidden ones.
Service columns, such as a checkbox column, are left out. Text that a spreadsheet would run as a
formula, starting with `=`, `+`, `-` or `@`, is prefixed with `'` unless you pass
`escapeFormulas: false`.

## Accessibility

- The grid gets `aria-multiselectable="true"`, and every cell a range can reach gets
  `aria-selected`, so a screen reader says "selected" as focus moves over the range. `TableCells`
  writes the attribute straight to the cells as the ranges change, without rendering them.
- The overlay is decoration: it is `aria-hidden`, and the pointer passes through it.
- Every gesture has a keyboard equivalent, and the focused cell stays visible with its own outline
  inside a range, as the active cell of a spreadsheet.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Shift+↑', 'Shift+↓', 'Shift+←', 'Shift+→'], description: 'Extends the range from the focused cell by one cell.' },
		{ keys: ['Ctrl+Shift+↓', 'Ctrl+Shift+→'], description: 'Extends the range to the edge of the data, in any direction.' },
		{ keys: ['Shift+Home', 'Shift+End'], description: 'Extends the range to the start or the end of the row.' },
		{ keys: ['Shift+PageUp', 'Shift+PageDown'], description: 'Extends the range by as many rows as fit in view.' },
		{ keys: ['Ctrl+A', '⌘+A'], description: 'Selects every cell.' },
		{ keys: ['Ctrl+Space', '⌘+Space'], description: 'Selects the whole columns of the last range.' },
		{ keys: ['Escape'], description: 'Collapses the selection to the focused cell.' },
		{ keys: ['Ctrl+C', '⌘+C'], description: 'Copies the last range, or the focused cell, with the `clipboard` feature.' },
		{ keys: ['Ctrl+X', '⌘+X'], description: 'Cuts: copies and clears the cells, with `clipboard` and `editing`.' },
		{ keys: ['Ctrl+V', '⌘+V'], description: 'Pastes over the selection, with `clipboard` and `editing`.' },
	]"
/>

## See also

- [Editing](/guides/editing): typing into cells, pasting, the fill handle and undo.
- [Range overlay](/components/range-overlay): the part that draws the ranges.
- [`useRangeSelection`](/composables/use-range-selection) and [`useClipboard`](/composables/use-clipboard):
  the gestures and the clipboard for markup of your own.
- [Spreadsheet](/examples/spreadsheet): ranges, editing and the clipboard together.
