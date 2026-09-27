---
title: Keyboard navigation
description: Move through the cells of a table with the keys of a spreadsheet, in the WAI-ARIA grid pattern.
---

# Keyboard navigation

<Description>
A table with many rows should not be a hundred Tab stops. With the <code>navigation</code> feature it is one:
Tab brings focus into the table, the arrow keys move it from cell to cell, and Tab takes it out again.
</Description>

<Demo name="keyboard-navigation" />

Click a cell, or press <kbd>Tab</kbd> until focus reaches the table, then use the arrow keys. The
version is a button, <kbd>Enter</kbd> presses it; the checkbox toggles with <kbd>Space</kbd>. The
last column is a toolbar of three buttons: <kbd>Enter</kbd> moves focus into it, <kbd>←</kbd> and
<kbd>→</kbd> move between its buttons, and <kbd>Escape</kbd> brings focus back to the cell. Try <kbd>Shift</kbd>+<kbd>Space</kbd> to select a row and <kbd>Ctrl</kbd>+<kbd>A</kbd>
to select them all.

## Turn it on

Navigation is a feature, like sorting. Add it to the table and nothing else changes in the markup:

```ts
import { navigation, useDataTable } from '@vue-data-grid/core';

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 44,
	features: { navigation: navigation() },
});
```

With it, `TableRoot` becomes a single Tab stop, every cell gets `tabindex="-1"` so it can take focus
from code, and a hidden element after the table catches <kbd>Tab</kbd> on its way out. The header
and the footer are part of the grid too: <kbd>↑</kbd> from the first row lands on the column
headers, where the keys of the header work.

When the table has the `selection` or the `tree` feature, navigation picks them up by itself:
<kbd>Shift</kbd>+<kbd>Space</kbd> selects the row, and <kbd>→</kbd> and <kbd>←</kbd> expand and
collapse rows in the tree column.

## Where focus goes

The model follows the [grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) of WAI-ARIA and
the habits of spreadsheets: the arrows move one cell, <kbd>Ctrl</kbd> jumps to the edge, and paging
moves by as many rows as fit between the sticky header and footer, whatever their heights.

Focus is held by the **row key**, not by the index of the row on screen. Sort the table while a cell
is focused and focus stays on the same row, now somewhere else; remove the row and focus moves to the
row that took its place. A focused cell stays rendered while the windows of
[virtualization](/guides/virtualization) scroll past it, and a cell that is out of view is scrolled
into view from under the sticky header and pinned columns before it takes focus.

## Controls inside cells

Cells often hold a button, a link or a checkbox. The navigation treats them the way people expect,
without any code of yours:

- A cell whose only content is a **button or a link** acts as one: <kbd>Enter</kbd> presses it.
- A cell whose only content is a **checkbox or a switch** toggles with <kbd>Space</kbd>, and with
  <kbd>Enter</kbd> too.
- A cell with **several controls**, or with one that takes text, gets focus moved into it by
  <kbd>Enter</kbd> or <kbd>F2</kbd>. <kbd>Escape</kbd> or <kbd>F2</kbd> comes back to the cell.
- From a button or a checkbox inside a cell, the arrows keep moving through the grid.
- **Composite widgets** keep the arrows for themselves: a toolbar, a radio group, a menu, a listbox,
  a tab list, a slider, a text field. Inside them the arrows move within the widget, and
  <kbd>Escape</kbd> brings focus back to the cell, from where the arrows move through the grid again.

Clicking a control inside a cell puts the focus model on that cell too, so the next arrow key goes on
from where you clicked.

### Several actions in a cell

