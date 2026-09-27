---
title: Localization
description: The strings of the table in any language, values formatted for the reader, and tables that read from right to left.
---

# Localization

<Description>
A table speaks in three places: the names of its controls, what it announces to screen readers, and
the values in its cells. The first two come from its messages, the third from the formats of your
columns, and the whole layout turns around for languages written from right to left.
</Description>

<Demo name="localization" />

Switch between English, German, Russian, Kazakh and Arabic, then sort, select or resize: the
checkboxes, the handles and the announcements speak the new language, dates and money follow its
conventions, and Arabic lays the whole table out from right to left.

## The messages

Every string the table itself shows or says is a message: the names of its checkboxes, toggles and
handles, the empty and loading states, and the announcements. Pass your own to `TableRoot` as
`messages`, over the English defaults:

```vue
<TableRoot :table="table" label="Mitarbeiter" :messages="germanMessages">
```

```ts
import type { TableMessages } from '@vue-data-grid/core';

const germanMessages: Partial<TableMessages> = {
	selectRow: 'Zeile auswählen',
	selectAllRows: 'Alle Zeilen auswählen',
	empty: 'Keine Zeilen',
	loading: 'Wird geladen…',
	selected: count => (count === 1 ? '1 Zeile ausgewählt' : `${count} Zeilen ausgewählt`),
};
```

`messages` takes only what you want to change; the rest stays English. `DEFAULT_MESSAGES` holds all of
them, handy to see what there is or to build a language on top of.

<PropsTable
	label="Message"
	:data="[
		{ name: 'selectRow', type: 'string', default: '\'Select row\'', description: 'The name of a row\'s checkbox.' },
		{ name: 'selectAllRows', type: 'string', default: '\'Select all rows\'', description: 'The name of the select-all checkbox.' },
		{ name: 'expandRow', type: 'string', default: '\'Expand\'', description: 'The name of a tree toggle of a collapsed row.' },
		{ name: 'collapseRow', type: 'string', default: '\'Collapse\'', description: 'The name of a tree toggle of an expanded row.' },
		{ name: 'expandGroup', type: '(label: string) => string', description: 'The name of the toggle of a collapsed column group.' },
		{ name: 'collapseGroup', type: '(label: string) => string', description: 'The name of the toggle of an expanded column group.' },
		{ name: 'resizeColumn', type: '(label: string) => string', description: 'The name of a resize handle, from the column\'s label.' },
		{ name: 'columnWidth', type: '(width: number) => string', description: 'The width of a column as a resize handle says it.' },
		{ name: 'dragRow', type: '(label: string) => string', description: 'The name of a row\'s drag handle, from the name of the row.' },
		{ name: 'empty', type: 'string', default: '\'No rows\'', description: 'What `TableEmpty` shows without a slot.' },
		{ name: 'loading', type: 'string', default: '\'Loading…\'', description: 'What `TableLoading` shows without a slot, and what is announced.' },
		{ name: 'noMatches', type: 'string', default: '\'No matches\'', description: 'The list of `selectEditor` when nothing matches the text typed.' },
		{ name: 'sorted', type: '(sort: readonly SortMessageItem[]) => string', description: 'Announced when the sort changes; an empty list when it is cleared.' },
		{ name: 'selected', type: '(count: number) => string', description: 'Announced when the number of selected rows changes.' },
	]"
/>

Messages that take a number or a list are functions, so each language can build its own sentence:
plural forms, word order, the words between the columns of a multi-sort. The demo's Russian uses
`Intl.PluralRules` for "1 строка", "3 строки", "5 строк", and its Kazakh puts the label before the
direction, "Жалақы кему ретімен", as the language orders them.

### Switching the language

`TableRoot` reads `messages` once, when it mounts. To switch at run time, give it a `key` that changes
with the language, so it mounts again with the new messages. The table object stays the same: sort,
selection and widths survive the switch.

```vue
<UiDataTable :key="locale" :table="table" :label="current.title" :messages="current.messages" />
```

Your own parts read the messages of the table they are in with `useTableMessagesContext()`.

## Labels of columns

Column labels are your strings. They name the headers, the resize handles and the columns in
announcements, so translate them with the rest. Declare the columns of each language once and pick
them by the language, rather than rebuilding them on every switch:

```ts
const COLUMNS = {
	en: createColumns(LOCALES.en),
	de: createColumns(LOCALES.de),
};

const table = useDataTable({
	columns: () => COLUMNS[locale.value],
	// …
});
```

## Values

A cell shows what its column's `format` returns, so values follow the reader's conventions through
`Intl`. Create the formatters once, outside of `format`, since creating an `Intl` formatter costs far
more than using one:

```ts
const money = new Intl.NumberFormat(locale.tag, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat(locale.tag, { dateStyle: 'short', timeZone: 'UTC' });

salary: column(person => person.salary, { format: salary => money.format(salary) }),
```

Formatting changes only the text: sorting still compares the numbers and dates underneath. A fixed
`timeZone` keeps a page rendered on a server showing the same day as the browser. The default text
order of sorting uses fixed Unicode rules for the same reason; give a column a `compare` with an
`Intl.Collator` of the language when its order matters, such as `ä` among the `a`s in German.

## Right to left

Set `dir="rtl"` on the table or anything around it. The table reads the direction of its elements, so
everything follows:

- columns lay out from the right, and pinned `start` columns stick to the right edge;
- a resize handle sits on the left edge of its header, and dragging it to the left widens the column;
- <kbd>←</kbd> and <kbd>→</kbd> swap in the grid, in resize handles and in header cells, so the arrow
  always points where focus or the edge goes;
- scrolling to a column works with the reversed scroll position of a right-to-left container.

Use the logical properties of CSS in your own styles, `inset-inline-start` and `padding-inline`,
rather than `left` and `padding-left`, as the structural styles do, and your theme turns around with
the table.

## Accessibility

- Give every control a name in the reader's language: the messages cover the table's own controls,
  your column labels cover the rest. Screen readers read a name in the language of the page, so set
  `lang` on the page, or on the table when it differs, as the demo does.
- Announcements are messages too. Translate `sorted` and `selected`, or a screen reader will switch
  to English in the middle of a German page.
- In a right-to-left table the arrow keys follow the reading direction, as users of those languages
  expect.

## See also

- [Root](/components/root): the `messages` and `label` props.
- [Accessibility](/overview/accessibility): what the table announces and when.
- [Columns](/guides/columns): `format` and `compare`.
