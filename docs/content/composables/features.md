---
title: Features
description: What a grid can do comes in as features — small functions of the grid, built in a fixed order, each one line to add.
---

# Features

<Description>
What a grid can do comes in as features: small functions of the grid that `useDataGrid` builds
in a fixed order, each on what the ones before it give. A feature you do not add costs nothing, not
even bytes.
</Description>

<Demo name="api-features" />

The sorting in this demo is a feature of its own: it sorts with the built-in one, then lifts the
starred rows above the rest. Twelve lines, and the grid animates it like any other sort.

## Usage

Each feature has a factory named after it. Call the factory with its options and pass the result
under the same name:

```ts
import { editing, history, navigation, ranges, selection, sorting, useDataGrid } from '@vue-data-grid/core';

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		sorting: sorting(),
		selection: selection({ selectionMode: 'multiple' }),
		navigation: navigation(),
		ranges: ranges(),
		editing: editing({ onCommit: commit => save(commit) }),
		history: history({ limit: 50 }),
	},
});

grid.selection.selectedCount.value;
grid.history.undo();
```

The factory returns a function of the grid, and `useDataGrid` calls it at the right moment with
the part of the grid the feature needs. Each handle is then on the grid object under the same
name, typed by the feature: `grid.history` exists in this grid and is `undefined` in one without
`history()`.

## The order

Features are built in one order, whatever order you write them in. The first four change the rows,
the engine renders them, and the rest work on the rendered grid:

| Step | Feature | Works on | Gives |
| --- | --- | --- | --- |
| 1 | `grouping` | the source rows | group rows with children and aggregates |
| 2 | `sorting` | the grouped rows | the rows in the order of the sort |
| 3 | `tree` | the sorted rows | the expanded tree, flattened, with a node for each row |
| 4 | `selection` | the shown rows and the tree | selected keys, and `aria-selected` on rows |
| — | the engine | the shown rows | row and column windows, geometry, prop-getters |
| 5 | `navigation` | the rendered grid | the keys of the grid, the focused cell |
| 6 | `ranges` | the rendered grid, the navigation | cell ranges and their gestures |
| 7 | `editing` | the rendered grid, navigation, ranges | editors, writes, paste |
| 8 | `history` | editing | undo and redo |
| 9 | `fill` | ranges and editing | the fill handle |
| 10 | `clipboard` | ranges, navigation, editing | copy, cut and paste |

A feature that needs another one does not compile without it: `fill()` in a grid without `ranges`
and `editing` is a type error at the call, and `history()` without `editing` too. Features that only
use another when it is there, as `ranges` uses the navigation's focus, work alone as well.

## The factories

### sorting

Sorts the rows on the client by the column state's `sort`. Without it the grid leaves the rows in
the order you give them, as a server that sorts them wants, and header clicks still change the sort.
Built on `useGridSorting`.

<PropsTable
	label="Option"
	:data="[
		{ name: 'delta', type: 'MaybeRefOrGetter<boolean>', default: 'false', description: 'Re-sort only rows that arrive as new objects, for a stream of updates. Correct only with immutable rows: a row changed in place is not noticed.' },
	]"
/>

### grouping

Groups the rows by value into group rows with children, and aggregates the columns over each group.
Pair it with `tree` and a `childrenField`, which flattens the groups into rows. Built on
`useGridGrouping`.

<PropsTable
	label="Option"
	:data="[
		{ name: 'by', type: 'MaybeRefOrGetter<RowGroupLevel[]>', required: true, description: 'The levels from the top, each `{ name, value(row) }`; a column fits as it is. None returns the rows as they are.' },
		{ name: 'createGroup', type: '(group: RowGroup) => TRow', required: true, description: 'Builds the row of a group, of the same type as the leaves: its `key`, its `children` in the children field, and `group.aggregates`, typed by the columns\' `aggregate`.' },
	]"
/>

### tree

The rows as a tree, flattened into the shown rows, each level sorted by the column state. A grid
with a tree needs no `sorting`: the tree sorts each level itself. Built on `useGridTree`.