A row of buttons is best written as a toolbar: one Tab stop, the arrows between its buttons. The
demo builds it with the [Toolbar](https://reka-ui.com/docs/components/toolbar) of Reka UI, whose
`role="toolbar"` tells the navigation to leave the arrows to it:

```vue
<script setup lang="ts">
import { ToolbarButton, ToolbarRoot } from 'reka-ui';

defineProps<{ release: Release }>();

const emit = defineEmits<{ action: [name: string] }>();
</script>

<template>
	<ToolbarRoot class="release-actions" :aria-label="`Actions for ${release.version}`">
		<ToolbarButton as-child>
			<UiButton size="sm" @click="emit('action', 'Deployed')">Deploy</UiButton>
		</ToolbarButton>
		<ToolbarButton as-child>
			<UiButton size="sm" variant="ghost" @click="emit('action', 'Reverted')">Revert</UiButton>
		</ToolbarButton>
	</ToolbarRoot>
</template>
```

The column renders it from its `cell` field, typed by the row:

```ts
actions: column(() => null, {
	label: 'Actions',
	kind: 'service',
	cell: ({ row }) => h(ReleaseActions, { release: row, onAction: name => run(name, row) }),
}),
```

The roving focus of the toolbar keeps only one of its buttons in the Tab order, so <kbd>Enter</kbd>
on the cell lands on the button used last, and <kbd>Tab</kbd> from it leaves the table.

## Moving focus from code

The handle of the feature, `table.navigation`, tells where focus is and moves it:

```ts
const focused = computed(() => table.navigation.focused.value);

async function focusFirstCell() {
	await table.navigation.focusCell({ section: 'body', row: 0, cell: 'version' });
}
```

A position is a section (`'head'`, `'body'` or `'foot'`), a row inside it, and the name of the
column. `focusCell` renders the cell first when it is outside the windows, then focuses it, and
resolves to `false` when there is no such cell. `focused` also gives the row key of a body cell, and
stays on the last cell after focus leaves the table, so <kbd>Tab</kbd> comes back to it.

::: tip Keep focus out of the rows
`focused` is reactive, but do not read it in a row template to highlight the focused cell. Every row
would re-render on every arrow key. DOM focus and `:focus-visible` already do the highlighting, and
the structural styles draw the focus ring with `--dg-focus-ring`. Read `focused` outside the rows, as
the toolbar of the demo does.
:::

## Options

`navigation()` takes the options of `useGridNavigation`. The table fills in the elements, the
sections and the sticky blocks; what is left is about behaviour:

<PropsTable
	label="Option"
	:data="[
		{ name: 'onSpace', type: '(position: GridPosition, event: KeyboardEvent) => void', description: 'Space on a cell that has no checkbox or switch of its own to toggle.' },
		{ name: 'onFocus', type: '(position: GridPosition) => void', description: 'Focus landed on a cell: by a key, a pointer or `focusCell`.' },
		{ name: 'onSelectColumn', type: '(position: GridPosition, event: KeyboardEvent) => void', description: 'Ctrl+Space on a cell. The `ranges` feature selects the whole column with it by itself.' },
		{ name: 'treeColumn', type: 'MaybeRefOrGetter<string | undefined>', description: 'The column where → and ← expand and collapse rows: the column of `treeColumn()` by default, else the row header.' },
		{ name: 'selection', type: 'GridNavigationSelection', description: 'What Shift+Space and Ctrl+A select; the `selection` feature of the table by default.' },
		{ name: 'tree', type: 'GridNavigationTree', description: 'What → and ← expand and collapse; the `tree` feature of the table by default.' },
		{ name: 'exit', type: 'MaybeRefOrGetter<HTMLElement | null>', description: 'The element Tab leaves the grid through; the one `TableRoot` renders by default.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Turn the keys off for a while, such as while a dialog over the table is open.' },
	]"
/>

The full reference, for markup of your own, is on the [`useGridNavigation`](/composables/use-grid-navigation)
page.

## Accessibility

