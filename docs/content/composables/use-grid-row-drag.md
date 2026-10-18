---
title: useGridRowDrag
description: Dragging the rows of a grid with a pointer, a finger or the keyboard — within a grid, through a tree and between grids.
---

# useGridRowDrag

<Description>
Dragging the rows of a grid with a pointer, a finger or the keyboard: within the grid, into and
out of the groups of a tree, and between grids of a group. A drop is a change of your rows: the
grid's `rowEditing` feature writes it, or your `onDrop` does.
</Description>

<Demo name="api-use-grid-row-drag" />

Grab a row by its handle and drop it at another place, or focus a handle, press
<kbd>Space</kbd>, move with the arrows and press <kbd>Space</kbd> again. The rows open a gap where
the dragged one would land.

## Usage

Import it from the `drag-and-drop` entry, which needs `@vue-data-grid/drag-and-drop` installed next to the
grid:

<InstallTabs packages="@vue-data-grid/core @vue-data-grid/drag-and-drop" />

```ts
import { rowEditing } from '@vue-data-grid/core';
import { dragHandleColumn, useGridRowDrag } from '@vue-data-grid/core/drag-and-drop';

const columns = defineColumns({
	handle: dragHandleColumn(),
	title: column('title', { label: 'Title' }),
});

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 42,
	features: {
		rowEditing: rowEditing({ onCommit: (commit) => { rows.value = commit.rows; } }),
	},
});

useGridRowDrag(grid, { handle: true });
```

Call it in the component that renders the grid: the rows below register themselves with it. The
`GridRowDrag` part does the same from the template, with the options as props.

A drop is a change of the rows, `event.change`: a `move` of an own row, an `add` of a row from
another grid. The grid's [`rowEditing`](/composables/use-grid-row-editing) feature writes it, as a
commit from `'drop'`, and a row from another grid of the group leaves that grid's rows through its
`rowEditing` too. `onDrop` runs first: listen there, or call `event.preventDefault()` and write the
change yourself, such as through `applyRowChanges` in a grid without `rowEditing`:

```ts
useGridRowDrag(grid, {
	onDrop: (event) => {
		rows.value = applyRowChanges(rows.value, [event.change], { rowKey: 'id' }).rows;
	},
});
```

