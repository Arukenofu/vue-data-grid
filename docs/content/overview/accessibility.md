---
title: Accessibility
description: What the grid does for people who use a keyboard, a screen reader or reduced motion, and what is left to you.
---

# Accessibility

<Description>
A grid built from the parts follows the WAI-ARIA grid and treegrid patterns out of the box: roles,
counts, states, focus, keys and announcements. This page is the map of what you get, how it works
under virtualization, and the few things only you can do.
</Description>

<Demo name="showcase" />

Put the mouse away and try the grid above: <kbd>Tab</kbd> into it, walk the cells with the arrows,
sort a column with <kbd>Enter</kbd> on its header, select rows with <kbd>Shift</kbd>+<kbd>Space</kbd>.
With a screen reader on, each move names the cell, its row and its column.

## The patterns it follows

| Grid | Pattern | When |
| --- | --- | --- |
| `role="grid"` | [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | The default: a grid people move through and act in. |
| `role="treegrid"` | [Treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Automatic with the `tree` feature: rows nest and expand. |
| `role="table"` | [Table](https://www.w3.org/WAI/ARIA/apg/patterns/table/) | Pass `role: 'table'` to `useDataGrid` for a static table that is only read. |

A grid is one stop in the Tab order, and the arrow keys move inside it. That is what makes a grid
of a thousand rows and twenty columns usable from the keyboard: Tab does not walk every button in
every cell.

## Structure and roles

The prop-getters of the grid put a role on every element, and the parts apply them for you:

- the grid element is `grid`, `treegrid` or `table`;
- the header, the body and the footer are `rowgroup`s, and every row is a `row`;
- a column header is a `columnheader`, and a group header cell spans its columns with
  `aria-colspan`;
- the first data column is a `rowheader`, so a screen reader reads a cell together with the name of
  its row; `rowHeader: true` on a column picks another one, and `rowHeader: false` turns it off;
- other cells are `gridcell`s, or `cell`s in a static table;
- the spacers that stand for columns outside the column window are `presentation`, invisible to
  assistive technology.

## Counts and positions under virtualization

A windowed grid renders a few dozen rows out of thousands. A screen reader still needs to know
where it is, so the counts describe the whole grid, not what is rendered:

- `aria-rowcount` counts every row: header rows, body rows and footer rows;
- `aria-colcount` counts the shown columns;
- every row has `aria-rowindex` and every cell `aria-colindex`, from `1`, so "row 1,204 of 50,002"
  is read right even though row 1,204 is the tenth element in the DOM.

When the rows are loaded page by page, pass `rowCount` to `useDataGrid` with the size of the whole
set, or `-1` while it is unknown, and for pages that replace each other `rowIndexOffset` with the rows
before the page. See [Pages and infinite scrolling](/guides/paging).

## States

| State | Where | Comes from |
| --- | --- | --- |
| `aria-sort` | The header of the first sort column | The `sorting` state. ARIA has no sort levels, so the rest of a multi-sort is announced instead. |
| `aria-selected` | Rows, or cells with cell ranges | The `selection` or `ranges` feature. |
| `aria-multiselectable` | The grid | While more than one row or cell can be selected. |
| `aria-level`, `aria-posinset`, `aria-setsize` | Rows of a tree | The `tree` feature: depth and place among siblings. |
| `aria-expanded` | Rows that have children, group toggles | The `tree` feature and collapsible column groups. |
| `aria-busy` | The grid | While a `GridLoading` or `GridPlaceholderRows` is shown. |
| `aria-valuenow`, `aria-valuetext` | Resize handles, `role="separator"` | The width of the column, read as "240 px". |
| `aria-invalid`, `aria-describedby` | Editors | The column's `validate`, pointing at the error text. |

## Names

- **The grid** is named by `label` on `GridRoot`, or by a visible heading through
  `aria-labelledby`. Always give it one.
- **Controls** are named from the grid's `messages`: "Select row", "Expand", "Resize Price",
  "Drag Invoice 1043". Give the selection checkbox a `label` of its own when rows have a clearer name.
- **Rows** are named by their row header cell, which is why the first data column should name the
  row: a person's name, an invoice number, a file name.

## Focus

With the `navigation` feature, focus is managed for you:

- the grid is a single Tab stop, and Tab from inside it leaves the grid instead of walking cells;
- coming back with Tab lands on the cell focused last;
- the focused row and column stay rendered while they are scrolled out of the windows, so focus is
  never lost to virtualization;
- a focused cell is scrolled clear of the sticky header, the footer and pinned columns, not just
  into the viewport;
- when the focused row is removed, focus moves to the row that takes its place;
- after an edit is saved or cancelled, focus goes back to the cell.

Rows do not re-render when focus moves: the browser's own `:focus-visible` draws the focus ring, and
the structural styles set it through `--dg-focus-ring`.

## Announcements

`GridRoot` renders a polite live region next to the grid. It says what the markup cannot:

- the whole sort when it changes, such as "Sorted by Team ascending, then Salary descending";
- the number of selected rows when it changes;
- that the grid is loading.

During a keyboard drag the drag says where the row is and where it lands. Every string comes from
`messages` and can be translated; `useGridAnnouncer` lets you announce your own text through the
same region. See [Localization](/guides/localization).

## Keyboard interactions

Every key below works only where its feature or part is present. Each guide lists its own keys in
detail.

### Moving through the grid

<KeyboardTable
	:data="[
		{ keys: ['Tab', 'Shift+Tab'], description: 'Moves focus into the grid, to the cell focused last, or out of it.' },
		{ keys: ['↑', '↓', '←', '→'], description: 'Moves focus one cell. In a right-to-left grid the horizontal arrows follow the reading direction.' },
		{ keys: ['Home', 'End'], description: 'Moves focus to the first or the last cell of the row.' },
		{ keys: ['Ctrl+Home', 'Ctrl+End'], description: 'Moves focus to the first or the last cell of the grid.' },
		{ keys: ['Ctrl+↑', 'Ctrl+↓'], description: 'Moves focus to the first or the last row, in the same column.' },
		{ keys: ['PageUp', 'PageDown'], description: 'Moves focus by as many rows as fit between the header and the footer.' },
		{ keys: ['Enter', 'F2'], description: 'Moves focus into the content of the cell; a cell with a single button or checkbox presses it at once.' },
		{ keys: ['Escape'], description: 'Moves focus from the content back to the cell.' },
	]"
/>

### Headers and columns

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'Space'], description: 'Sorts by the column of the focused header.' },
		{ keys: ['Shift+Enter', 'Shift+Space'], description: 'Adds the column to the sort, with `multiSort`.' },
		{ keys: ['Alt+←', 'Alt+→'], description: 'Moves a `movable` column one place.' },
		{ keys: ['Shift+←', 'Shift+→'], description: 'Makes a `resizable` column narrower or wider.' },
		{ keys: ['←', '→'], description: 'On a focused resize handle: changes the width by a step.' },
		{ keys: ['Home', 'End'], description: 'On a focused resize handle: takes the width to its minimum or maximum.' },
	]"
