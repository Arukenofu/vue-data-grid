---
title: Range overlay
description: The outlines of cell ranges drawn over the body, and the fill handle that stretches them.
---

# Range overlay

<Description>
The outlines of selected cell ranges, drawn over the body, and the fill handle at the corner of the
last one that stretches it, as in a spreadsheet.
</Description>

<Demo name="part-range-overlay" />

## Features

<Highlights
	:features="[
		'One outline per range, laid out as the rows and columns under it: it follows resizing, pinning and scrolling.',
		'A range that changes renders the overlay alone, never a row.',
		'A range cut by pinned columns is still one outline, with no border where its pieces meet.',
		'The fill handle drags the last range down, up or across and fills the new cells, numbers as a series.',
		'The overlay lets the pointer through: clicks and drags reach the cells under it.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import {
	GridBody,
	GridCells,
	GridFillHandle,
	GridFillPreview,
	GridRangeOverlay,
	GridRow,
} from '@vue-data-grid/core';
</script>

<template>
	<GridBody v-slot="{ rows }">
		<GridRow v-for="row in rows" :key="row.key" :row="row">
			<GridCells />
		</GridRow>
		<GridRangeOverlay v-slot="{ corner }">
			<GridFillHandle v-if="corner" />
		</GridRangeOverlay>
		<GridFillPreview />
	</GridBody>
</template>
```

The overlay draws the ranges of the `ranges` feature; the handle and the preview need the `fill`
feature, which writes through the `editing` feature:

```ts
import { editing, fill, navigation, ranges, useDataGrid } from '@vue-data-grid/core';

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 38,
	features: {
		navigation: navigation(),
		ranges: ranges(),
		editing: editing({ onCommit: commit => (rows.value = commit.apply(rows.value)) }),
		fill: fill(),
	},
});
```

The tint of the selected cells does not come from the overlay: each cell in a range has
`aria-selected="true"`, and the structural styles tint it. Ranges that overlap never tint a cell
twice, and the focused cell, the active cell of a spreadsheet, stays clear.

## API reference

### GridRangeOverlay

For each range, a row across the grid at the rows of the range, laid out as the rows under it, with
its pieces in it: one piece for each pin side the range crosses, and cells that hold the place of the
columns around it. Put it in `GridBody` after the rows. It renders nothing without the `ranges`
feature.

<PropsTable
	:data="[
		{ name: 'as', type: 'string', default: '\'div\'', description: 'The element of each range and of each of its pieces. There is no `asChild`: the part renders many elements.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ rect: RangeRect; cell: ColumnSpanCell; corner: boolean }', description: 'Rendered inside each piece of a range. `corner` is true in the piece with the end corner of the last range, where a fill handle goes.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['range', 'range-cell'] },
		{ attribute: '[data-dg-continues]', values: ['start', 'end', 'start end'] },
		{ attribute: '[data-dg-columns]', values: 'The tokens of the columns under a piece, by which a resize reaches it.' },
		{ attribute: '[data-dg-pinned]', values: ['start', 'end'] },
	]"
/>

`range` is the row of a range, `range-cell` a piece inside it. A piece that goes on past a pin into
another piece has `data-dg-continues` on that side, where it draws no border.

### GridFillPreview

The range a fill reaches while its handle is dragged, drawn as a range is, with
`data-dg-state="fill"`: the structural styles make it dashed. Put it in `GridBody` next to the
overlay. It renders nothing without the `fill` feature, and nothing while no fill is dragged.

<PropsTable
	:data="[
		{ name: 'as', type: 'string', default: '\'div\'', description: 'The element of the range and of each of its pieces.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['range', 'range-cell'] },
		{ attribute: '[data-dg-state]', values: ['fill'] },
	]"
/>

### GridFillHandle

A small square centred on the end corner of the last range. Dragging it stretches the range and
fills the new cells when it is released. Put it in the slot of `GridRangeOverlay` where `corner` is
true. It renders nothing without the `fill` feature, and nothing while a cell is being edited, whose
editor it would cover.

<PropsTable
	:data="[
		{ name: 'as', type: 'string | Component', default: '\'span\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', description: 'Content inside the square, if any.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['fill-handle'] },
		{ attribute: '[data-dg-state]', values: ['dragging', 'idle'] },
	]"
/>

<CssVariablesTable
	:data="[
		{ name: '--dg-range-background', default: 'color-mix(in srgb, Highlight 12%, transparent)', description: 'The tint of a cell in a range; translucent, so the cell shows through.' },
		{ name: '--dg-range-border', default: '1px solid Highlight', description: 'The outline of a range.' },
		{ name: '--dg-fill-handle-color', default: 'Highlight', description: 'The colour of the fill handle.' },
		{ name: '--dg-fill-handle-size', default: '8px', description: 'Its size.' },
	]"
/>

## Examples

### A status bar of the selection

`getCells()` of the ranges lists the selected cells by row key and column name, each once. The demo
adds up the months under them:

```ts
const selected = computed(() => {
	const lines = new Map(rows.value.map(line => [line.id, line]));
	let sum = 0;
	let count = 0;

	for (const cell of grid.ranges.getCells()) {
		const line = lines.get(cell.key);

		if (line && isMonth(cell.column)) {
			sum += line.months[cell.column];
			count += 1;
		}
	}

	return { sum, count };
});
```

### Series or copies

A fill continues numbers as a series, `100, 200` going on `300, 400`, and repeats everything else.
Hold <kbd>Ctrl</kbd> while dragging for the other way, or make copies the default:

```ts
fill({ series: false })
```

## Accessibility

- The overlay is `aria-hidden`: a range is a drawing. Assistive technology hears the selection from
  `aria-selected` on each cell, which the grid writes as ranges change, and from
  `aria-multiselectable` on the grid.
- The fill handle is `aria-hidden` too: the keyboard fills with <kbd>Ctrl</kbd>+<kbd>D</kbd> and
  <kbd>Ctrl</kbd>+<kbd>R</kbd> instead, so a fill never needs a pointer.
- Selecting with the keyboard keeps the focused cell where the range started, as the active cell of a
  spreadsheet does, and scrolls the other corner into view.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Shift+↑', 'Shift+↓', 'Shift+←', 'Shift+→'], description: 'Extends the range from the focused cell.' },
		{ keys: ['Ctrl+Shift+↓', 'Ctrl+Shift+→'], description: 'Extends the range to the edge of the grid in that direction.' },
		{ keys: ['Ctrl+A'], description: 'Selects every cell.' },
		{ keys: ['Ctrl+Space'], description: 'Selects the whole columns of the range.' },
		{ keys: ['Escape'], description: 'Collapses the ranges to the focused cell.' },
		{ keys: ['Ctrl+D'], description: 'Fills the range down from its first row.' },
		{ keys: ['Ctrl+R'], description: 'Fills the range right from its first column.' },
		{ keys: ['Ctrl+C', 'Ctrl+X', 'Ctrl+V'], description: 'Copies, cuts or pastes the last range, with the `clipboard` feature.' },
	]"
/>

With the pointer: a press selects a cell, <kbd>Shift</kbd> extends the last range to it, and
<kbd>Ctrl</kbd> adds a range, or takes cells out of the selection when the cell is selected. On macOS
<kbd>⌘</kbd> stands for <kbd>Ctrl</kbd>.
