---
title: useGridHistory
description: Undo and redo of the edits and row changes of a grid, with Ctrl+Z and Ctrl+Y, that survive sorting and live data.
---

# useGridHistory

<Description>
Undo and redo of the edits of a grid's cells and the changes of its rows, in one stack. Every
commit is one step, a whole paste, fill or drop included, and a step never overwrites a cell or a
row that changed since.
</Description>

<Demo name="api-use-grid-history" />

Edit a few cells, paste over a range or clear one with <kbd>Delete</kbd>, then undo with
<kbd>Ctrl</kbd>+<kbd>Z</kbd> or the button. The list on the side is `history.steps`, the last step
on top.

## Usage

```ts
import { editing, history, useDataGrid } from '@vue-data-grid/core';

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		editing: editing({
			onCommit: (commit) => {
				rows.value = commit.apply(rows.value);
			},
		}),
		history: history({ limit: 50 }),
	},
});
```

```vue
<UiButton :disabled="!grid.history.canUndo.value" @click="grid.history.undo()">Undo</UiButton>
<UiButton :disabled="!grid.history.canRedo.value" @click="grid.history.redo()">Redo</UiButton>
```

The `history` feature records the commits of `editing`, of
[`rowEditing`](/composables/use-grid-row-editing), or of both in one stack: an edit of a cell, then
the removal of its row, undo in reverse order. It needs one of them: without either the grid does
not compile, and `useGridHistory` throws when called by hand.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'limit', type: 'MaybeRefOrGetter<number>', default: '100', description: 'How many steps undo keeps; `0` keeps none.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Whether the keys undo and redo. The steps are recorded either way.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'canUndo', type: 'ComputedRef<boolean>', description: 'Whether there is a step to undo.' },
		{ name: 'canRedo', type: 'ComputedRef<boolean>', description: 'Whether there is an undone step to redo.' },
		{ name: 'steps', type: 'ComputedRef<readonly ChangeStep[]>', description: 'The steps undo goes through, the last one last: `{ kind: \'cells\', source, edits }`, each edit `{ key, column, before, after }`, or `{ kind: \'rows\', source, changes }`.' },
		{ name: 'undo', type: '() => ChangeReplay | null', description: 'Undoes the last step: `{ kind: \'cells\', step, result }` or `{ kind: \'rows\', step, results }`, a write result for each grid; `null` with nothing to undo.' },
		{ name: 'redo', type: '() => ChangeReplay | null', description: 'Redoes the last undone step; `null` with nothing to redo.' },
		{ name: 'clear', type: '() => void', description: 'Forgets every step, such as after loading another data set.' },
	]"
/>

## Examples

### Steps that survive the data

A step holds its cells by row key and column, not by position, so it still finds them after a sort
or with rows streaming in. It keeps the values, not the rows.

Undo writes back the value a step replaced only while the cell still holds what the step left
there. A cell that changed since — by a stream, the server or another person — is skipped rather
than overwritten with an old value, and listed in the result's `skipped`. A step of rows works the
same way: a row changed since keeps its change, and a row added by the step stays once other rows
came under it.

```ts
const replay = grid.history.undo();

if (replay?.kind === 'cells' && replay.result.skipped.length > 0) {
	toast(`${replay.result.skipped.length} cells changed since and were kept`);
}
```

### One history for grids that share rows

Rows dragged between the grids of a `group` leave one grid and join another: two commits. Give the
grids one history with `useGridHistory`, and a drop is one step that Ctrl+Z on either grid undoes,
putting the row back where it was:

```ts
function createGrid(rows: ShallowRef<readonly Task[]>) {
	return useDataGrid({
		columns,
		rows,
		rowKey: 'id',
		rowHeight: 40,
		features: {
			rowEditing: rowEditing({ onCommit: (commit) => { rows.value = commit.rows; } }),
		},
	});
}

const backlog = createGrid(backlogRows);
const sprint = createGrid(sprintRows);
const history = useGridHistory([backlog, sprint]);
```

Leave the `history` feature off both grids: with a history each, each would undo only its half of a
drop.

### Undo and redo in `onCommit`

Undo and redo are commits too, with the sources `undo` and `redo`, so `onCommit` saves them the same
way as any edit. They are not steps themselves.

### Starting over

After loading another data set, the old steps point at rows that are gone. Clear them:

```ts
watch(project, async (next) => {
	rows.value = await api.rows(next);
	grid.history.clear();
});
```

## Accessibility

- Undo and redo work from any focused cell, with the shortcuts people know.
- In an open editor the keys stay the editor's, for its own text, so Ctrl+Z undoes typing first.
- A step writes through the editing like any edit: the cells it writes are checked by `validate`.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Ctrl+Z'], description: 'Undoes the last step.' },
		{ keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], description: 'Redoes the last undone step.' },
	]"
/>

On macOS <kbd>⌘</kbd>+<kbd>Z</kbd> undoes and <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redoes.

## See also

- [Editing](/guides/editing): the guide.
- [useGridEditing](/composables/use-grid-editing) and [useGridRowEditing](/composables/use-grid-row-editing): the commits the steps come from.
- [The core](/composables/core): `useChangeHistory`, the model under this composable.
