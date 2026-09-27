---
title: Task board
description: Two tables that trade rows by drag and drop, a bin to archive into, and rows that glide into place.
pageClass: site-wide
aside: false
---

# Task board

<Description>
A sprint and a backlog as two tables that trade tasks by drag and drop, a bin outside both to
archive into, and rows that glide into their new places. One array of tasks feeds both tables.
</Description>

<Demo name="example-task-board" />

## What it shows

- Two tables in one drag group take each other's rows: [Drag and drop](/guides/drag-and-drop),
  [Row drag](/components/row-drag).
- A column of grips that also drag with the keyboard, from `dragHandleColumn()`:
  [Service columns](/components/service-columns).
- A card that follows the pointer, and a message over the table a row can go to:
  [Drag preview and overlay](/components/drag-preview).
- A bin that is not a table at all: [Drop zone](/components/drop-zone).
- Rows that move, come and go with `useTableMotion`, whatever moved them: [Animation](/guides/animation).
- Buttons on every row, so each move also works without dragging.

Take a task by its grip and drop it anywhere in the other table, or on the bin at the bottom. The
sprint counts its points against a capacity of 28 as you go.

## How it works

### One list, two tables

The board keeps one array of tasks. Each task says which list it is in, and the two tables show the
two slices of it:

```ts
const tasks = shallowRef<readonly BoardTask[]>(createBoard());

const sprint = computed(() => tasks.value.filter(task => task.list === 'sprint'));
const backlog = computed(() => tasks.value.filter(task => task.list === 'backlog'));
```

A drop, from either table and to either table, is then one move in that array. `moveRow` from the
core does it: `parentKey` names the field that holds the list, so the row goes `index`-th among the
tasks of its new list, and gets its new `list` as a new object:

```ts
function move(list: ListName, key: string, index: number) {
	const task = tasks.value.find(item => item.id === key);

	if (task) {
		tasks.value = moveRow(tasks.value, { key, row: task, parent: list, index }, { rowKey: 'id', parentKey: 'list' });
	}
}
```

The tables never change your data themselves. A drop only tells you where the row should go, and
the table shows the result once your rows have it.

### A table that takes rows from its group

Each list is a `TaskTable` component with its own `useDataTable`. `TableRowDrag` around the body
makes the rows draggable; tables with the same `group` accept each other's rows, and a table in a
group lets the ghost leave its bounds so it can reach the other one:

```vue
<TableRowDrag group="tasks" handle @drop="drop">
	<TableBody v-slot="{ rows }">
		<TableRow v-for="row in rows" :key="row.key" :row="row">
			<TableCells />
		</TableRow>
	</TableBody>
</TableRowDrag>
```

`handle` makes the grip the only place a drag starts, so a click on the rest of the row stays a
click. The grips come from `dragHandleColumn()`, a service column pinned to the start; CSV,
autosize and cell ranges leave it out.

The `drop` event carries the key of the row, its `index` in this table and whether it came from
another one. The component passes the key and the index up, and the board moves the task.

### The ghost and the message

`TableDragPreview` is the card that follows the pointer. It is a template rendered into the ghost,
so it can be any component of yours; here it looks the task up by the key it gets:

```vue
<TableDragPreview v-slot="{ key, label }">
	<TaskGhost :label="label" :task="tasksByKey.get(key)" />
</TableDragPreview>
```

`TableDragOverlay` lays a message over the part of the body in view while a row that can come here
is dragged from the other table. It gets the label of the row and whether the pointer is already
over the table:

```vue
<TableDragOverlay v-slot="{ label, over }">
	{{ over ? `Drop “${label}” into ${title}` : `Move to ${title}` }}
</TableDragOverlay>
```

### The bin

`TableDropZone` is a drop target that is not a table. It takes rows of the tables in its `group`,
emits `drop` with the key of the row, and describes itself with `data-tc-state`, which the styles
use to tint it while a task is on its way:

```vue
<TableDropZone v-slot="{ ready, over }" group="tasks" @drop="event => archive(event.key)">
	<template v-if="over">Release to archive the task</template>
	<template v-else-if="ready">Drop a task here to archive it</template>
</TableDropZone>
```

```css
.board-bin[data-tc-state='ready'] {
	border-color: var(--ui-warn);
}

.board-bin[data-tc-state='over'] {
	border-style: solid;
	border-color: var(--ui-down);
}
```

### Motion

Each table calls `useTableMotion(table)` once. From then on every change of its rows animates: a
task that moves within the table slides to its new place, one that comes from the other table fades
in, and one that leaves, to the other table or the bin, fades out where it stood.

## Accessibility

- Each table is a grid of its own with its title as the accessible name, and one Tab stop: the
  arrow keys move through its cells, as on the [keyboard navigation](/guides/keyboard-navigation)
  page.
- A grip is a button named after its task, such as "Drag Audit colour contrast", and points at
  hidden instructions for the keyboard drag. Every step of a keyboard drag is announced through a
  live region: the task picked up, each place it passes and where it lands.
- A keyboard drag moves a task within its own table. Moving it to the other list or archiving it
  is a button at the end of each row, named after the task, so nothing on the board needs a pointer.
- The owner avatar is decoration; the name of the owner is in the cell as visually hidden text.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'F2'], description: 'On the grip cell: moves focus onto the grip. On the actions cell: moves focus onto its first button; Tab goes to the second.' },
		{ keys: ['Space', 'Enter'], description: 'On a focused grip: picks the task up, and drops it where it is now.' },
		{ keys: ['↑', '↓'], description: 'While a task is picked up: moves it one place up or down.' },
		{ keys: ['Home', 'End'], description: 'While a task is picked up: moves it to the first or the last place.' },
		{ keys: ['Escape', 'Tab'], description: 'Cancels the drag and puts the task back.' },
		{ keys: ['Alt+↑', 'Alt+↓'], description: 'On any cell of a row: moves the task one place at once, without picking it up.' },
	]"
/>
