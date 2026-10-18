---
title: useGridRowEditing
description: Adding, updating, removing and moving the rows of a grid by key — in a flat list or a tree, as commits you apply to your rows.
---

# useGridRowEditing

<Description>
Adding, updating, removing and moving the rows of a grid by key, in a flat list or a tree: the
twin of cell editing for rows. A write never touches your rows — you get a commit and apply it.
</Description>

<Demo name="api-use-grid-row-editing" />

Focus a row and add a task after it, or remove it; drag a row by its handle. Each is one commit,
and the line above the grid shows the last one.

## Usage

Add the `rowEditing` feature with an `onCommit` that writes a commit into your rows, and write
changes through `grid.rowEditing`:

```ts
import { navigation, rowEditing, useDataGrid } from '@vue-data-grid/core';
import { shallowRef } from 'vue';

const rows = shallowRef<readonly Task[]>(tasks);

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		navigation: navigation(),
		rowEditing: rowEditing({
			onCommit: (commit) => {
				rows.value = commit.rows;
			},
		}),
	},
});

function addAfterFocused() {
	grid.rowEditing.write([{ type: 'add', row: createTask(), after: grid.navigation.cells.focused.value?.key ?? null }], 'add');
}
```

The feature works on the source rows, the ones you give the grid, before sorting and the tree, by
the grid's `rowKey`. With the `tree` feature it follows the tree's `parentKey` or `childrenField`,
and gives a row a new parent through its `setParent`.
A [row drag](/composables/use-grid-row-drag) moves its rows through it, as a commit from `'drop'`,
unless its `onDrop` calls `event.preventDefault()`. `useGridRowEditing(grid, options)` is the same outside `useDataGrid`, over
`useRowEditing` of the core.

## Changes

A write takes changes of rows by key, applied in order, each on the rows the ones before it left.
Every row a change does not touch stays the same object.

| Change | Does |
| --- | --- |
| `{ type: 'add', row, ...place, existing? }` | Adds a row at a place, the last at the top level by default. A key that is there skips the change, unless `existing` is `'replace'`: then the row replaces that one where it stands. |
| `{ type: 'update', row, expected? }` | Replaces the row with the same key, in place. |
| `{ type: 'remove', key, expected?, subtree? }` | Removes a row, and the rows under it in a tree. |
| `{ type: 'move', key, row?, expected?, from?, ...place }` | Moves a row, and the rows under it in a tree. `row` puts another object for it, such as a copy with a new field. |

A place is:

- `{ before: key }` or `{ after: key }`: next to a row, under its parent. A neighbour that is
  `null` counts as none, so `{ after: focusedKey }` adds after the focused row, or without one where
  `parent` and `index` say.
- `{ parent, index }`: the `index`-th child of `parent` once the row is taken out, the last one
  without `index`. A drop of a row says such a place, and `event.change` is the change of the drop.
  `parent` left out keeps the row's parent; `null` is the top level, which also holds rows whose
  parent is no row, as the tree shows them.

A change that does not apply is skipped and comes back in `skipped`: its key or neighbour is
unknown, an add finds its key there already, its row is no longer `expected`, under `from` or over
`subtree`, its parent in a nested tree is no row, or it would move a row into its own subtree.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'onCommit', type: '(commit: RowCommit<TRow>) => void', required: true, description: 'Writes a commit into your rows, such as `rows.value = commit.rows`. The grid shows the new rows once your rows have them.' },
		{ name: 'onBeforeCommit', type: '(request: { changes, source }) => RowChange[] | false | void', description: 'Called before every commit with the changes that apply: return the changes to commit instead, such as with some left out, or `false` to commit none.' },	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'write', type: '(changes: RowChange[], source: string) => RowWriteResult', description: 'Writes changes as one commit from `source`: `{ source, commit, skipped }`. `commit` is `null` when nothing changed or `onBeforeCommit` refused it.' },
		{ name: 'lastCommit', type: 'Readonly<Ref<RowCommit | null>>', description: 'The last commit written; `null` before the first.' },
	]"
/>

A commit has the changes it made, their `source`, the new `rows`, and `undo`, the changes that put
the rows back, each guarded by `expected`, `from` or `subtree` so that it is skipped once its row
changed again: the undo of an add never takes rows that came under the added row since.
`commit.rows` are your rows with the commit; `commit.apply(rows)` applies the changes to another
array, for a commit written later than it was made.

Every write has a `source`: `add`, `remove`, `move`, `drop`, `paste`, `undo`, `redo`, or a name of
your own. It reaches `onBeforeCommit` and `onCommit`, so you can treat a drop differently from a
button.

## Examples

### A tree

With `parentKey`, a row given a new parent gets it in that field, or through the `setParent` of the
tree when `parentKey` is a function. With `childrenField`, a row moves from one children array to
another, and only the rows above a change become new objects:

```ts
const grid = useDataGrid({
	columns,
	rows: folders,
	rowKey: 'id',
	rowHeight: 36,
	features: {
		tree: tree({ childrenField: 'children' }),
		rowEditing: rowEditing({ onCommit: (commit) => { folders.value = commit.rows; } }),
	},
});

grid.rowEditing.write([{ type: 'add', row: { id: 'drafts', name: 'Drafts', children: [] }, parent: 'docs', index: 0 }], 'add');
grid.rowEditing.write([{ type: 'move', key: 'report', parent: 'drafts' }], 'move');
```

In a nested tree the children of a row change only through changes of their own: an update takes
the fields of the new row and keeps the children the tree has.

### Saving to a server

Apply the commit at once and save it in the background; write its `undo` if the server says no.
The undo is a commit too, and the server never had the changes it takes back: do not save it.

```ts
rowEditing({
	onCommit: async (commit) => {
		rows.value = commit.rows;

		if (commit.source === 'undo') {
			return;
		}

		try {
			await api.saveRows(commit.changes);
		} catch {
			grid.rowEditing.write(commit.undo, 'undo');
		}
	},
});
```

### Rows from a stream

With rows a [`useRowStream`](/composables/core#streaming-rows) keeps, write a commit into the stream,
and flush it, so that the next write starts from the rows with it:

```ts
const stream = useRowStream({ rowKey: 'id' });

const grid = useDataGrid({
	columns,
	rows: stream.rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		rowEditing: rowEditing({
			onCommit: (commit) => {
				stream.apply(commit.changes);
				stream.flush();
			},
		}),
	},
});
```

### Refusing some changes

```ts
rowEditing({
	onCommit,
	onBeforeCommit: ({ changes, source }) => (source === 'drop'
		? changes.filter(change => change.type !== 'move' || change.key !== 'pinned')
		: undefined),
});
```

## Accessibility

- A write changes your rows, and the grid renders them: rows keep their keys, so focus, selection
  and measured heights stay on the rows they were on.
- Give the controls that add and remove rows a name and put them next to the grid, as the demo
  does, so the changes do not need a pointer or a drag.

## See also

- [useGridRowDrag](/composables/use-grid-row-drag): drops of dragged rows, which go through this
  feature.
- [Trees and grouping](/guides/trees-and-grouping): the trees the changes follow.
- [The core](/composables/core): `applyRowChanges` and `useRowEditing`, the model under this
  composable.
