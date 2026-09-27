---
title: Introduction
description: Headless, accessible and fast tables for Vue 3, assembled from small parts.
---

# Introduction

<Description>
Vue Stack Table is a headless table library for Vue 3. You compose a table from small parts, style it
with your own CSS, and add behaviour one feature at a time, while the library takes care of the
things that are hard to get right: keyboard, accessibility, virtualization and stable rendering.
</Description>

<Demo name="showcase" />

## Why it exists

Most table libraries sit at one of two ends.

- **A finished grid** gives you everything at once: a thousand options, its own markup, its own look.
  It works until you need it to look or behave like the rest of your product, and then you fight it.
- **Pure table logic** gives you sorting and row models, and nothing on the screen. The table is
  yours, and so are the parts nobody enjoys writing: focus management, keyboard navigation, ARIA
  roles and counts, virtualization, sticky headers, resizing, dragging.

This library sits in between. The markup and the look are yours, as with pure logic; the behaviour
is done, as with a grid; and every piece of it can be used, restyled or replaced on its own.

## Principles

### Headless, not markup-less

The parts render plain elements, one each, with `data-tc-*` attributes that say what they are and
what state they are in. There is no theme to fight: a small structural stylesheet makes the table
work, and everything you see comes from your own CSS. See [Styling](/overview/styling).

### Composition over configuration

There is no component with forty boolean props. A table is a tree of parts you write out, and
behaviour arrives as **features**: `sorting()`, `selection()`, `navigation()`, `editing()`. Each is a
small function you pass in, each is one line, and the code of a feature you do not use never reaches
your bundle. See [How it fits together](/overview/concepts).

### Accessible by default

A table built from the parts is a WAI-ARIA grid or treegrid out of the box: roles, row and column
counts, sort state, selection, tree levels, a live region for announcements and the full keyboard
model of the grid pattern. You get it without writing a single `aria-*` attribute. See
[Accessibility](/overview/accessibility).

### Fast by construction

Rows and columns outside the viewport are not rendered. A row is one component however many columns
it has, and it renders again only when its own data changes. Widths during a resize reach the DOM
through CSS variables, without a render. See [Performance](/overview/performance).

### Typed from your data

The type of your rows flows from the array you pass into the columns, their cells and every
callback. You write `defineColumn<Invoice>()` once and never a generic again.

## Three levels of API

Everything in `@vue-stack/table` is public, in three levels, each built on the one below:

| Level | What it is | Use it when |
| --- | --- | --- |
| **Components** | Small parts in the manner of Reka UI: `TableRoot`, `TableHeaderCell`, `TableCells`, `TableResizeHandle`… Each has `as` and `asChild`. | Almost always. It is the level the guides use. |
| **Composables** | The behaviour under the parts: `useDataTable`, `useGridNavigation`, `useColumnResize`, `useRangeSelection`, `useTableMotion`… | You render a part yourself, or need a behaviour in markup of your own. |
| **Utilities** | Prop-getters and helpers: `getRowProps`, `getCellProps`, grid attributes, `autosizeColumns`… | You write the whole markup yourself, such as a `<table>` element or a canvas of your own. |

The components contain no private tricks: they are made from the same composables and utilities
you can import, so dropping a level never means losing a capability.

## The packages

You install one package, `@vue-stack/table`. It re-exports two others, so you import everything from
one place:

- **`@vue-stack/table-core`**: the headless core. The column model, the row pipeline, the row and
  column windows, geometry as CSS variables. It knows nothing about markup.
- **`@vue-stack/flip`**: the animation engines that move rows and columns, and the contract that lets
  you bring GSAP, Motion or anything else.

Dragging rows and columns lives in a separate entry, `@vue-stack/table/drag-and-drop`, on top of the
optional peer `@vue-stack/drag-and-drop`, so a table that does not drag does not carry it.

## What is in the box

<Highlights
	:features="[
		'Sorting on the client or the server, by one column or several',
		'Column widths, resizing, autosize, pinning to either edge, hiding, reordering, and a layout kept between visits',
		'Column groups in several header rows, which collapse and keep their columns together',
		'Row and column virtualization for hundreds of thousands of rows',
		'Row selection with checkboxes, ranges and a select-all over data not loaded yet',
		'Trees and grouping with aggregates, and footers with totals',
		'Keyboard navigation of the WAI-ARIA grid and treegrid patterns',
		'Cell ranges, copy, cut and paste that speaks the language of spreadsheets, and CSV',
		'Editing with editors, validation, undo and redo, and a fill handle',
		'Dragging rows and columns, between tables and onto drop zones, by pointer, touch or keyboard',
		'Animated sorts, drags and expanding rows, with any animation engine',
		'Streaming updates that re-render only the rows that changed',
	]"
/>

## Where to go next

- [Getting started](/overview/getting-started): a sortable table in four small steps.
- [How it fits together](/overview/concepts): the few ideas everything else builds on.
- [Examples](/examples/): complete tables to take apart.
