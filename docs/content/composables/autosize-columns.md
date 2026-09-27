---
title: autosizeColumns
description: Fits columns to their content in one layout write, from the rendered cells or from the text of every row.
---

# autosizeColumns

<Description>
Fits columns to their content in one layout write. It measures the cells the table has rendered,
or, when you ask for it, the text of every row, and gives each column the width of its widest cell.
</Description>

<Demo name="api-autosize-columns" />

The columns start narrow on purpose. **Fit rendered rows** measures the rows in view; **Fit all 400
rows** also measures the text of the rows the row window left out, so a long name far down the list
gets its room too. The widths animate because the table has `useTableMotion`.

## Usage

```ts
import { autosizeColumns } from '@vue-stack/table';

autosizeColumns(table.scope);
autosizeColumns(table.scope, ['name', 'email']);
autosizeColumns(table.scope, undefined, { rows: 'all' });
```

Without `names`, every shown `resizable` data column is fitted, and service columns
(`kind: 'service'`) keep their width. Named columns are measured whatever their kind. A column that
is not `resizable` is skipped, and so is a column outside the column window: it has no cells to
measure. The widths are written to the layout in one write, as a resize would write them, so they are
kept, persisted and reset like any other width.

`TableResizeHandle` calls it on a double click, for the column of the handle.

## Arguments

<PropsTable
	label="Argument"
	:data="[
		{ name: 'scope', type: 'TableScope', required: true, description: 'The scope of the table, `table.scope`.' },
		{ name: 'names', type: 'readonly string[]', description: 'The columns to fit; every shown `resizable` data column without it.' },
		{ name: 'options', type: 'AutosizeOptions', description: 'How to measure, below.' },
	]"
/>

<PropsTable
	label="Option"
	:data="[
		{ name: 'rows', type: '\'rendered\' | \'all\'', default: '\'rendered\'', description: '`all` also covers rows outside the row window, by measuring their `format` text in the font of a body cell. Right only while `format` returns exactly what the cell shows.' },
		{ name: 'bodyAttribute', type: 'string', default: '\'data-tc-index\'', description: 'The attribute of body rows, the engine\'s `indexAttribute`.' },
		{ name: 'measureText', type: '(text: string, font: string) => number | null', default: 'a canvas', description: 'The width of a text in a font, px.' },
	]"
/>

## Returns

`readonly string[]`: the names of the columns it measured and set. Empty when there was nothing to
measure, or when every width stayed as it was.

## measureColumnsContent

What `autosizeColumns` measures with: the content widths of columns from their rendered header,
body and footer cells, as a `Map` by name, without writing anything.

```ts
import { measureColumnsContent } from '@vue-stack/table';

const widths = measureColumnsContent(table.root.value, ['name', 'email']);

widths.get('email');
```

Each cell is measured through a copy placed next to it: the same ancestors, so the same CSS, but out
of the flow and without a set width. All copies are inserted, read in one layout pass and removed in
the same task, so the page never shows them and the browser lays out once.

<PropsTable
	label="Option"
	:data="[
		{ name: 'texts', type: 'ReadonlyMap<string, readonly string[]>', description: 'Cell texts by column, to cover rows that are not rendered. Each text is measured in the font of a body cell, plus what the cell takes beyond its text.' },
		{ name: 'bodyAttribute', type: 'string', default: '\'data-tc-index\'', description: 'The attribute of body rows: a cell inside such a row is a body cell.' },
		{ name: 'measureText', type: '(text: string, font: string) => number | null', default: 'a canvas', description: 'The width of a text in a font, px; `null` when it cannot be measured.' },
	]"
/>

## Examples

### Fit once the data arrives

Measure after the rows are in the DOM, such as after a fetch, on the next tick:

```ts
watch(rows, async () => {
	await nextTick();
	autosizeColumns(table.scope);
}, { once: true });
```

### A button in a column menu

```ts
function fitColumn(name: string) {
	autosizeColumns(table.scope, [name], { rows: 'all' });
}
```

### Measuring text another way

Pass `measureText` to measure with something other than a canvas, such as a font metrics table on
the server, or a test double in unit tests:

```ts
autosizeColumns(table.scope, undefined, { rows: 'all', measureText: text => text.length * 7 });
```

## Accessibility

- The widths go through the layout, so a resize handle's `aria-valuenow` reports the new width, and
  the next resize from the keyboard goes on from it.
- Fitting sizes a column to what its cells hold, within its `minWidth` and `maxWidth`, so text that
  was cut with an ellipsis becomes readable whole, by sight and by the screen reader's cursor alike.
- The double click on a resize handle has a keyboard counterpart in the handle's own keys:
  <kbd>←</kbd> and <kbd>→</kbd> change the width, <kbd>Home</kbd> and <kbd>End</kbd> take it to its
  limits.

## See also

- [useColumnResize](/composables/use-column-resize): the handle that calls it on a double click.
- [Column layout](/guides/column-layout): widths, fitting and keeping the layout.
- [useTableMotion](/composables/use-table-motion): animating the change of widths.
