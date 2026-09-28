---
title: Team directory
description: A people directory with search, filters, bulk actions, a column menu and a layout remembered between visits.
pageClass: site-wide
aside: false
---

# Team directory

<Description>
A directory of people: search and a team filter, checkboxes with actions for the selected rows, a
menu to show, hide and pin columns, headers you drag into a new order, and a layout the browser
remembers until you reset it.
</Description>

<Demo name="example-team-directory" />

## What it shows

- Rows filtered by your own code before the grid sees them, and an empty state with a way out:
  [Loading and empty states](/guides/data-loading).
- A checkbox column and actions for the selected rows: [Row selection](/guides/selection),
  [Selection checkbox](/components/selection-checkbox).
- A column menu built on the scope: [Column layout](/guides/column-layout).
- Columns pinned to both edges, resized by their handles and moved by dragging their headers:
  [Column drag](/components/column-drag), [Resize handle](/components/resize-handle).
- The whole layout, and the sort, kept in `localStorage` with one option.

Try it: resize a column, drag the Team header before Role, hide Location from the menu, sort by
salary, then reload the page. It comes back as you left it; "Reset layout" in the menu starts over.

## How it works

### Filters are just rows

The grid has no filter feature of its own to configure. The search box and the team select are
plain refs, and the rows the grid gets are computed from them:

```ts
const filtered = computed(() => {
	const text = query.value.trim().toLowerCase();

	return people.value.filter(person => (team.value === 'all' || person.team === team.value)
		&& `${person.name} ${person.email} ${person.role}`.toLowerCase().includes(text));
});

const grid = useDataGrid({
	columns,
	rows: filtered,
	rowKey: 'id',
	rowHeight: 52,
	multiSort: true,
	persist: localStorageStore('team-directory'),
	features: {
		sorting: sorting(),
		selection: selection(),
		navigation: navigation(),
	},
});
```

When nothing matches, `GridEmpty` shows a row that spans the grid, with a button that clears the
filters. It counts as a row for `aria-rowcount`, so the grid stays valid while it is empty.

### Selection and its actions

`selectionColumn()` is a real column, pinned to the start, with a "select all" checkbox in its
header and a checkbox in every row. Selection is kept by row key, so it survives sorting and
filtering: a person you selected and then filtered out stays selected.

The bar of actions reads the selected people from the whole list, not only the rows in view:

```ts
const selected = computed(() => people.value.filter(person => grid.selection.isSelected(person.id)));

function exportCsv() {
	const shown = grid.scope.columns.value.flatMap(item => (item.column ? [item.column] : []));

	downloadCsv(toCsv({ columns: shown, rows: selected.value }), { name: 'team' });
}
```

`toCsv` writes each value through the column's `format`, in the order and with the columns the
grid shows, and leaves service columns such as the checkboxes out.

### A column menu on the scope

`grid.scope` knows every declared column, hidden ones included, and has the operations a menu
needs: `isColumnHidden` and `toggleColumn`, `getPin` and `pinColumn`, `fitColumns`. The menu of the
example is a list of entries computed from it:

```ts
{
	type: 'checkbox',
	label: getLabel(column),
	checked: !scope.isColumnHidden(column.name),
	disabled: !column.hideable,
	toggle: () => scope.toggleColumn(column.name),
}
```

What a column allows is declared with it. Every column here is `sortable`, `resizable`, `movable` and
`hideable` through the defaults of the builder; the name column opts out of moving and hiding, and
the name and the salary are `pinnable`, pinned to the start and to the end.

### Dragging headers

`GridColumnDrag` around the header makes the `movable` headers draggable. The columns make room as
you drag, and a column never leaves its pinned side:

```vue
<GridRoot :grid="grid" label="Team directory">
	<GridColumnDrag>
		<UiDataGridHeader />
		<GridDragPreview />
	</GridColumnDrag>
	<GridBody v-slot="{ rows }">
		<!-- … -->
	</GridBody>
</GridRoot>
```

`UiDataGridHeader` is the header of the demo kit, the usual parts with icons of its own: a
`GridHeaderCell` for each column, with its content, sort indicator and resize handle.

### A layout that is remembered

`persist: localStorageStore('team-directory')` keeps the column state in `localStorage`: the order,
the hidden columns, the widths, the pins and the sort. The stored record is read once the component
is mounted, so the markup rendered on the server matches, and every change is written back.
`grid.state.reset()` returns to the declared layout and removes the record.

## Accessibility

- The grid has the `grid` role and a single Tab stop, named "Team directory". The name column is the row
  header, so a screen reader names the person while you move along a row.
- Rows have `aria-selected`, and the grid is `aria-multiselectable`. The checkboxes are native
  inputs named "Select row" and "Select all rows", and the grid announces how many rows are
  selected after every change.
- Sorting is announced in full, since `aria-sort` can only mark the first column of a multi-sort.
- Resize handles are separators that say the width of their column; the bar of actions is a
  labelled region, and its icon button is named "Clear the selection".

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Shift+Space'], description: 'Selects or clears the row of the focused cell.' },
		{ keys: ['Ctrl+A', '⌘+A'], description: 'Selects every row.' },
		{ keys: ['Space'], description: 'On a checkbox cell: toggles the checkbox.' },
		{ keys: ['Enter'], description: 'On a header: sorts by it; with Shift, adds it to the sort.' },
		{ keys: ['Alt+←', 'Alt+→'], description: 'On a header: moves the column one place.' },
		{ keys: ['Shift+←', 'Shift+→'], description: 'On a header: makes the column narrower or wider.' },
	]"
/>
