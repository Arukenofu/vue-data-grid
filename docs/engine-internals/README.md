# `@vue-data-grid/engine` internals

A file-by-file walkthrough of the engine: what each module does, why it is shaped that way, and how
the pieces fit. It is written for people who read or change the engine, not for people who use it;
the user-facing guides live in `docs/content/`.

The pages go from the bottom layer up; read them in the order of the table.

| Page | Folder | Layer |
| --- | --- | --- |
| [Shared](./shared.md) | `src/shared` | 1 |
| [Persist](./persist.md) | `src/persist` | 1 |
| [Columns](./columns.md) | `src/columns` | 2 |
| [Render](./render.md) | `src/render` | 3 |
| [Rows](./rows.md) | `src/rows` | 3 |
| [Column groups](./column-groups.md) | `src/column-groups` | 4 |
| [Virtual](./virtual.md) | `src/virtual` | 4 |
| [Engine](./engine.md) | `src/engine` | 5 |
| [Cells: composables](./cells.md) | `src/cells` (`use-*.ts`) | 6 |
| [Cells: pure functions](./cells-pure.md) | `src/cells` (the rest) | 6 |

## What the engine is

The engine answers **what to show and where**. It owns:

- the column model and its state (order, widths, pins, sort, visibility);
- the row pipeline (sort, group, tree, stream, selection);
- the row and column windows (virtualization);
- geometry, as numbers and CSS variables;
- the cell models (focus, ranges, editing, changes with undo, paste, fill, CSV).

It has no markup, no roles, no `aria-*`, no keyboard or pointer handling. All of that belongs to
`@vue-data-grid/core`. The engine touches the DOM in exactly three ways: the scroll container (size,
`scrollTop`, `scrollLeft`), rows handed to `measureElement`, and CSS variables written to elements
marked `data-dg-column` / `data-dg-columns`.

## Two entry points

| Entry | File | Contract |
| --- | --- | --- |
| `@vue-data-grid/engine` | `src/index.ts` | stable API, semver |
| `@vue-data-grid/engine/internals` | `src/internals.ts` | building blocks, not covered by semver |

Every export lands in exactly one of them (`tests/entries.spec.ts`). `@vue-data-grid/core` imports
only the root; if it ever needs `internals`, the engine is missing public API.

## Folder layers

Folders depend on each other in one direction only. A folder may import from the layers below it,
never from the ones above (`tests/folders.spec.ts` enforces this).

```
shared, persist
      ↑
   columns
      ↑
render, rows
      ↑
column-groups, virtual
      ↑
   engine
      ↑
   cells
```

Each folder has an `index.ts` that lists everything it exposes. Other folders import from that
`index.ts`, never from a file inside.

## File conventions

- **`use-*.ts`** is the only place for reactivity (`ref`, `computed`, `watch`). The one exception is
  `shared/stable-computed.ts`, which exists to serve the rest.
- **Every other file is a pure function** or a type. Pure files are tested without Vue.
- A `use-*.ts` file is therefore thin: it wires reactive inputs to pure functions.

## Stable references

The cache layers (row cells, column windows, `cellProps`) compare by reference and break silently
if a value is rebuilt without changing. So the rule across the engine is: **an unchanged result
returns the previous reference.** `stableComputed`, `reconcileColumns`, the row and column windows
and `cellProps` all follow it. Anything that changes every frame, such as a width during resize, goes
to the DOM through geometry layers instead of through render.

## Dev-only code

Code that exists only to help development sits under `__DEV__`; the build turns it into
`process.env.NODE_ENV !== 'production'`. Dev warnings use the package prefix.