<PropsTable
	label="Option"
	:data="[
		{ name: 'parentKey', type: 'keyof TRow | ((row: TRow) => string | null)', description: 'The parent of each row of a flat list. Takes precedence over `childrenField`. Read once.' },
		{ name: 'childrenField', type: 'MaybeRefOrGetter<keyof TRow>', description: 'The field that holds an array of children, as group rows of `grouping` do.' },
		{ name: 'expanded', type: 'Ref<string[] | undefined>', description: 'The keys of expanded rows as a model; `undefined` for the start from `defaultExpanded`.' },
		{ name: 'defaultExpanded', type: 'MaybeRefOrGetter<number>', default: '0', description: 'How many levels start expanded; a negative number expands everything.' },
		{ name: 'sort', type: 'MaybeRefOrGetter<boolean>', default: 'true', description: 'Sort the siblings of every level by the column state.' },
		{ name: 'delta', type: 'MaybeRefOrGetter<boolean>', default: 'false', description: 'Re-sort only siblings that arrive as new objects.' },
	]"
/>

### selection

Row selection over the shown rows. With a tree, a group selects the leaves under it and shows a
partly checked box when some are. Rows get `aria-selected`, the grid `aria-multiselectable`. Built
on `useGridSelection`.

<PropsTable
	label="Option"
	:data="[
		{ name: 'selectionMode', type: 'MaybeRefOrGetter<\'single\' | \'multiple\'>', default: '\'multiple\'', description: 'How many rows can be selected at once.' },
		{ name: 'selection', type: 'Ref<string[]>', description: 'The selected keys as a model, for `v-model`; without it the selection keeps its own.' },
		{ name: 'selectAll', type: 'Ref<boolean | null>', description: 'Turns on the mode where the whole set is selected, rows not loaded yet included, and `selection` holds the exceptions.' },
		{ name: 'canSelect', type: '(key: string) => boolean', description: 'Whether a row can be selected. A refused row is never selected, whatever the model holds.' },
	]"
/>

### navigation

The keys of the WAI-ARIA grid over the header, the body and the footer. With it, the grid is one
Tab stop and its cells take `tabindex="-1"`. It uses the tree for → and ←, and the selection for
Shift+Space and Ctrl+A. Built on `useGridNavigation`; the options are those of
[useCellNavigation](/composables/use-cell-navigation) without the elements, which the grid
provides: `onSpace`, `onSelectColumn`, `onFocus`, `treeColumn`, `enabled`, `scroller`, `exit`.

### ranges

Cell ranges with their gestures: press and drag, Shift and Ctrl clicks, Shift with the arrows. Cells
get `aria-selected`, and `GridRangeOverlay` draws the ranges. Built on `useGridRanges`, which is
`useCellRanges` plus [useRangeSelection](/composables/use-range-selection).

<PropsTable
	label="Option"
	:data="[
		{ name: 'ranges', type: 'Ref<readonly CellRange[]>', description: 'The ranges as a model, for `v-model`.' },
		{ name: 'canSelectColumn', type: '(column: RuntimeColumn) => boolean', default: 'data columns', description: 'Which columns ranges span; service columns are left out by default.' },
		{ name: 'corners', type: '\'key\' | \'index\'', default: '\'key\'', description: 'What the corners hold on to: the row by key, so a range stays on its rows through a sort, or the place on screen.' },
		{ name: 'autoScroll', type: 'AutoScrollOptions | false', description: 'How the grid scrolls while a drag nears its edges.' },
		{ name: 'focus', type: 'BodyCellFocus', description: 'The focus a press moves; the navigation\'s by default.' },
		{ name: 'enabled', type: 'MaybeRefOrGetter<boolean>', default: 'true' },
	]"
/>

### editing

Editors in cells, and writes: typing, paste, clear, fill. Needs `onCommit`, which writes a commit
into your rows. The options are those of [useGridEditing](/composables/use-grid-editing).

### history

Undo and redo of the edits, with Ctrl+Z and Ctrl+Y. Needs `editing`. The options are those of
[useGridHistory](/composables/use-grid-history): `limit` and `enabled`.

### fill

The fill handle at the corner of the last range, and Ctrl+D and Ctrl+R. Needs `ranges` and
`editing`. The options are those of [useGridFill](/composables/use-grid-fill).

### clipboard

Copy of the last range or the focused cell, and with `editing` cut and paste. The options are those
of [useClipboard](/composables/use-clipboard).

## A feature of your own

