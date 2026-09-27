---
title: useRangeSelection
description: The gestures of cell ranges — press and drag, Shift and Ctrl clicks, Shift with the arrows, as in a spreadsheet.
---

# useRangeSelection

<Description>
The gestures of cell ranges, as in a spreadsheet: press and drag across cells, Shift to extend,
Ctrl to add a range or take cells out, Shift with the arrows from the keyboard. The table scrolls
while a drag nears its edges.
</Description>

<Demo name="api-use-clipboard" />

Drag across cells to select a range, hold <kbd>Shift</kbd> to extend it, <kbd>Ctrl</kbd> to add
another. The box under the table shows what a copy would take.

## Usage

The `ranges` feature is `useCellRanges` of the core with these gestures on top. It is all most
tables need:

```ts
import { navigation, ranges, useDataTable } from '@vue-stack/table';

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 36,
	features: {
		navigation: navigation(),
		ranges: ranges(),
	},
});
```

```vue
<TableBody v-slot="{ rows }">
	<TableRow v-for="row in rows" :key="row.key" :row="row">
		<TableCells />
	</TableRow>
	<TableRangeOverlay />
</TableBody>
```

Call it yourself to put the gestures over a model of your own, or over a table of your own markup:

```ts
import { useCellRanges, useRangeSelection } from '@vue-stack/table';

const cellRanges = useCellRanges(table.scope, { corners: 'index' });

useRangeSelection(table, { ranges: cellRanges, focus: table.navigation?.cells });
```

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'ranges', type: 'CellRanges', required: true, description: 'The ranges the gestures change: `useCellRanges()`.' },
		{ name: 'focus', type: 'BodyCellFocus', description: 'Focus of the body cells, `cells` of the grid navigation. A press focuses its cell, and focus moved by a key collapses the ranges to it, as the active cell of a spreadsheet does. Without it the table element takes focus on a press.' },
		{ name: 'autoScroll', type: 'AutoScrollOptions | false', description: 'How the table scrolls while a drag is near its edges; the sticky header, footer and pinned columns are its margins by default. `false` turns it off.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'true' },
	]"
/>

The table it takes is anything with `scope`, `root` and `body`, and the heights of the sticky header
and footer when there are any: the table of `useDataTable` fits.

## Returns

<ReturnsTable
	:data="[
		{ name: 'dragging', type: 'Readonly<Ref<boolean>>', description: 'Whether a drag is selecting cells now.' },
	]"
/>

The ranges themselves are on the model: `table.ranges.selectedRanges`, `bounds`, `rects`,
`isSelected`, `getText`, `select`, `selectBounds`, `selectAll` and `clear`.

## Examples

### Ranges that stay on their rows

By default a corner of a range holds on to its row by key, so a range stays on the same rows when
the table is sorted or new rows stream in. With `corners: 'index'` it stays in its place on screen
instead, as in a spreadsheet whose rows are fixed.

```ts
features: { ranges: ranges({ corners: 'index' }) }
```

### Selecting from code

```ts
table.ranges.selectBounds({ rowStart: 0, rowEnd: 5, columnStart: 1, columnEnd: 3 });
table.ranges.selectAll();
table.ranges.clear();
```

### Dragging rows and selecting cells

A row dragged as a whole takes the press on its cells, so a drag there moves the row rather than
selecting cells; in development a warning says so once. Drag rows by a handle, `handle: true` on the
row drag, and both gestures work side by side.

## Accessibility

- A cell in a range gets `aria-selected="true"`, and the table `aria-multiselectable`: a screen
  reader hears the cells as selected. The drawn outline is hidden from it.
- `aria-selected` is written to the cells of a row as the ranges change, without rendering the row,
  so a range that grows over a hundred rows stays smooth.
- The focused cell stays where the range started, as the active cell of a spreadsheet does, and the
  keys move the other corner, scrolled into view.
- The keys are taken on the cells before the navigation's, so the arrows without Shift still move
  focus. Presses on controls inside cells, a drag handle or an open editor are left to them.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Shift+↑', 'Shift+↓', 'Shift+←', 'Shift+→'], description: 'Extends the range by one cell.' },
		{ keys: ['Shift+Home', 'Shift+End'], description: 'Extends the range to the start or the end of the row.' },
		{ keys: ['Shift+PageUp', 'Shift+PageDown'], description: 'Extends the range by as many rows as fit in view.' },
		{ keys: ['Ctrl+Shift+↑', 'Ctrl+Shift+↓'], description: 'Extends the range to the first or the last row.' },
		{ keys: ['Ctrl+A'], description: 'Selects every cell.' },
		{ keys: ['Ctrl+Space'], description: 'Selects the whole columns of the range, or of the focused cell.' },
		{ keys: ['Escape'], description: 'Collapses the ranges to the focused cell.' },
	]"
/>

With the pointer: a press selects a cell, <kbd>Shift</kbd> and a press extend the last range to it,
and <kbd>Ctrl</kbd> or <kbd>⌘</kbd> and a press add a new range, or take the cell out when it is
selected, as in Excel.

## See also

- [Cell ranges and clipboard](/guides/cell-ranges): the guide.
- [Range overlay](/components/range-overlay): the part that draws the ranges.
- [useCellDrag](/composables/use-cell-drag): the drag across cells under these gestures.
