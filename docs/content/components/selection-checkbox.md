---
title: Selection checkbox
description: The checkboxes that select a row and every row, as native inputs or any checkbox of your design system.
---

# Selection checkbox

<Description>
The checkbox that selects a row, and the one in the header that selects them all: native inputs by
default, or the checkbox of your own design system.
</Description>

<Demo name="part-selection-checkbox" />

## Features

<Highlights
	:features="[
		'Checked, unchecked, or partly checked for a group whose leaves are partly selected.',
		'Shift-click selects every row between the last one toggled and this one.',
		'Disabled for a row the selection refuses with `canSelect`.',
		'A native `input` by default; any element or component with `as` or `asChild`, with the checkbox role and its keys.',
		'The select-all box selects what &quot;all&quot; means: the loaded rows, or every leaf of a tree.',
	]"
/>

## Anatomy

```vue
<script setup lang="ts">
import { GridSelectAllCheckbox, GridSelectionCheckbox } from '@vue-data-grid/core';
</script>

<template>
	<GridSelectAllCheckbox />
	<GridSelectionCheckbox />
</template>
```

Both need the `selection` feature of the grid. The quickest way to put them in a grid is the
[`selectionColumn()`](/components/service-columns): a column with the select-all box in its header
and a row's box in each cell. Place them yourself when you want them anywhere else, or in another
look.

```ts
import { selection, selectionColumn, useDataGrid } from '@vue-data-grid/core';

const columns = defineColumns({
	select: selectionColumn(),
	name: column(person => person.name, { label: 'Name' }),
});

const grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 40, features: { selection: selection() } });
```

## API reference

### GridSelectionCheckbox

The checkbox of one row. A click toggles the row; with <kbd>Shift</kbd> it selects the range from the
row toggled last. The row is its `row` prop, else the `GridRow` around it.

<PropsTable
	:data="[
		{ name: 'row', type: 'string | GridBodyRow', description: 'The row: its key or its body row. The row of the `GridRow` around by default.' },
		{ name: 'label', type: 'string', description: 'The accessible name; the `selectRow` message, &quot;Select row&quot;, by default.' },
		{ name: 'as', type: 'string | Component', default: '\'input\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ selected: boolean; partly: boolean }', description: 'The state, for a checkbox of your own through `asChild`, or content inside an element other than `input`.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['selection-checkbox'] },
		{ attribute: '[data-dg-state]', values: ['checked', 'unchecked', 'indeterminate'] },
		{ attribute: '[data-dg-disabled]', values: 'Present while the selection refuses the row.' },
	]"
/>

### GridSelectAllCheckbox

The checkbox that selects every row, or none: checked while all are selected, partly checked while
some are. It is disabled in the `'single'` selection mode.

<PropsTable
	:data="[
		{ name: 'label', type: 'string', description: 'The accessible name; the `selectAllRows` message, &quot;Select all rows&quot;, by default.' },
		{ name: 'as', type: 'string | Component', default: '\'input\'', description: 'The element or component to render.' },
		{ name: 'asChild', type: 'boolean', default: 'false', description: 'Render the one child of the slot instead, with the props of the part merged into it.' },
	]"
/>

<SlotsTable
	:data="[
		{ name: 'default', scope: '{ selected: boolean; partly: boolean }', description: 'Whether all rows are selected, and whether some are.' },
	]"
/>

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part]', values: ['selection-checkbox'] },
		{ attribute: '[data-dg-state]', values: ['checked', 'unchecked', 'indeterminate'] },
		{ attribute: '[data-dg-disabled]', values: 'Present in the `single` selection mode.' },
	]"
/>

## Examples

### The checkbox of your design system

With `asChild` the part renders the one element of its slot instead of an `input`, and merges its
props into it: the checkbox role, `aria-checked`, the name and the click. The demo uses the checkbox
of [Reka UI](https://reka-ui.com/docs/components/checkbox), driven by the state the slot gets:

```vue
<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui';
</script>

<template>
	<GridSelectionCheckbox v-slot="{ selected, partly }" as-child>
		<CheckboxRoot :model-value="partly ? 'indeterminate' : selected">
			<CheckboxIndicator>
				<IconMinus v-if="partly" />
				<IconCheck v-else />
			</CheckboxIndicator>
		</CheckboxRoot>
	</GridSelectionCheckbox>
</template>
```

The selection owns the state: the Reka checkbox only shows it, so pass `model-value` and leave its
`v-model` out.

### Animating the mark

`CheckboxIndicator` of Reka UI stays mounted while an exit animation of its own plays, and marks
itself with `data-state`, so the check can pop in and out with CSS alone. The demo draws the check
along its stroke and lets the tint of a selected row fade:

```css
.check-mark[data-state='checked'],
.check-mark[data-state='indeterminate'] {
	animation: mark-in 0.22s cubic-bezier(0.2, 0, 0, 1);
}

.check-mark[data-state='unchecked'] {
	animation: mark-out 0.14s ease-in forwards;
}

.check-mark svg {
	stroke-dasharray: 30;
	animation: mark-draw 0.28s 0.04s cubic-bezier(0.2, 0, 0, 1) backwards;
}

.people [data-dg-part='body'] [data-dg-column] {
	transition: background-color 0.2s, box-shadow 0.2s;
}

@keyframes mark-in {
	from { opacity: 0; transform: scale(0.4) rotate(-12deg); }
}

@keyframes mark-out {
	to { opacity: 0; transform: scale(0.4); }
}

@keyframes mark-draw {
	from { stroke-dashoffset: 30; }
}
```

The tint changes through `aria-selected` of the row, so the transition costs no render. Turn the
animations off under `prefers-reduced-motion: reduce`, as the demo does.

### Placing the boxes yourself

In a column of your own, put the select-all box in the header cell and the row's box in the cells
through the slots:

```vue
<GridHeaderCell v-for="header in headers" :key="header.key" v-slot="{ column }" :column="header">
	<GridSelectAllCheckbox v-if="column.name === 'select'" />
	<GridHeaderContent v-else />
</GridHeaderCell>
```

```vue
<GridCells v-slot="{ column }">
	<GridSelectionCheckbox v-if="column.name === 'select'" />
</GridCells>
```

Declare the column as `kind: 'service'`, so CSV, cell ranges and autosize leave it out.

### Rows that cannot be selected

`canSelect` of the selection refuses rows by key. Their boxes are disabled, and "select all" skips
them:

```ts
selection({ canSelect: key => !archived.has(key) })
```

## Accessibility

Adheres to the [Checkbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/) of WAI-ARIA.

- A native `input` is a checkbox already, with `indeterminate` for the partial state. Any other
  element gets `role="checkbox"`, `aria-checked` of `true`, `false` or `mixed`, and `aria-disabled`,
  and is focusable unless it is a `button`, which is.
- Every box is named: "Select row" and "Select all rows" by default, from the grid's messages. Use
  `label` for a name of your own, such as "Select Ava Kim".
- The rows themselves get `aria-selected`, and the grid `aria-multiselectable` in the `'multiple'`
  mode, so a screen reader hears the selection on the row as well as on the box.
- The live region of [`GridRoot`](/components/root) announces how many rows are selected whenever
  that changes.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Space'], description: 'On the box: toggles its row, or every row. On a cell whose only content is the box, with the `navigation` feature: the same.' },
		{ keys: ['Shift+Space'], description: 'With the `navigation` feature, on any cell: toggles the row of the cell.' },
		{ keys: ['Ctrl+A'], description: 'With the `navigation` feature: selects every row.' },
	]"
/>

<kbd>Enter</kbd> on the box does nothing, as the checkbox pattern says: it is left to forms.