The navigation implements the keyboard interaction of the WAI-ARIA
[grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and
[treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) patterns with a roving focus: the
focused cell is a real DOM focus, so screen readers announce the cell, its column header and its row
header as focus moves.

- The grid is one Tab stop. The cells have `tabindex="-1"`, and the grid and the exit element leave
  the tab order while focus is inside, so <kbd>Shift</kbd>+<kbd>Tab</kbd> from the first cell leaves
  the table instead of stopping on it.
- Focus returns to the cell it left, even after the rows were sorted or the cell was scrolled out of
  view.
- In a right-to-left table, <kbd>←</kbd> and <kbd>→</kbd> follow the reading direction.
- Composite widgets in cells, such as a toolbar of actions, keep their own keyboard model inside the
  grid's: one stop in the cell, arrows within the widget, <kbd>Escape</kbd> back to the cell.
- Keys of an input method's composition are left alone, so typing in Japanese or Chinese inside a
  cell never moves focus.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Tab'], description: 'Moves focus into the table, to the cell focused last or the first one; from a cell, out of the table.' },
		{ keys: ['Shift+Tab'], description: 'Moves focus out of the table, backwards.' },
		{ keys: ['→', '←'], description: 'Moves focus one cell right or left. In the tree column → expands a collapsed row and ← collapses an expanded one or goes to the parent row.' },
		{ keys: ['↓', '↑'], description: 'Moves focus one row down or up, between the header, the body and the footer too.' },
		{ keys: ['Home', 'End'], description: 'Moves focus to the first or the last cell of the row.' },
		{ keys: ['Ctrl+Home', 'Ctrl+End'], description: 'Moves focus to the first or the last cell of the table.' },
		{ keys: ['Ctrl+↑', 'Ctrl+↓'], description: 'Moves focus to the first or the last row, in the same column.' },
		{ keys: ['PageUp', 'PageDown'], description: 'Moves focus by as many rows as fit in view.' },
		{ keys: ['Enter'], description: 'Presses the only button, link or checkbox of the cell; otherwise moves focus into the cell.' },
		{ keys: ['F2'], description: 'Moves focus into the content of the cell, and back to the cell from there.' },
		{ keys: ['Escape'], description: 'Moves focus from the content of a cell back to the cell.' },
		{ keys: ['←', '→'], description: 'Inside a toolbar, radio group, menu or listbox of a cell: moves between its items instead of through the grid.' },
		{ keys: ['Space'], description: 'Toggles the only checkbox or switch of the cell, or calls `onSpace`.' },
		{ keys: ['Shift+Space'], description: 'Selects or deselects the row, with the `selection` feature.' },
		{ keys: ['Ctrl+A', '⌘+A'], description: 'Selects every row, with the `selection` feature.' },
		{ keys: ['Ctrl+Space', '⌘+Space'], description: 'Selects the column, with the `ranges` feature or `onSelectColumn`.' },
	]"
/>

On a column header cell:

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'Space'], description: 'Sorts by the column, when it is `sortable`.' },
		{ keys: ['Shift+Enter', 'Ctrl+Enter', 'Shift+Space'], description: 'Adds the column to the sort, with `multiSort`.' },
		{ keys: ['Alt+←', 'Alt+→'], description: 'Moves the column one place, when it is `movable`.' },
		{ keys: ['Shift+←', 'Shift+→'], description: 'Makes the column narrower or wider by 16 px, when it is `resizable`.' },
	]"
/>

On macOS, <kbd>⌘</kbd> works wherever <kbd>Ctrl</kbd> is listed.

## See also

- [Row selection](/guides/selection): what <kbd>Shift</kbd>+<kbd>Space</kbd> and <kbd>Ctrl</kbd>+<kbd>A</kbd> select.
- [Cell ranges and clipboard](/guides/cell-ranges): selecting cells with <kbd>Shift</kbd> and the arrows.
- [Editing](/guides/editing): typing into a focused cell.
- [`useGridNavigation`](/composables/use-grid-navigation): the navigation for markup of your own.
- [Accessibility](/overview/accessibility): what the table does for assistive technology as a whole.
