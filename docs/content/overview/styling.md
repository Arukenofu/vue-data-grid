---
title: Styling
description: The structural styles, the theme variables and the data attributes to style a grid with.
---

# Styling

<Description>
A grid has no look of its own. A small structural stylesheet makes it work, a handful of CSS
variables set its colours and density, and data attributes on every part let your CSS reach anything
else, in any state.
</Description>

<Demo name="theming" />

## Two layers

**The structural styles** come with the package, in `@vue-data-grid/core/style.css`. They hold what a
grid needs to work and nothing that is a matter of taste:

- the grid is a scroll container, and the header and the footer stick to its edges;
- rows are flex lines of cells, as wide as their columns, positioned by the row window;
- pinned columns stick to their edge and stay opaque, so content scrolling under them does not show
  through;
- the line under a row, the grab area of a resize handle, the indent of a tree, the outline of a
  cell range, the room of a sort indicator.

Every rule is wrapped in `:where()`, which gives it zero specificity: a single class of yours wins
over any of them, with no `!important` and no fight. Import the file once:

```ts
import '@vue-data-grid/core/style.css';
```

**Your theme** is everything else: colours, fonts, spacing, borders, hover states, icons. The demo
above switches between four themes for one and the same grid; only the class on `GridRoot`
changes:

- **reka-ui**, the theme every demo of these docs uses: sage neutrals, a green accent, icons for the
  sort;
- **Mono**, a crisp monochrome admin grid: uppercase headers over a hard line, black on white, and
  selection marked by a bar rather than a colour;
- **Indigo**, a spacious product grid: more padding, rounded corners and a soft shadow, with an
  indigo accent;
- **Ledger**, a dense data grid for numbers: small type, lines between columns, zebra rows, monospaced
  figures and arrows next to the change.

Each theme is a few dozen lines of CSS in `themes.css`, one switch away.

::: tip Colours of the system
Without a theme at all, the structural styles use the system colours `Canvas`, `CanvasText` and
`Highlight`. A bare grid follows light and dark mode, and stays readable in forced-colours modes
such as Windows High Contrast.
:::

## Theme variables

The structural styles read these variables. Set them on the grid element, or anywhere above it:

```css
.invoices {
	--dg-background: #ffffff;
	--dg-head-background: #f7f9f8;
	--dg-line-color: #dfe2e0;
	--dg-cell-padding: 0 12px;
	--dg-focus-ring: 2px solid #30a46c;

	height: 480px;
	border: 1px solid #dfe2e0;
	border-radius: 10px;
	font-size: 13px;
}
```

<CssVariablesTable
	:data="[
		{ name: '--dg-background', default: 'Canvas', description: 'Body rows, and the cells of pinned columns, which must hide what scrolls under them.' },
		{ name: '--dg-foreground', default: 'CanvasText', description: 'The text.' },
		{ name: '--dg-head-background', default: '--dg-background', description: 'The header and the footer.' },
		{ name: '--dg-pinned-background', default: '--dg-background', description: 'The cells of pinned columns in the body.' },
		{ name: '--dg-selected-background', default: 'Highlight at 18%', description: 'The cells of a selected row. Opaque, for the same reason as pinned cells.' },
		{ name: '--dg-line-color', default: 'CanvasText at 15%', description: 'The line under a row and at the edge of pinned columns.' },
		{ name: '--dg-line-width', default: '1px', description: 'The width of those lines.' },
		{ name: '--dg-cell-padding', default: '0 8px', description: 'The padding of every cell: the density of the grid.' },
		{ name: '--dg-focus-ring', default: '2px solid Highlight', description: 'The outline of a focused cell or grid.' },
		{ name: '--dg-resize-handle-width', default: '8px', description: 'The grab area of a column resize handle.' },
		{ name: '--dg-group-row-height', description: 'The height of a group row of the header. Headers of columns without a group span it only when it is set.' },
		{ name: '--dg-tree-indent', default: '16px', description: 'The indent of a tree cell per level.' },
		{ name: '--dg-drop-color', default: 'Highlight', description: 'The line of the place a dragged row or column goes to.' },
		{ name: '--dg-range-background', default: 'Highlight at 12%', description: 'The tint of a cell in a range. Translucent: the cell shows through.' },
		{ name: '--dg-range-border', default: '1px solid Highlight', description: 'The outline of a cell range.' },
		{ name: '--dg-error-color', default: '#d93025', description: 'The error of an editor\'s draft.' },
		{ name: '--dg-fill-handle-color', default: 'Highlight', description: 'The fill handle at the corner of a range.' },
		{ name: '--dg-fill-handle-size', default: '8px', description: 'The size of the fill handle.' },
		{ name: '--dg-editor-list-max-height', default: '16em', description: 'The list of `selectEditor`, which also keeps to the room in view.' },
		{ name: '--dg-editor-text-max-height', default: '12em', description: 'A text area of `textEditor({ multiline: true })`, which grows with its text.' },
	]"
