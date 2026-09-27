---
title: useGridNavigation
description: Keyboard navigation of the WAI-ARIA grid — arrows, pages, edges, into and out of cell content, with focus held by row key.
---

# useGridNavigation

<Description>
The keys of the WAI-ARIA grid: arrows, Home and End, pages, the edges with Ctrl, into the content
of a cell and back. Focus holds on to its row by key, stays rendered under the row window and comes
out from under sticky headers and pinned columns.
</Description>

<Demo name="api-use-grid-navigation" />

Click into the table or Tab to it, then move with the arrows. <kbd>Enter</kbd> on a cell with one
button presses it; on a cell with several it moves focus into them, and <kbd>Escape</kbd> brings it
back. <kbd>Shift</kbd>+<kbd>Space</kbd> selects the row. The buttons above focus a cell from code.

## Usage

In a table of `useDataTable`, add the `navigation` feature. It passes the table's element, sections,
sticky blocks, tree and selection for you:

```ts
import { navigation, useDataTable } from '@vue-data-grid/core';

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: { navigation: navigation({ onSpace: position => open(position) }) },
});

table.navigation.focusCell({ section: 'body', row: 0, cell: 'name' });
```

On markup of your own, call it with the scope of the engine and the elements:

```ts
import { useGridNavigation, useTableProps } from '@vue-data-grid/core';

const props = useTableProps(scope, { navigation: true });

const navigation = useGridNavigation(scope, {
	grid: root,
	exit,
	sections: props.sections,
	stickyStart: head,
	stickyEnd: foot,
});
```