A factory is only a function that returns a function of the grid. Write your own in its place and
the grid builds it in the same slot. A feature that changes the rows takes a `RowsGrid` — the rows
of the step before, the row key, the columns and the column state — and returns `{ rows }`:

```ts
import { createRowKeyResolver, type RowsGrid, type GridRowsFeature, useGridSorting } from '@vue-data-grid/core';
import { computed, type Ref } from 'vue';

export function starredFirst(starred: Readonly<Ref<ReadonlySet<string>>>) {
	return <TRow>(grid: RowsGrid<TRow>): GridRowsFeature<TRow> => {
		const sorted = useGridSorting(grid);
		const getKey = createRowKeyResolver(grid.rowKey);

		return {
			rows: computed(() => [
				...sorted.rows.value.filter(row => starred.value.has(getKey(row))),
				...sorted.rows.value.filter(row => !starred.value.has(getKey(row))),
			]),
		};
	};
}
```

```ts
const grid = useDataGrid({
	columns,
	rows: stocks,
	rowKey: 'id',
	rowHeight: 40,
	features: { sorting: starredFirst(starred) },
});
```

A feature that works on the rendered grid takes the grid as it is so far, with the handles of the
features before it. The simplest way to write one is to wrap the built-in function and add to it:

```ts
import { type EditingGrid, useGridEditing } from '@vue-data-grid/core';
import { watch } from 'vue';

const grid = useDataGrid({
	columns,
	rows,
	rowKey: 'id',
	rowHeight: 40,
	features: {
		editing: (base: EditingGrid<Order>) => {
			const editing = useGridEditing(base, { onCommit: commit => apply(commit) });

			watch(editing.lastCommit, (commit) => {
				if (commit) {
					audit.log(commit.edits);
				}
			});

			return editing;
		},
	},
});
```

The behind-the-factory functions are exported for this: `useGridSorting`, `useGridGrouping`,
`useGridTree`, `useGridSelection`, `useGridNavigation`, `useGridRanges`, `useGridEditing`,
`useGridHistory`, `useGridFill` and `useClipboard`.

## Accessibility

Features are where most of the accessibility of a grid comes from, and they wire it for you:

- `sorting` keeps `aria-sort` on the first sort column, and the announcer says the whole sort;
- `tree` makes the grid a `treegrid` and puts `aria-level`, `aria-posinset`, `aria-setsize` and
  `aria-expanded` on its rows;
- `selection` and `ranges` put `aria-selected` on rows and cells and `aria-multiselectable` on the
  grid, and the announcer says how many rows are selected;
- `navigation` makes the grid one Tab stop and moves through it with the keys of the pattern;
- `editing` names its editors after their column and ties the error of a draft to its field with
  `aria-describedby` and `aria-invalid`.

### Keyboard interactions

The keys each feature adds, in short. The pages of the features have the full lists.

<KeyboardTable
	:data="[
		{ keys: ['Enter', 'Space'], description: 'On a header cell, sorts the column (`sorting`); Shift adds it to the sort with `multiSort`.' },
		{ keys: ['Shift+Space'], description: 'Toggles the selection of the row (`selection` with `navigation`).' },
		{ keys: ['Ctrl+A'], description: 'Selects every row, or with `ranges` every cell.' },
		{ keys: ['→', '←'], description: 'In the tree column, expands and collapses a row (`tree` with `navigation`).' },
		{ keys: ['Shift+↑', 'Shift+↓', 'Shift+←', 'Shift+→'], description: 'Extends the range (`ranges`).' },
		{ keys: ['Enter', 'F2'], description: 'Starts editing the cell (`editing`); a typed character starts it with that character.' },
		{ keys: ['Ctrl+Z', 'Ctrl+Y'], description: 'Undoes and redoes an edit (`history`).' },
		{ keys: ['Ctrl+D', 'Ctrl+R'], description: 'Fills the range down or right (`fill`).' },
		{ keys: ['Ctrl+C', 'Ctrl+X', 'Ctrl+V'], description: 'Copies, cuts and pastes the cells (`clipboard`).' },
	]"
/>

## See also

- [useDataGrid](/composables/use-data-grid): the grid that builds the features.
- [Sorting](/guides/sorting), [Row selection](/guides/selection), [Trees and grouping](/guides/trees-and-grouping),
  [Editing](/guides/editing): the guides of the features.