/>

The grid writes its geometry into variables of its own: `--dg-width-*`, `--dg-grow-*` and `--dg-pin-*`
for every column, `--dg-inset-start` and `--dg-inset-end`, and `--dg-pinned-z-index`. Read them if
you need to, but do not set them: they change on every resize without a render, which is what keeps
resizing smooth.

## Data attributes

Every part says what it is in `data-dg-part`, and an interactive part says its state in
`data-dg-state`. That is all a selector needs:

```css
.invoices [data-dg-part='head'] {
	color: #5f6563;
	font-weight: 560;
}

.invoices [data-dg-part='row']:hover {
	--dg-background: #f7f9f8;
}

.invoices [data-dg-part='tree-toggle'][data-dg-state='expanded'] {
	rotate: 90deg;
}
```

### Parts

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-part=&quot;grid&quot;]', values: 'The grid element, the scroll container.' },
		{ attribute: '[data-dg-part=&quot;head&quot;]', values: 'The header block; `foot` is the footer block, `body` the body block.' },
		{ attribute: '[data-dg-part=&quot;row&quot;]', values: 'Any row: a group row or the row of column headers, a body row, a footer row.' },
		{ attribute: '[data-dg-part=&quot;cell-text&quot;]', values: 'The text a part renders in a cell by default, cut with an ellipsis.' },
		{ attribute: '[data-dg-part=&quot;sort-indicator&quot;]', values: 'The sort mark of a header cell.' },
		{ attribute: '[data-dg-part=&quot;resize-handle&quot;]', values: 'The resize handle of a header cell.' },
		{ attribute: '[data-dg-part=&quot;group-toggle&quot;]', values: 'The button that collapses a column group.' },
		{ attribute: '[data-dg-part=&quot;selection-checkbox&quot;]', values: 'A row checkbox, and the select-all checkbox.' },
		{ attribute: '[data-dg-part=&quot;tree-toggle&quot;]', values: 'The button that expands a row of a tree; `tree-indent` is the indent before it.' },
		{ attribute: '[data-dg-part=&quot;empty&quot;]', values: 'The row of an empty grid; `empty-cell` is its cell.' },
		{ attribute: '[data-dg-part=&quot;loading&quot;]', values: 'The loading bar.' },
		{ attribute: '[data-dg-part=&quot;range&quot;]', values: 'A cell range drawn over the body; `range-cell` is a piece of it on one pin side.' },
		{ attribute: '[data-dg-part=&quot;fill-handle&quot;]', values: 'The fill handle at the corner of the last range.' },
		{ attribute: '[data-dg-part=&quot;editor&quot;]', values: 'The field of an editor; `editor-error`, `editor-list`, `editor-option` and `editor-empty` are its error and list.' },
		{ attribute: '[data-dg-part=&quot;cell-checkbox&quot;]', values: 'The checkbox of `checkboxCell()`.' },
		{ attribute: '[data-dg-part=&quot;drag-handle&quot;]', values: 'The drag handle of a row.' },
		{ attribute: '[data-dg-part=&quot;drag-preview&quot;]', values: 'The ghost under the pointer during a drag.' },
		{ attribute: '[data-dg-part=&quot;drag-overlay&quot;]', values: 'The message over a grid a drag can drop on.' },
		{ attribute: '[data-dg-part=&quot;drop-zone&quot;]', values: 'An area rows or columns are dropped on.' },
		{ attribute: '[data-dg-part=&quot;announcer&quot;]', values: 'The live region of the announcer, hidden from sight.' },
	]"
/>

### States

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-state]', values: 'The state of an interactive part, one value at a time.' },
		{ attribute: 'sort-indicator', values: ['asc', 'desc', 'none'] },
		{ attribute: 'resize-handle', values: ['resizing', 'idle'] },
		{ attribute: 'selection-checkbox', values: ['checked', 'unchecked', 'indeterminate'] },
		{ attribute: 'tree-toggle, group-toggle', values: ['expanded', 'collapsed'] },
		{ attribute: 'a cell being edited', values: ['editing'] },
		{ attribute: 'editor', values: ['quick', 'full'] },
		{ attribute: 'range (of a fill)', values: ['fill'] },
		{ attribute: 'fill-handle, drag-handle', values: ['dragging', 'idle'] },
		{ attribute: 'drag-overlay', values: ['ready', 'over', 'refused', 'idle'] },
		{ attribute: 'drop-zone', values: ['over', 'ready', 'idle'] },
		{ attribute: 'a row leaving under motion', values: ['leaving'] },
		{ attribute: '[data-dg-disabled]', values: 'Present on a checkbox or a drag handle whose row refuses it.' },
	]"
