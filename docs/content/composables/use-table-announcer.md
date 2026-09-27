---
title: useTableAnnouncer
description: What a table tells a screen reader on its own - the sort, the selection and loading - and anything else you want it to say.
---

# useTableAnnouncer

<Description>
What a table tells a screen reader on its own: the whole sort when it changes, the number of
selected rows, and that it is loading. It gives the text of a polite live region, and a way to say
anything else through it.
</Description>

<Demo name="api-use-table-announcer" />

The panel shows the text of the live region as it changes. Sort by one column, then add another
with <kbd>Shift</kbd>, select rows, or export the selection.

`TableRoot` uses it for you and renders the live region next to the table. Call it yourself to
render the region in markup of your own, or to announce the results of your own actions. Here the
table has `:announce="false"`, so the region of the demo is the only one.

## Usage

```vue
<script setup lang="ts">
import { useTableAnnouncer } from '@vue-data-grid/core';

const { message, announce } = useTableAnnouncer(table);

function archive() {
	announce('3 rows archived');
}
</script>

<template>
	<TableRoot :table="table" label="Invoices" :announce="false">…</TableRoot>
	<div role="status" aria-live="polite" class="visually-hidden">{{ message }}</div>
</template>
```

Keep one live region per table. Two regions saying the same thing make a screen reader say it twice.

## Arguments

<PropsTable
	label="Argument"
	:data="[
		{ name: 'table', type: 'Pick<DataTable, \'scope\' | \'selection\' | \'isBusy\'>', required: true, description: 'The table: its sort from `scope`, its `selection` when it has one, and whether it is busy.' },
		{ name: 'messages', type: 'MaybeRefOrGetter<TableMessages>', default: 'DEFAULT_MESSAGES', description: 'The words of the announcements: `sorted`, `selected` and `loading`.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'message', type: 'ShallowRef<string>', description: 'The text of the live region. A message repeated right after itself changes slightly, so the screen reader reads it again.' },
		{ name: 'announce', type: '(text: string) => void', description: 'Says anything through the same region, such as the result of an action.' },
	]"
/>

## What it announces

| When | Message | Default text |
| --- | --- | --- |
| The sort changes | `sorted(sort)` | "Sorted by Team ascending, then Salary descending", or "Not sorted" |
| The number of selected rows changes | `selected(count)` | "1 row selected", "12 rows selected" |
| The table becomes busy | `loading` | "Loading…" |

The sort is announced whole because ARIA cannot say it: `aria-sort` goes on the header of the first
sort column only, and has no levels for the others.

## Examples

### In another language

Pass the messages of `TableRoot`, or a getter of them when the language can change:

```ts
const announcer = useTableAnnouncer(table, () => ({ ...DEFAULT_MESSAGES, ...messages[locale.value] }));
```

### After a paste

The editing reports what a write did; tell it when cells were left alone:

```ts
editing({
	onCommit,
	onWrite: (result) => {
		if (result.skipped.length > 0) {
			announce(`${result.skipped.length} read-only cells were left as they were`);
		}
	},
});
```

## Accessibility

- The region is `role="status"` with `aria-live="polite"`: announcements wait until the screen
  reader finishes what it is saying, rather than cutting it short.
- Hide the region from sight, not from assistive technology: clip it to a pixel as the structural
  styles do for `[data-dg-part="announcer"]`, never `display: none`, which silences it.
- Announce outcomes, not every step: a count after a selection, not each checkbox.

## See also

- [Messages](/composables/messages): every string of the interface.
- [Root](/components/root): the live region `TableRoot` renders.
- [Accessibility](/overview/accessibility)