The grid leaves a drop to you, and warns in development, where it cannot say it as a change of its
rows: a row dropped into another group of a grid with `grouping`, whose group is a field of the
row, and a row with rows under it from another grid, which would leave them behind.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'onDrop', type: '(event: GridRowDropEvent) => void', description: 'A row was dropped: `{ key, row, parent, index, external, source, change, preventDefault }`. `row` is the row as it is at the drop, `index` the place among the children of `parent` once the row is taken out, and `change` the drop as a change of `applyRowChanges`. After it the `rowEditing` feature of the grid writes `change`, unless it calls `preventDefault()`. A grid that takes no rows, with `reorder: false` outside a group, needs none.' },
		{ name: 'handle', type: 'MaybeRefOrGetter<boolean>', default: 'false', description: 'Drags start only on a `GridDragHandle`, which also drags with the keyboard. Without it the whole row drags with a pointer, and controls in its cells keep their clicks.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'while unsorted', description: 'Whether rows can be dragged now. By default a grid that reorders drags only while it is not sorted, as the order is then the sort\'s; one with `reorder: false` always.' },
		{ name: 'group', type: 'MaybeRefOrGetter<string>', description: 'A name shared by grids that take each other\'s rows.' },
		{ name: 'reorder', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Whether the grid takes its own rows at new places. `false` for rows that only leave, for the grids of the `group` and for drop zones: the grid keeps its order, still takes the rows of the group, and has no keyboard drag and no step keys.' },
		{ name: 'bounds', type: '\'grid\' | \'window\' | HTMLElement', default: '\'grid\'', description: 'What neither the pointer nor the ghost leaves; `window` by default in a `group`, so a row can reach another grid.' },
		{ name: 'canDrag', type: '(row: TRow, key: string) => boolean', description: 'Whether a row can be dragged; every row by default.' },
		{ name: 'canDrop', type: '(target: GridRowDropTarget) => boolean', description: 'Whether a row may be dropped at a place, `{ key, row, parent, index, over, position }`. A place it may not is never shown.' },
		{ name: 'canAccept', type: '(offer: { row, source }) => boolean', description: 'Whether to take a row from another grid of the group.' },
		{ name: 'canNest', type: '(row: TRow, key: string) => boolean', default: 'group rows', description: 'In a tree, whether a row takes children dropped inside it.' },
		{ name: 'indicator', type: 'MaybeRefOrGetter<\'gap\' | \'line\' | \'mark\'>', default: '\'gap\'', description: 'How the place is shown: the rows move apart, a line slides to the place, or attributes alone for CSS of your own.' },
		{ name: 'motion', type: 'MaybeRef<MotionEngine | false>', default: 'webAnimations()', description: 'The engine of the gap, the ghost and the rows after a drop; `false` for none.' },
		{ name: 'stepKeys', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Alt+↑ and Alt+↓ on a cell move its row one place among its siblings, with a handle or without.' },
		{ name: 'touchDelay', type: 'MaybeRefOrGetter<number>', default: '250', description: 'How long a finger rests on a row before it drags, ms, so a swipe still scrolls.' },
		{ name: 'autoScroll', type: 'MaybeRefOrGetter<DragAutoScroll | false>', description: 'How the grid scrolls while a row nears its top or bottom: `{ threshold, speed, curve, smoothing, margin }`.' },
		{ name: 'ignore', type: 'MaybeRefOrGetter<string>', description: 'A selector of what inside a row never starts a drag, on top of links, buttons, fields and other widgets.' },
		{ name: 'getLabel', type: '(row: TRow, key: string) => string', description: 'The name of a row for screen readers; the text of its row header cell by default.' },
		{ name: 'announcements', type: 'MaybeRefOrGetter<Partial<DragAnnouncements>>', description: 'What screen readers hear during a keyboard drag: `instructions`, `pickUp`, `move`, `drop`, `cancel`.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'active', type: 'Readonly<Ref<string | null>>', description: 'The key of the row being dragged from this grid.' },
		{ name: 'dragging', type: 'Readonly<Ref<DragPayload | null>>', description: 'The payload of a row the grid takes, its own or from the group.' },
		{ name: 'item', type: 'Readonly<Ref<GridDragItem | null>>', description: 'What is dragged: `{ key, label, row, source, own }`.' },
		{ name: 'over', type: 'Readonly<Ref<boolean>>', description: 'Whether the pointer is over the body.' },
		{ name: 'allowed', type: 'Readonly<Ref<boolean>>', description: 'Whether it is over a place it may be dropped at.' },
		{ name: 'target', type: 'Readonly<Ref<DragListTarget | null>>', description: 'Where the row goes if dropped now: `{ key, position, parent, index, level }`.' },
		{ name: 'getRow', type: '(key: string) => TRow | undefined', description: 'The shown row with this key.' },
		{ name: 'canDrag', type: '(key: string, row?: unknown) => boolean', description: 'Whether a row may be dragged now.' },
		{ name: 'getLabel', type: '(key: string, row?: unknown) => string', description: 'The name of a row, as screen readers hear it.' },
		{ name: 'setPreview', type: '(render, options?) => () => void', description: 'Fills the ghost under the pointer, as `GridDragPreview` does.' },
		{ name: 'describedBy', type: 'string | undefined', description: 'The id of the hidden keyboard instructions, for `aria-describedby` of a handle.' },
		{ name: 'register', type: '(element: HTMLElement, key: string) => () => void', description: 'Connects the element of a row; `GridRow` calls it.' },
		{ name: 'getItemProps', type: '(key: string, row?: unknown) => Props', description: 'The attributes of a row: `data-dg-draggable` while it may be dragged.' },
	]"
/>

## Examples

### A tree

In a grid with the `tree` feature a row can be dropped before, after or inside another. The
`rowEditing` feature follows the tree's `parentKey` or `childrenField`, and gives the row its new
parent:

```ts
const grid = useDataGrid({
	columns,
	rows: files,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		tree: tree({ parentKey: 'parent' }),
		rowEditing: rowEditing({ onCommit: (commit) => { files.value = commit.rows; } }),
	},
});

useGridRowDrag(grid, { handle: true, canNest: file => file.kind === 'folder' });
```

A group being dragged collapses while it moves, so it is one row under the pointer, and opens again
at its place. A drop into a collapsed group expands it.

### Between two grids

Give both grids the same `group`. With the `rowEditing` feature on both, a row dropped on the other
grid moves from the rows of one to the rows of the other: it is added here first, and leaves the
other grid only once it is. A key this grid has already keeps the row where it was. Without
`rowEditing`, the row arrives with `external: true`, the grid it came from in `source`, and
`change` an `add`:

```ts
useGridRowDrag(todoGrid, {
	group: 'tasks',
	onDrop: (event) => {
		if (event.external) {
			doingRows.value = doingRows.value.filter(task => task.id !== event.key);
		}

		todoRows.value = applyRowChanges(todoRows.value, [event.change], { rowKey: 'id' }).rows;
	},
});
```

### Rows that only leave

With `reorder: false` the grid keeps its order: its rows go only to other grids of the group and to
drop zones, and it needs neither `onDrop` nor `rowEditing` unless it takes rows from the group.

```ts
useGridRowDrag(files, { group: 'files', reorder: false });
```

### Saving the order on a server

Move the row at once and move it back if the server refuses. `useGridMotion` animates both.

```ts
onDrop: async (event) => {
	event.preventDefault();

	const before = rows.value;

	rows.value = applyRowChanges(before, [event.change], { rowKey: 'id' }).rows;

	try {
		await api.reorder(event.key, event.index);
	} catch {
		rows.value = before;
	}
},
```

With `rowEditing`, save its commits instead: see
[saving to a server](/composables/use-grid-row-editing#saving-to-a-server).

## Accessibility

- With `handle`, each row has a `GridDragHandle` button named after its row, `Drag Northern Lights`,
  that drags with the keyboard. The instructions are read with it through `aria-describedby`.
- A keyboard drag announces where the row is at each step in a live region: `Picked up Tidal,
  position 3 of 8.`, then each move, the drop or the cancel. Give `announcements` in your language.
- Alt+↑ and Alt+↓ move a row one place from any of its cells, without a handle.
- The dragged row stays rendered under the row window while the grid scrolls away from it, so its
  handle keeps focus.
- The default engine, `webAnimations()`, plays nothing for a person who prefers reduced motion.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Space', 'Enter'], description: 'On a drag handle, picks the row up; again, drops it.' },
		{ keys: ['↑', '↓'], description: 'Moves the picked-up row one place; in a tree, through the places before, after and inside the rows around it.' },
		{ keys: ['Home', 'End'], description: 'Moves the picked-up row to the first or the last place.' },
		{ keys: ['Escape', 'Tab'], description: 'Cancels the drag; the row stays where it was.' },
		{ keys: ['Alt+↑', 'Alt+↓'], description: 'On a cell, moves its row one place among its siblings at once.' },
	]"
/>

## See also

- [Drag and drop](/guides/drag-and-drop): the guide.
- [Row drag](/components/row-drag): `GridRowDrag` and `GridDragHandle`.
- [Drag preview and overlay](/components/drag-preview) and [Drop zone](/components/drop-zone).
