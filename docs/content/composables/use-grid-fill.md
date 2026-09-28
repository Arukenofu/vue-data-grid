---
title: useGridFill
description: The fill handle of a spreadsheet — drag the corner of a range to continue its numbers or repeat its values, or fill with Ctrl+D and Ctrl+R.
---

# useGridFill

<Description>
The fill handle of a spreadsheet: drag the square at the corner of the last range down, up or
across, and the new cells continue its numbers as a series or repeat its values. Ctrl+D and Ctrl+R
fill without a pointer.
</Description>

<Demo name="api-use-grid-fill" />

The first two months of each channel are selected. Drag the handle to June: each row goes on with
its own trend. Hold <kbd>Ctrl</kbd> while dragging, or turn the switch off, to repeat the values
instead.

## Usage

```ts
import { editing, fill, navigation, ranges, useDataGrid } from '@vue-data-grid/core';

const grid = useDataGrid({
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
		fill: fill(),
	},
});
```

Put the handle where the overlay says the corner is, and the preview next to it:

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

`fill` needs `ranges` and `editing`: a grid without them does not compile, and `useGridFill`
throws when called by hand.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'series', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Continue numbers as a series, `1, 2` going on `3, 4`, rather than repeat them. Holding Ctrl or ⌘ during a drag does the other.' },
		{ name: 'autoScroll', type: 'AutoScrollOptions | false', description: 'How the grid scrolls while the handle is near its edges.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'true' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'preview', type: 'ComputedRef<RangeRect | null>', description: 'The range being filled while the handle is dragged past the last range, to draw; `GridFillPreview` draws it.' },
		{ name: 'dragging', type: 'Readonly<Ref<boolean>>', description: 'Whether the handle is being dragged.' },
		{ name: 'start', type: '(event: PointerEvent) => void', description: 'Starts dragging the handle from a press on it; `GridFillHandle` calls it.' },
		{ name: 'fill', type: '(from: RangeBounds, to: RangeBounds, request?: { series? }) => CellWriteResult | null', description: 'Fills the cells of `to` outside `from` from the values of `from`, and selects `to`.' },
		{ name: 'fillDown', type: '() => CellWriteResult | null', description: 'Fills the last range down from its first row with copies, as Ctrl+D does.' },
		{ name: 'fillRight', type: '() => CellWriteResult | null', description: 'Fills the last range right from its first column with copies, as Ctrl+R does.' },
	]"
/>

## Examples

### How values continue

Each line along the fill continues its own values: each column for a fill down, each row for a fill
across.

| Selected | Filled with a series | Filled with copies |
| --- | --- | --- |
| `1`, `2` | `3`, `4`, `5` | `1`, `2`, `1` |
| `10`, `20`, `40` | the trend by least squares | `10`, `20`, `40` |
| `5` | `5`, `5`, `5` | `5`, `5`, `5` |
| `Draft`, `Final` | `Draft`, `Final`, `Draft` | `Draft`, `Final`, `Draft` |

A single number and anything that is not a number repeat either way. A fill up or left runs the
values backwards.

### One step to undo

A fill is one commit with the source `fill`: one step of the history, one call of `onCommit`. It
writes through the editing, so cells that cannot be edited are skipped and each value is checked by
its column's `validate`.

### Rows that change under a drag

Rows that come or go while the handle is dragged cancel the fill: the cells it points at are no
longer the ones the person sees.

## Accessibility

- The handle is hidden from screen readers, `aria-hidden`: it is a pointer gesture, and the keys do
  the same without it.
- The filled range is selected afterwards, so `aria-selected` tells what the fill wrote.
- The handle is not shown while a cell is being edited, whose editor it would cover.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Ctrl+D'], description: 'Fills the last range down from its first row.' },
		{ keys: ['Ctrl+R'], description: 'Fills the last range right from its first column.' },
	]"
/>

## See also

- [Range overlay](/components/range-overlay): `GridFillHandle` and `GridFillPreview`.
- [Cell ranges and clipboard](/guides/cell-ranges) and [Editing](/guides/editing).
- [useCellDrag](/composables/use-cell-drag): the drag under the handle.
