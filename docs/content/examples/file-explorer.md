---
title: File explorer
description: A tree of files with folder sizes that add up, folders first, a details panel, and files dragged into folders.
pageClass: site-wide
aside: false
---

# File explorer

<Description>
A tree of folders and files: sizes that add up from the files inside, folders always listed first,
folders that open with the arrow keys, a panel with the details of the file you pick, and files that
move to another folder when you drop them on it.
</Description>

<Demo name="example-file-explorer" />

## What it shows

- A flat list of entries shown as a tree through `parentKey`: [Trees and grouping](/guides/trees-and-grouping),
  [Tree toggle](/components/tree-toggle).
- The first column of the tree from `treeColumn()`, with its indent and toggle, and your own cell
  content after them.
- An order of your own, folders first, while the headers still sort: [Sorting](/guides/sorting).
- Dragging into a folder, with the keyboard too: [Drag and drop](/guides/drag-and-drop),
  [`useGridRowDrag`](/composables/use-grid-row-drag).
- Folders that open and close, and files that change places, with motion: [Animation](/guides/animation).
- A details panel for the row you pick, beside the grid on a wide screen and a sheet over it on a
  narrow one, with focus that goes in and comes back: [Keyboard navigation](/guides/keyboard-navigation).

Click a file or a folder to see its details, or press <kbd>Space</kbd> on its row. Drag a file by its
grip onto a folder, or between the files of another folder. Sort by size or date from the headers:
the folders stay on top either way. Make the window narrow to see the panel become a sheet.

## How it works

### Sizes that add up

The data is a flat list of entries, each with the key of its parent folder. A folder has no size of
its own, so before the grid sees the rows, a small pure function walks each folder and adds up the
files under it, on every level:

```ts
const files = shallowRef<readonly FileEntry[]>(initialFiles);

const rows = computed(() => sortFiles(withFolderTotals(files.value), sort.value));
```

The totals are part of the rows, not something the cells compute, so the size column sorts by them
like any other value. Files keep their objects, so their rows are left alone; folders get new
objects with fresh totals whenever the files change, which for a tree of this size costs nothing.

### A tree from a flat list

The `tree` feature reads the parent of each row from `parentKey` and flattens the expanded part of
the tree into the rows the grid shows. `expanded` is a model: the grid writes to it when a folder
opens or closes, and the buttons of the toolbar write to it too.

```ts
const expanded = ref<string[]>();

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	sort,
	features: {
		tree: tree({ parentKey: 'parent', expanded, defaultExpanded: 1, sort: false }),
		navigation: navigation(),
	},
});

function expandAll() {
	expanded.value = files.value.filter(file => file.kind === 'folder').map(file => file.id);
}
```

`treeColumn()` turns the name column into the column of the tree. It puts the indent of the level
and a `GridTreeToggle` in front of your own content, and marks the column, so → and ← of the
navigation open and close folders in it. The content after the toggle is the column's
`GridCellTemplate`, whose slot gets the row's node:

```ts
name: treeColumn(column(file => file.name, { label: 'Name', flex: 1 })),
```

```vue
<GridCellTemplate v-slot="{ row, node }" :column="columns.name">
	<FileName :file="row" :open="node?.expanded" />
</GridCellTemplate>
```

### Folders first

A tree sorts the children of every folder by the column state, but "folders first" is a rule the
columns do not know. So the tree is told not to sort (`sort: false`), and keeps the order of the
rows it gets, and the rows come sorted by `sortFiles`: folders before files, then by the first
column of the sort, in its direction.

The sort itself is still the grid's. `sort` is a ref given to `useDataGrid` as a model: a click on a
header writes the new sort into it, the rows computed from it re-sort, and the headers show the
direction with `aria-sort`.

### Dropping files into folders

This example uses the composable `useGridRowDrag` rather than the `GridRowDrag` part. Called in
the component that renders the grid, it works the same way, and its callbacks get your rows typed:

