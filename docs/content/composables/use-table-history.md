---
title: useTableHistory
description: Undo and redo of the edits of a table, with Ctrl+Z and Ctrl+Y, that survive sorting and live data.
---

# useTableHistory

<Description>
Undo and redo of the edits of a table. Every commit is one step, a whole paste or fill included,
and a step never overwrites a cell that changed since.
</Description>

<Demo name="api-use-table-history" />

Edit a few cells, paste over a range or clear one with <kbd>Delete</kbd>, then undo with
<kbd>Ctrl</kbd>+<kbd>Z</kbd> or the button. The list on the side is `history.steps`, the last step
on top.

## Usage

```ts
import { editing, history, useDataTable } from '@vue-stack/table';

const table = useDataTable({
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
<UiButton :disabled="!table.history.canUndo.value" @click="table.history.undo()">Undo</UiButton>
<UiButton :disabled="!table.history.canRedo.value" @click="table.history.redo()">Redo</UiButton>
```

The `history` feature needs `editing`: without it the table does not compile, and
`useTableHistory` throws when called by hand.

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
		{ name: 'steps', type: 'ComputedRef<readonly ChangeStep[]>', description: 'The steps undo goes through, the last one last: `{ source, edits }`, each edit `{ key, column, before, after }`.' },
		{ name: 'undo', type: '() => CellWriteResult | null', description: 'Undoes the last step; `null` with nothing to undo.' },
		{ name: 'redo', type: '() => CellWriteResult | null', description: 'Redoes the last undone step; `null` with nothing to redo.' },
		{ name: 'clear', type: '() => void', description: 'Forgets every step, such as after loading another data set.' },
	]"
/>

## Examples

### Steps that survive the data

A step holds its cells by row key and column, not by position, so it still finds them after a sort
or with rows streaming in. It keeps the values, not the rows.

Undo writes back the value a step replaced only while the cell still holds what the step left
there. A cell that changed since — by a stream, the server or another person — is skipped rather
than overwritten with an old value, and listed in the result's `skipped`:

```ts
const result = table.history.undo();

if (result && result.skipped.length > 0) {
	toast(`${result.skipped.length} cells changed since and were kept`);
}
```

### Undo and redo in `onCommit`

Undo and redo are commits too, with the sources `undo` and `redo`, so `onCommit` saves them the same
way as any edit. They are not steps themselves.

### Starting over

After loading another data set, the old steps point at rows that are gone. Clear them:

```ts
watch(project, async (next) => {
	rows.value = await api.rows(next);
	table.history.clear();
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
- [useTableEditing](/composables/use-table-editing): the commits the steps come from.
- [The core](/composables/core): `useChangeHistory`, the model under this composable.