The grid element needs `tabindex="0"`, and `exit` is a focusable element right after the grid that
Tab leaves through. `TableRoot` renders both.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'grid', type: 'MaybeRefOrGetter<HTMLElement | null>', required: true, description: 'The element with `role=&quot;grid&quot;` and `tabindex=&quot;0&quot;`: it takes focus first, and a key on it moves focus into a cell.' },
		{ name: 'exit', type: 'MaybeRefOrGetter<HTMLElement | null>', required: true, description: 'A focusable element right after the grid. Tab from a cell leaves through it, and Shift+Tab from past the grid comes back in.' },
		{ name: 'sections', type: 'MaybeRefOrGetter<GridSection[]>', required: true, description: 'The sections of the grid from the top: header, body, footer. `useTableProps` gives them.' },
		{ name: 'body', type: 'string', default: '\'body\'', description: 'The section whose rows are the rows of the scope, held by row key.' },
		{ name: 'scroller', type: 'MaybeRefOrGetter<HTMLElement | null>', default: 'the scope\'s root', description: 'The scroll container a focused cell is brought into view in.' },
		{ name: 'stickyStart', type: 'MaybeRefOrGetter<HTMLElement | null>', description: 'The sticky header: a cell under it is not in view.' },
		{ name: 'stickyEnd', type: 'MaybeRefOrGetter<HTMLElement | null>', description: 'The sticky footer.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'true' },
		{ name: 'onSpace', type: '(position: GridPosition, event: KeyboardEvent) => void', description: 'Space on a cell, such as opening its row. A cell whose whole content is one checkbox or switch toggles it instead.' },
		{ name: 'tree', type: 'GridNavigationTree', description: 'The tree of the body rows: → and ← in the tree column expand and collapse rows. The `tree` feature fits.' },
		{ name: 'treeColumn', type: 'MaybeRefOrGetter<string>', description: 'The column the keys of the tree work in: the column of `treeColumn()`, else the row header column.' },
		{ name: 'selection', type: 'GridNavigationSelection', description: 'The row selection: Shift+Space toggles the row, Ctrl+A selects all.' },
		{ name: 'onSelectColumn', type: '(position: GridPosition, event: KeyboardEvent) => void', description: 'Ctrl+Space on a cell. The `ranges` feature selects the column with it.' },
		{ name: 'onFocus', type: '(position: GridPosition) => void', description: 'Focus landed on a cell, by a key, a pointer or `focusCell`.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'focusCell', type: '(position: GridPosition) => Promise<boolean>', description: 'Focuses a cell, rendering and scrolling to it first when it is outside the windows. `false` when the grid has no such cell. Only the latest request wins, as a held key asks faster than cells arrive.' },
		{ name: 'focused', type: 'Readonly<Ref<FocusedGridCell | null>>', description: 'The cell focus is on, or was on when it left the grid: `{ section, row, cell, key }`, with the row key of a body cell. `null` once its row or column is gone.' },
		{ name: 'cells', type: 'BodyCellFocus', description: 'Focus of the body cells by address, `{ key, column }`: what ranges, editing and the clipboard move.' },
	]"
/>

A `GridPosition` is `{ section, row, cell }`: the name of the section, the index of the row in it and
the name of the column.

## Examples

### Opening a row with Space

```ts
const table = useDataTable({
	columns,
	rows: orders,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation({
			onSpace: ({ section, row }) => {
				if (section === 'body') {
					openOrder(orders.value[row]);
				}
			},
		}),
	},
});
```

### Showing where focus is

`focused` is reactive. Read it outside the row templates, in a status bar or a side panel, so that a
move does not render the rows. DOM focus and `:focus-visible` highlight the cell by themselves.

```ts
const status = computed(() => {
	const cell = table.navigation.focused.value;

	return cell ? `Row ${cell.row + 1}, ${cell.cell}` : '';
});
```

### Focus that survives the data

Focus holds on to a body row by its key. Sort the table, stream new rows in, remove rows around it:
the cell keeps focus. When its row goes away, focus moves to the row that took its place.

## Accessibility

Adheres to the [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) pattern of WAI-ARIA, with
the keys of the [Treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) pattern in a tree.

- The grid is one Tab stop. Cells have `tabindex="-1"`, so Tab never walks through a thousand cells
  or the buttons inside them.
- Focus is real DOM focus on the cell, which is what screen readers follow. A cell that is scrolled
  out of the row window is rendered first, then focused.
- A focused cell is scrolled clear of the sticky header, the footer and pinned columns, which
  `scrollIntoView` alone would leave it under.
- Widgets that need the arrow keys, such as a text field, a slider or a combobox inside a cell, keep
  them while they have focus.
- In a right-to-left table ← and → follow the reading direction.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Tab'], description: 'Moves focus into the grid, to the cell focused last or the first one; from a cell, out of the grid.' },
		{ keys: ['Shift+Tab'], description: 'Moves focus out of the grid, backwards; from past the grid, back into it.' },
		{ keys: ['→', '←', '↑', '↓'], description: 'Moves focus one cell. From a button or a checkbox inside a cell, too.' },
		{ keys: ['Ctrl+→', 'Ctrl+←'], description: 'Moves focus to the last or the first cell of the row.' },
		{ keys: ['Ctrl+↑', 'Ctrl+↓'], description: 'Moves focus to the first or the last row of the column.' },
		{ keys: ['Home', 'End'], description: 'Moves focus to the first or the last cell of the row.' },
		{ keys: ['Ctrl+Home', 'Ctrl+End'], description: 'Moves focus to the first or the last cell of the grid.' },
		{ keys: ['PageUp', 'PageDown'], description: 'Moves focus by as many rows as fit in view, by their heights.' },
		{ keys: ['Enter'], description: 'Presses the only button, link or checkbox of the cell; moves focus into a cell with several controls.' },
		{ keys: ['F2'], description: 'Moves focus into the content of the cell, and back to the cell.' },
		{ keys: ['Escape'], description: 'Moves focus from the content of a cell back to the cell.' },
		{ keys: ['Space'], description: 'Toggles the only checkbox or switch of the cell, else calls `onSpace`.' },
		{ keys: ['Shift+Space'], description: 'Toggles the selection of the row, with `selection`.' },
		{ keys: ['Ctrl+Space'], description: 'Calls `onSelectColumn`: selects the column with cell ranges.' },
		{ keys: ['Ctrl+A'], description: 'Selects every row, with `selection`.' },
		{ keys: ['→'], description: 'In the tree column, expands a collapsed row.' },
		{ keys: ['←'], description: 'In the tree column, collapses an expanded row, or moves focus to the parent row.' },
	]"
/>

On macOS <kbd>⌘</kbd> works wherever <kbd>Ctrl</kbd> does.

## See also

- [Keyboard navigation](/guides/keyboard-navigation): the guide, with how cell content behaves.
- [Features](/composables/features): the `navigation` feature.
- [The core](/composables/core): `useGridFocus`, the model of where focus is.
