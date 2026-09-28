---
title: Drag preview and overlay
description: The ghost that follows the pointer during a drag, and the message over a grid a row can be dropped on.
---

# Drag preview and overlay

<Description>
The ghost that follows the pointer while a row or a column is dragged, and the message over a grid
that says a row can be dropped on it.
</Description>

<Demo name="part-drag-preview" />

## Features

<Highlights
	:features="[
		'The ghost is a template of yours, rendered through a teleport: its context, `provide` and reactivity work as anywhere in your component.',
		'It stands outside the pointer, under it or where the item was grabbed, and fades or flies into the item\'s new place.',
		'The overlay shows over a grid only while a row it can take is dragged from elsewhere.',
		'The overlay\'s slot knows the item, the grid it comes from, and whether the pointer is over an allowed place.',
		'Both are laid out by the structural styles; restyle them into a card, a banner or a badge.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { GridDragOverlay, GridDragPreview, GridRowDrag } from '@vue-data-grid/core/drag-and-drop';
</script>

<template>
	<GridRowDrag group="sprint" @drop="drop">
		<GridBody />
		<GridDragPreview />
		<GridDragOverlay />
	</GridRowDrag>
</template>
```

Put both inside a `GridRowDrag` or a `GridColumnDrag`. They render nothing in place: the preview
renders into the ghost, and the overlay appears over the body only during a drag.

## API reference

### GridDragPreview

The ghost of a drag, as a template. Without a slot it shows the label of the item. It renders
nothing in place.

<PropsTable
	:data="[
		{ name: 'for', type: '\'rows\' | \'columns\'', description: 'What it is the ghost of; the rows when both drag, else what drags.' },
		{ name: 'placement', type: '\'outside\' | \'center\' | \'source\'', default: '\'outside\'', description: 'Where it stands: beside the pointer, centred under it, or where the item was grabbed.' },
		{ name: 'exit', type: '\'fade\' | \'land\' | \'none\'', default: '\'fade\'', description: 'How it goes at the end of the gesture: fades where it is, flies into the item at its new place, or goes at once.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component inside the ghost.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ key: string; label: string; row: unknown; column?: RuntimeColumn }', description: 'The key of the row or the name of the column, its name as screen readers hear it, and the row or the column itself.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['drag-preview'] },
	]"
/>

The ghost lives outside the grid, so the grid's theme variables do not reach it: style it on its
own, by `[data-dg-part="drag-preview"]` or by a class on the content of its slot. The part renders
through a teleport, so a class on `GridDragPreview` itself does not reach the ghost.

### GridDragOverlay

A message over the part of the body in view while an item the grid takes is dragged: "you can drop
here", and another once the pointer is over the grid. By default it shows for rows that come from
another grid of the group, and for columns always.

<PropsTable
	:data="[
		{ name: 'for', type: '\'rows\' | \'columns\'', description: 'What it shows the drag of; the rows when both drag.' },
		{ name: 'own', type: 'boolean', description: 'Show while an item of this very grid is dragged too; `false` for rows and `true` for columns by default.' },
		{ name: 'when', type: '(context) => boolean', description: 'Whether to show for what is dragged, instead of the default rule; it gets the context of the slot.' },
		{ name: 'forceMount', type: 'boolean', default: 'false', description: 'Stay rendered while nothing is shown, with `data-dg-state=&quot;idle&quot;` and no slot, for animations of your own.' },
		{ name: 'as', type: 'string | Component', default: '\'div\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ key, label, row, column, source, own, over, allowed }', description: 'The item and the grid it comes from, whether it is this grid, whether the pointer is over the body, and whether over a place it may be dropped at.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['drag-overlay'] },
		{ attribute: '[data-dg-state]', values: ['ready', 'over', 'refused', 'idle'] },
	]"
/>

<CssVariablesTable
	:data="[
		{ name: '--dg-view-top', description: 'Set on the overlay: how far the grid is scrolled down, px.' },
		{ name: '--dg-view-left', description: 'How far it is scrolled across, px.' },
		{ name: '--dg-view-width', description: 'The width of the view, px.' },
		{ name: '--dg-view-height', description: 'The height of the view, px.' },
		{ name: '--dg-head-height', description: 'The height of the sticky header, which the overlay starts below.' },
		{ name: '--dg-foot-height', description: 'The height of the sticky footer, which it ends above.' },
		{ name: '--dg-drop-color', default: 'Highlight', description: 'The dashed outline of the overlay, solid while the pointer is over it.' },
	]"
/>

## Examples

### A ghost that looks like a card

The slot of the preview renders anything, and reads from your component as any template does. The
demo shows the assignee, the title and the estimate of the task:

```vue
<GridDragPreview v-slot="{ key, label }">
	<span class="card">
		<UiAvatar :name="findTask(key)?.assignee ?? label" />
		<strong>{{ label }}</strong>
		<span>{{ findTask(key)?.estimate }} pts</span>
	</span>
</GridDragPreview>
```

### A ghost that lands

For a ghost that looks like the row itself, start it where the row was grabbed and let it fly into
the row's new place:

```vue
<GridDragPreview placement="source" exit="land" />
```

### One message for each state

The slot of the overlay knows whether the pointer is over an allowed place, and which grid the row
comes from:

```vue
<GridDragOverlay v-slot="{ over, allowed, source }">
	<span v-if="over && !allowed">Not here</span>
	<span v-else-if="source === archive">Restore from the archive</span>
	<span v-else>Drop to move to this sprint</span>
</GridDragOverlay>
```

## Accessibility

- The ghost and the overlay are for the eyes. A keyboard drag has no pointer to follow: a live region
  says where the row is instead, and the place shows in the grid.
- The overlay lets the pointer through, so the drag goes on over the rows under it, and it takes no
  focus.
- The ghost lives outside the grid, so it never adds a row or a cell to what assistive
  technology counts.