/>

### Selection, trees and ranges

<KeyboardTable
	:data="[
		{ keys: ['Shift+Space'], description: 'Selects or deselects the row of the focused cell.' },
		{ keys: ['Ctrl+A'], description: 'Selects every row, or every cell with cell ranges.' },
		{ keys: ['→', '←'], description: 'In the tree column: expands a collapsed row; collapses an expanded one, or moves to the parent.' },
		{ keys: ['Shift+↑', 'Shift+↓', 'Shift+←', 'Shift+→'], description: 'Extends the cell range from the focused cell.' },
		{ keys: ['Ctrl+Space'], description: 'Selects the whole column with cell ranges.' },
		{ keys: ['Escape'], description: 'Collapses the ranges to the focused cell.' },
	]"
/>

### Editing and the clipboard

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'F2'], description: 'Starts editing the focused cell with its value.' },
		{ keys: ['Any character'], description: 'Starts editing with that character, as a spreadsheet does.' },
		{ keys: ['Enter', 'Shift+Enter'], description: 'In an editor: saves and moves down or up.' },
		{ keys: ['Tab', 'Shift+Tab'], description: 'In an editor: saves and moves to the next or the previous editable cell.' },
		{ keys: ['Escape'], description: 'In an editor: cancels.' },
		{ keys: ['Delete', 'Backspace'], description: 'Clears the selected cells.' },
		{ keys: ['Ctrl+Z', 'Ctrl+Y'], description: 'Undoes or redoes an edit.' },
		{ keys: ['Ctrl+C', 'Ctrl+X', 'Ctrl+V'], description: 'Copies, cuts or pastes the selected cells, as tab-separated text.' },
		{ keys: ['Ctrl+D', 'Ctrl+R'], description: 'Fills the range down or right from its first row or column.' },
	]"
/>

### Dragging

<KeyboardTable
	:data="[
		{ keys: ['Space', 'Enter'], description: 'On a drag handle: picks the row up, or drops it.' },
		{ keys: ['↑', '↓'], description: 'While a row is picked up: moves it to the previous or the next place.' },
		{ keys: ['Escape'], description: 'Cancels the drag; the row goes back.' },
		{ keys: ['Alt+↑', 'Alt+↓'], description: 'On any cell: moves the row one place at once.' },
	]"
/>

On macOS, <kbd>⌘</kbd> works wherever <kbd>Ctrl</kbd> is listed.

## Motion

Every animation respects `prefers-reduced-motion`. The engines that ship with the library,
`webAnimations()` and anything made with `defineMotionEngine`, play nothing for a user who asks for
reduced motion; rows and columns simply appear in their new places. An engine of your own gets the
same behaviour from `defineMotionEngine`, or can check `prefersReducedMotion()` itself. See
[Animation](/guides/animation).

## What is left to you

Some things no library can do for you:

- **Contrast.** The theme is yours: keep text, focus rings and selection tints at a contrast of at
  least 4.5:1 for text and 3:1 for the rest.
- **Colour alone.** A red number for a loss also needs a minus sign or an arrow.
- **Names.** Label the grid, and make the first data column something that names the row.
- **Custom controls.** A button in a cell needs an accessible name; an icon alone does not have one.
- **Target size.** Checkboxes, handles and toggles should be at least 24 by 24 pixels to hit with a
  finger.
- **Testing.** Try your grid with a keyboard alone, and with a screen reader: NVDA or JAWS on
  Windows, VoiceOver on macOS and iOS, TalkBack on Android.

## See also

- [Keyboard navigation](/guides/keyboard-navigation)
- [Localization](/guides/localization)
- [Root](/components/root)
