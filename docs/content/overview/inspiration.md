---
title: Inspiration
description: The libraries this one learned from - Reka UI, AG Grid and TanStack Table - and what it took from each.
---

# Inspiration

<Description>
Nothing here was invented in a vacuum. Three libraries shaped this one more than any others, each
from a different side: how to build parts, what a data grid must do, and how to keep logic headless.
</Description>

<InspirationCards />

## Reka UI

[Reka UI](https://reka-ui.com) (formerly Radix Vue) showed how unstyled components should feel in
Vue, and this library follows it in almost every way a part can be built:

- **Small parts, written out.** A Reka UI dialog is a root, a trigger, a content and a close
  button, each a component you place yourself. A table here is a root, a header, header cells, a
  body, rows and cells, placed the same way. A part never renders another part on its own.
- **`as` and `asChild`.** Every part renders the element you choose, or merges its props onto your
  own element, as Reka UI's `Primitive` does. A selection checkbox can become the checkbox of your
  design system without losing its behaviour.
- **Context you can reach.** Parts share state through provide and inject, and the helpers are
  exported, `useDataTableContext`, `useBodyRowContext` and the rest, so a part of your own can stand
  in for any built-in one.
- **State as data attributes.** `data-state` in Reka UI, `data-tc-state` here: one attribute that
  says what an interactive part is doing, for CSS to read.
- **Accessibility as the default,** by the WAI-ARIA Authoring Practices, with the keys of every part
  written down.

This documentation site borrows its layout from Reka UI's too.

Where it differs: a table has far more parts on the screen than a dialog, so the cells of a row are
not a component each. `TableCells` renders them all in one pass, which halves the cost of the body.

## AG Grid

[AG Grid](https://www.ag-grid.com) is the reference for what a data grid has to do when real people
work in it all day. Much of the feature list here was checked against it:

- **Columns:** pinning to either edge, resizing with autosize on a double click, column groups that
  collapse to a summary (`columnGroupShow` there, `showWhen` here), columns kept together, moving
  columns by drag.
- **Rows:** grouping with aggregates, tree data, row dragging in a list and in a tree, dragging
  between grids, and drop zones outside them.
- **Cells:** ranges, a fill handle, copy and paste that round-trips with Excel, editing with undo and
  redo, and cells that flash when their value changes.
- **Streams:** transactions that add, update and remove rows by key, and a delta sort that re-sorts
  only what changed.
- **The feel of a spreadsheet:** Enter saves and moves down, Tab wraps to the next row, Ctrl+Enter
  writes into every selected cell, a typed character starts editing.

Where it differs: AG Grid is one component configured by hundreds of options, with a look of its
own. Here each of those capabilities is a feature you add, or a part you place, and the look is
yours from the first line.

## TanStack Table

[TanStack Table](https://tanstack.com/table) made headless tables mainstream, and showed how far a
table's logic can go without any markup:

- **Headless logic.** The core of this library, `@vue-stack/table-core`, holds no markup at all, as
  TanStack Table holds none: columns, rows, sorting, grouping and windows are data and functions.
- **Features as plugins.** TanStack Table's row models are opted into one by one; features here are
  functions passed to `useDataTable`, and what is not used is not bundled.
- **Types from the data.** A column helper bound to the row type, `createColumnHelper` there and
  `defineColumn` here, makes every accessor, formatter and cell typed without generics.
- **Controlled state.** Sort and layout can live in refs you own, as TanStack's state can be
  controlled from outside.
- **Virtualization** in the spirit of TanStack Virtual: estimated sizes, measured rows and windows
  that do not care how the rows are drawn.

Where it differs: TanStack Table stops at logic, and leaves roles, keys, focus and rendering to you.
This library goes on to the markup: parts, prop-getters, keyboard navigation and announcements, and
it is built for Vue's reactivity, so a change wakes one row rather than the table.

## And more

- The [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) for the grid, treegrid and
  table patterns, and for every key.
- Spreadsheets, Excel and Google Sheets, for how ranges, the fill handle and editing should feel.
- The [FLIP technique](https://aerotwist.com/blog/flip-your-animations/) of Paul Lewis, which
  `@vue-stack/flip` is built on, and [GSAP](https://gsap.com) and [Motion](https://motion.dev),
  whose engines plug into it.
- [VitePress](https://vitepress.dev), which this site is made with.

## Accessibility

Each of these influences carries its part of accessibility: Reka UI the habit of documenting keys
and roles for every part, AG Grid the expectations of people who move through a grid by keyboard
all day, TanStack Table the discipline of keeping state out of the markup, so the markup can be
made right. The result is described on the [Accessibility](/overview/accessibility) page.

## See also

- [Introduction](/overview/introduction)
- [How it fits together](/overview/concepts)