```ts
useGridRowDrag(grid, {
	handle: true,
	enabled: true,
	stepKeys: false,
	indicator: 'line',
	canNest: file => file.kind === 'folder',
	canDrop: ({ row, parent }) => row.parent !== parent,
	onDrop: ({ key, parent, index }) => {
		const file = files.value.find(entry => entry.id === key);

		if (file) {
			files.value = moveRow(files.value, { key, row: file, parent, index }, { rowKey: 'id', parentKey: 'parent' });
		}
	},
});
```

- `canNest` lets a drop go inside folders, empty ones included; files take nothing inside.
- `canDrop` only offers places in another folder: within a folder the order is always by name, so a
  place among its own files would change nothing.
- Row drag turns itself off while the rows are sorted, because the order is then the sort's. Here a
  drop only changes the folder, so `enabled: true` keeps it on.
- `moveRow` gives the moved file its new `parent`, and the totals and the order follow from there.

### The details of a file

The panel shows the row whose key is in `openKey`. A click on a row opens it, unless the click was on
one of the row's buttons, the grip or the toggle. From the keyboard, <kbd>Space</kbd> on any cell of
the row opens it, and so does <kbd>Enter</kbd> on a cell without a button of its own; <kbd>Enter</kbd>
on the name of a folder still opens the folder. The handlers sit on `GridRow`, so they run before
the navigation of the grid, which leaves a key alone once it is handled:

```vue
<GridRow
	v-for="row in shown"
	:key="row.key"
	:row="row"
	:aria-current="row.key === openKey ? 'true' : undefined"
	@click="onRowClick($event, row.key)"
	@keydown="onRowKeydown($event, row.key)"
>
	<GridCells />
</GridRow>
```

`aria-current` marks the row the panel is about, and the theme draws it from that attribute, so what
a screen reader hears and what you see agree. The folders of the path come from the flat list, by
walking the parents of the file up to the top.

Opened from the keyboard, the panel takes focus on its title. Closing it, with its button or
<kbd>Escape</kbd>, gives focus back to the row through the navigation of the grid:

```ts
function closeDetails() {
	const row = openKey.value === null ? -1 : grid.scope.getRowIndex(openKey.value);

	openKey.value = null;

	if (row !== -1) {
		void grid.navigation.focusCell({ section: 'body', row, cell: 'name' });
	}
}
```

### Wide and narrow

The demo is a CSS container: `container: explorer / inline-size`. While it is wide, the panel stands
beside the grid and slides open by its width. Below 720 pixels of the container, not of the
window, a container query turns the same panel into a sheet over the bottom of the grid, with a
backdrop that closes it. There is one panel and one piece of state; only the CSS changes, so the
layout follows the space the demo actually gets, in a sidebar or on a phone alike.

## Accessibility

- The grid is a `treegrid`: each row says its level, its place among the rows of its folder and,
  for a folder, whether it is open, with `aria-level`, `aria-posinset`, `aria-setsize` and
  `aria-expanded`.
- The name column is the row header, so moving along a row keeps the name of the file in reach of a
  screen reader. The icons are decoration; the number of files in a folder is text.
- The toggles are buttons that say what they do, "Expand" or "Collapse", and the arrow keys do the
  same from any cell of the name column.
- Grips drag with the keyboard, and every step is announced: the file picked up, the folder it is
  over, where it lands.
- The details panel is an `aside` named by its title. Opened from the keyboard it takes focus, and
  closing it returns focus to the row it was opened from. The row it describes carries
  `aria-current`.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['→'], description: 'In the name column: opens a closed folder; in an open one, moves to the next cell.' },
		{ keys: ['←'], description: 'In the name column: closes an open folder, or moves from a file to its folder.' },
		{ keys: ['↑', '↓'], description: 'Moves to the row above or below; while a file is picked up, through the places it can go, inside folders included.' },
		{ keys: ['Enter'], description: 'On a header: sorts by that column. On the grip cell: moves focus onto the grip.' },
		{ keys: ['Space', 'Enter'], description: 'On a focused grip: picks the file up, and drops it at the place chosen.' },
		{ keys: ['Space'], description: 'On any cell of a row: opens the details of its file or folder.' },
		{ keys: ['Enter'], description: 'On a cell without a button: opens the details, as Space does.' },
		{ keys: ['Escape'], description: 'Cancels the drag; in the details panel, closes it and returns to the row.' },
	]"
/>