/>

### Layout facts

<DataAttributesTable
	:data="[
		{ attribute: '[data-dg-column]', values: 'The name of the column of a body, header or footer cell.' },
		{ attribute: '[data-dg-columns]', values: 'The columns under a group cell or a piece of a range, as tokens.' },
		{ attribute: '[data-dg-group]', values: 'The name of the group of a group cell.' },
		{ attribute: '[data-dg-pinned]', values: ['start', 'end'] },
		{ attribute: '[data-dg-align]', values: ['center', 'right'] },
		{ attribute: '[data-dg-inset]', values: ['start', 'end'] },
		{ attribute: '[data-dg-rowspan]', values: 'How many header rows a column header covers, from `2`.' },
		{ attribute: '[data-dg-row-layout]', values: ['positioned', 'flow'] },
		{ attribute: '[data-dg-index]', values: 'The index of a body row in the shown rows.' },
		{ attribute: '[data-dg-draggable]', values: 'Present on a row or header that can be dragged now.' },
	]"
/>

The ARIA attributes are there to style too: `[aria-sort]` on a sorted header, `[aria-selected='true']`
on a selected row or cell, `[aria-expanded]` on a row of a tree.

## Styling a part through its slot

When CSS is not enough, a part's slot lets you render its content. A sort indicator with icons of
your own, as the kit of these docs does:

```vue
<GridSortIndicator v-slot="{ direction, sortIndex }">
	<IconArrowUp v-if="direction === 'asc'" />
	<IconArrowDown v-else-if="direction === 'desc'" />
	<IconChevronsUpDown v-else class="is-idle" />
	<span v-if="direction && sortIndex">{{ sortIndex }}</span>
</GridSortIndicator>
```

And with `as` or `asChild`, a part renders the element or component you choose, such as a
checkbox of your design system in place of the native one. See [Your own markup](/guides/custom-markup).

## Scoped styles

A class on `GridRoot` goes to the grid element, so a class-based theme just works. With Vue's
scoped styles, remember that parts render their own elements: reach inside them with `:deep()`.
`GridRoot` itself has several root nodes, the grid, the exit element of the navigation and the
live region, so style it from an element around it:

```vue
<template>
	<section class="invoices">
		<GridRoot :grid="grid" label="Invoices">…</GridRoot>
	</section>
</template>

<style scoped>
.invoices :deep([data-dg-part='grid']) {
	height: 480px;
}

.invoices :deep([data-dg-part='row'][aria-selected='true']) {
	--dg-selected-background: #e6f6eb;
}
</style>
```

## Tailwind CSS

The data attributes work as Tailwind variants, and the theme variables as arbitrary values:

```vue
<GridRoot
	:grid="grid"
	label="Invoices"
	class="h-[480px] rounded-xl border border-stone-200 text-sm [--dg-cell-padding:0_12px] [--dg-line-color:var(--color-stone-200)]"
>
	<GridHeader class="font-medium text-stone-500">
		<!-- … -->
	</GridHeader>
</GridRoot>
```

For states deep in the grid, a small CSS file with `@apply` often reads better than long class
strings: `[data-dg-part='resize-handle'][data-dg-state='resizing'] { @apply bg-emerald-500; }`.

## The kit of these docs

Every demo on this site uses one theme, `class="ui-grid"`, on top of the structural styles, and a
few controls built on Reka UI. Both live in the `docs/ui` folder of the repository: copy them into
your app to start from the same look.

## Accessibility

- The focus ring is drawn by `:focus-visible` through `--dg-focus-ring`: keep it visible, and at a
  contrast of at least 3:1 against both the cell and the selection tint.
- Selected rows and ranges are marked with `aria-selected`, not only with colour. Style them from
  that attribute, and screen readers and your CSS agree.
- A tint alone is not enough for a state people must notice. The kit adds an accent line to selected
  rows; do something similar in your theme.
- Keep the system colours as a fallback, or test your theme in forced-colours mode, where
  backgrounds you set may be replaced.

## See also

- [Performance](/overview/performance): why widths and pins are CSS variables.
- [Your own markup](/guides/custom-markup): `as`, `asChild` and parts of your own.
- [Header](/components/header): the parts of the header and their attributes.
