---
title: Row selection
description: Checkboxes, ranges with Shift, single or multiple selection, rows that cannot be selected, and a selection you own.
---

# Row selection

<Description>
Select rows with checkboxes or the keyboard, one at a time or in ranges, and act on them in bulk. The
selection is a list of row keys, so it survives sorting, filtering and new data.
</Description>

<Demo name="selection" />

Click a checkbox, then <kbd>Shift</kbd>-click another to select the rows between. With focus in the
table, <kbd>Shift+Space</kbd> selects the row of the focused cell and <kbd>Ctrl+A</kbd> selects every
row. Cancelled orders cannot be selected, and their checkboxes are disabled.

## Adding the feature

Selection is the `selection` feature, and the checkboxes come with `selectionColumn()`, a ready-made
column:

```ts
import { selection, selectionColumn, useDataTable } from 'vue-data-grid';

const columns = defineColumns({
	select: selectionColumn(),
	id: column(order => order.id, { label: 'Order' }),
	// …
});

const table = useDataTable({
	columns,
	rows: orders,
	rowKey: 'id',
	rowHeight: 44,
	features: { selection: selection() },
});
```

`selectionColumn()` is a real column of the `service` kind: 40 px wide and pinned to the start, with a
select-all checkbox in its header and a checkbox in every cell. Pass it options to change its label,
width or pin. As a service column it is left out of CSV, copying and autosize.

The handle of the feature is `table.selection`:

<ReturnsTable
	:data="[
		{ name: 'selectedKeys', type: 'ComputedRef<readonly string[]>', description: 'The selected keys, as the model holds them.' },
		{ name: 'selectedCount', type: 'ComputedRef<number>', description: 'How many of the rows are selected.' },
		{ name: 'isSelected', type: '(key: string) => boolean', description: 'Whether a row is selected. Reactive per row: a change wakes only the rows it concerns.' },
		{ name: 'isSelectable', type: '(key: string) => boolean', description: 'Whether a row can be selected at all.' },
		{ name: 'toggle', type: '(key: string) => void', description: 'Toggles a row, and makes it the anchor of the next range.' },
		{ name: 'replace', type: '(key: string) => void', description: 'Selects this row alone, and makes it the anchor.' },
		{ name: 'extend', type: '(key: string) => void', description: 'Selects the rows from the anchor to this one, as Shift+click does.' },
		{ name: 'set', type: '(keys: readonly string[]) => void', description: 'Selects exactly these rows.' },
		{ name: 'clear', type: '() => void', description: 'Deselects every row.' },
		{ name: 'setAll', type: '(value: boolean) => void', description: 'Selects or deselects every row.' },
		{ name: 'toggleAll', type: '() => void', description: 'Selects every row, or none when all are selected.' },
		{ name: 'isAllSelected', type: 'ComputedRef<boolean>', description: 'Whether every selectable row is selected.' },
		{ name: 'isSomeSelected', type: 'ComputedRef<boolean>', description: 'Whether some, but not all, are.' },
	]"
/>

## Checkboxes of your own

`selectionColumn()` renders two parts, which you can use anywhere else: `TableSelectionCheckbox`, the
checkbox of the row it is in, and `TableSelectAllCheckbox`. A checkbox in the first column next to
the name is one `cell` field away:

```ts
name: column(person => person.name, {
	label: 'Name',
	cell: ({ key, value }) => [h(TableSelectionCheckbox, { row: key }), value],
}),
```

Both render a native `<input type="checkbox">` by default. With `as` or `asChild` they render any
element, such as the checkbox of your design system, and give it `role="checkbox"` and
`aria-checked` itself; see [Selection checkbox](/components/selection-checkbox).

## One row or many

`selectionMode` is `'multiple'` by default. In `'single'` mode, selecting a row lets go of the one
before, <kbd>Shift</kbd> selects one row rather than a range, and the select-all checkbox is
disabled. It takes a `ref`, as in the demo, to switch at run time. Switching keeps what the model
holds, so clear it when a selection made in one mode means nothing in the other:

```ts
const selectionMode = shallowRef<SelectionMode>('multiple');

const table = useDataTable({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 44,
	features: { selection: selection({ selectionMode }) },
});

watch(selectionMode, () => table.selection.clear());
```

## Rows that cannot be selected

`canSelect` decides by row key. A row it refuses is never selected, whatever the model holds, and its
checkbox is disabled:

```ts
const cancelled = computed(() => new Set(orders.value.filter(isCancelled).map(order => order.id)));

selection({ canSelect: key => !cancelled.value.has(key) }),
```

"All" then means every row that can be selected, and the select-all checkbox is checked once they are.

## Owning the selection

Pass a `ref` of keys as `selection`, and it becomes a model: the table writes every change into it,
and follows what you write. That is how the demo's bulk actions know what to act on:

```ts
const selected = shallowRef<string[]>([]);

const table = useDataTable({
	// …
	features: { selection: selection({ selection: selected }) },
});

function archive() {
	const keys = new Set(selected.value);

	orders.value = orders.value.filter(order => !keys.has(order.id));
	table.selection.clear();
}
```

Keys of rows that are gone stay in the model until you clear them, so a selection survives a filter
that hides some of its rows for a moment.

### Selecting rows that are not loaded yet

When rows arrive page by page, "select all" cannot list keys it has not seen. Pass a `selectAll` ref:
while it is `true`, the whole set is selected, including rows still on the server, and `selection`
holds the exceptions, the rows people deselected since. Send both to the server with a bulk action.

```ts
const selectAll = shallowRef<boolean | null>(null);
const selected = shallowRef<string[]>([]);

selection({ selection: selected, selectAll }),
```

## Selection in a tree

In a table with the `tree` feature, selecting a group selects every leaf under it, a group is checked
when all its leaves are, and partly checked when some are. The model holds leaves only. See
[Trees and grouping](/guides/trees-and-grouping).

## Styling

Selected rows get `aria-selected="true"`, and the structural styles tint their cells with
`--tc-selected-background`. The checkboxes carry `data-tc-part="selection-checkbox"` and
`data-tc-state` of `checked`, `unchecked` or `indeterminate`, with `data-tc-disabled` on a row that
cannot be selected.

## Accessibility

- Rows get `aria-selected`, and the grid `aria-multiselectable` while more than one row can be
  selected. A row that cannot be selected gets no `aria-selected` at all.
- Every checkbox has a name: "Select row" and "Select all rows" by default, from the table's
  messages. Give a checkbox of your own a `label` naming the row, such as "Select order #1042", when
  you can.
- The announcer of `TableRoot` says how many rows are selected after every change: "3 rows
  selected".
- With the `navigation` feature, the keys below work from any cell. Without it, each checkbox is a Tab
  stop that <kbd>Space</kbd> toggles.

### Keyboard interactions

<KeyboardTable
	:data="[
		{ keys: ['Space'], description: 'On a cell whose only content is a checkbox: toggles it, and so the row.' },
		{ keys: ['Shift+Space'], description: 'Toggles the row of the focused cell.' },
		{ keys: ['Ctrl+A', '⌘+A'], description: 'Selects every row.' },
		{ keys: ['Shift+Click'], description: 'On a checkbox: selects the rows from the last one toggled to this one.' },
	]"
/>

## See also

- [Selection checkbox](/components/selection-checkbox): the parts and their props.
- [Service columns](/components/service-columns): `selectionColumn()` and its options.
- [Cell ranges and clipboard](/guides/cell-ranges): selecting cells rather than rows.
- [Team directory](/examples/team-directory): selection with search and bulk actions.
