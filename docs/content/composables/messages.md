---
title: Messages
description: Every string of the table's interface - control names, states and announcements - and how to give your own.
---

# Messages

<Description>
Every string the table shows or says: the names of its controls, the empty and loading states, and
what it announces to screen readers. English by default; give <code>TableRoot</code> your own for any language.
</Description>

## Usage

```vue
<script setup lang="ts">
import type { TableMessages } from 'vue-data-grid';

const messages: Partial<TableMessages> = {
	empty: 'Nothing here yet',
	selectRow: 'Pick this invoice',
	selected: count => `${count} invoices picked`,
};
</script>

<template>
	<TableRoot :table="table" label="Invoices" :messages="messages">…</TableRoot>
</template>
```

`messages` is laid over `DEFAULT_MESSAGES`, so you give only the strings you change. `TableRoot` reads
it once: to switch the language of a mounted table, give `TableRoot` a new `key`.

## The messages

<PropsTable
	label="Message"
	:data="[
		{ name: 'selectRow', type: 'string', default: '\'Select row\'', description: 'The name of a row\'s selection checkbox, unless it has a `label` of its own.' },
		{ name: 'selectAllRows', type: 'string', default: '\'Select all rows\'', description: 'The name of the select-all checkbox.' },
		{ name: 'expandRow', type: 'string', default: '\'Expand\'', description: 'The name of a tree toggle of a collapsed row.' },
		{ name: 'collapseRow', type: 'string', default: '\'Collapse\'', description: 'The name of a tree toggle of an expanded row.' },
		{ name: 'expandGroup', type: '(label: string) => string', default: 'Expand ${label}', description: 'The name of a collapsed column group\'s toggle.' },
		{ name: 'collapseGroup', type: '(label: string) => string', default: 'Collapse ${label}', description: 'The name of an expanded column group\'s toggle.' },
		{ name: 'resizeColumn', type: '(label: string) => string', default: 'Resize ${label}', description: 'The name of a column\'s resize handle.' },
		{ name: 'columnWidth', type: '(width: number) => string', default: '${width} px', description: 'The width of a column as a resize handle says it, `aria-valuetext`.' },
		{ name: 'dragRow', type: '(label: string) => string', default: 'Drag ${label}', description: 'The name of a row\'s drag handle, from the name of the row.' },
		{ name: 'empty', type: 'string', default: '\'No rows\'', description: 'The content of `TableEmpty` without a slot.' },
		{ name: 'loading', type: 'string', default: '\'Loading…\'', description: 'The content of `TableLoading` without a slot, and what the announcer says when the table becomes busy.' },
		{ name: 'noMatches', type: 'string', default: '\'No matches\'', description: 'The list of `selectEditor` when no choice matches what was typed.' },
		{ name: 'sorted', type: '(sort: readonly SortMessageItem[]) => string', default: '\'Sorted by …\'', description: 'Announced when the sort changes: each column\'s `label` and `direction`, an empty list when the sort is cleared.' },
		{ name: 'selected', type: '(count: number) => string', default: '\'1 row selected\'', description: 'Announced when the number of selected rows changes.' },
	]"
/>

The messages that depend on a label or a number are functions, so every language can put the words
in its own order and use its own plural forms.

## DEFAULT_MESSAGES

The English defaults, frozen. Use them to build a full set of your own, or to call a message outside
a table:

```ts
import { DEFAULT_MESSAGES } from 'vue-data-grid';

DEFAULT_MESSAGES.sorted([{ label: 'Price', direction: 'desc' }]);
// 'Sorted by Price descending'
```

## In parts of your own

A part inside `TableRoot` reads the messages of its table from the context, the same way the
built-in parts do; outside a table it gets the defaults:

```ts
import { useTableMessagesContext } from 'vue-data-grid';

const messages = useTableMessagesContext();

const label = computed(() => (collapsed.value ? messages.expandRow : messages.collapseRow));
```

`createTableMessagesContext(messages)` provides a set to the parts below, as `TableRoot` does, for
parts under markup of your own.

## Examples

### Plural forms

Languages with more than one plural form fit in the functions, with `Intl.PluralRules`:

```ts
const plural = new Intl.PluralRules('ru');
const ROWS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: 'строка выбрана', few: 'строки выбраны', many: 'строк выбрано' };

const messages: Partial<TableMessages> = {
	selected: count => `${count} ${ROWS[plural.select(count)] ?? 'строки выбрано'}`,
};
```

### Drag announcements

Dragging speaks through `@vue-data-grid/drag-and-drop`, whose words are the `announcements` of
`TableRowDrag` and `TableColumnDrag`, next to these messages.

## Accessibility

- Messages are most of what a screen reader hears from the table beyond the data: names of controls,
  their states and the announcements. Translate them with the rest of the interface.
- Keep control names short and specific: "Select row" for a checkbox in a row is enough, since the
  screen reader also reads the row header next to it.
- The width a resize handle reports is a message too, `columnWidth`, so the unit can be spoken in
  the reader's language.

## See also

- [Localization](/guides/localization): languages, formats and right-to-left.
- [useTableAnnouncer](/composables/use-table-announcer): the announcements.
- [Contexts](/composables/contexts): the other contexts of the parts.
