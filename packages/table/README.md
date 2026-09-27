# @vue-stack/table

Headless, accessible tables for Vue 3. A table assembled in one call, small parts in the manner of
reka-ui, keyboard navigation of the WAI-ARIA grid, column resize and autosize, and structural CSS,
on top of [`@vue-stack/table-core`](../table-core).

## Installation

```sh
pnpm add @vue-stack/table
```

```sh
npm install @vue-stack/table
```

```sh
yarn add @vue-stack/table
```

Vue 3.5 or later is a peer dependency. The package re-exports the core and
[`@vue-stack/flip`](../flip), the engines that play `useTableMotion` and the drags, so a table
imports everything from `@vue-stack/table`. Dragging rows and columns comes from
`@vue-stack/table/drag-and-drop` and needs `@vue-stack/drag-and-drop`, an optional peer dependency.

## Documentation

The documentation site lives in [`docs/`](../../docs): run `pnpm docs` from the repository root. Its
pages are Markdown files in `docs/content/`:

- Overview: [introduction](../../docs/content/overview/introduction.md),
  [getting started](../../docs/content/overview/getting-started.md),
  [how it fits together](../../docs/content/overview/concepts.md),
  [accessibility](../../docs/content/overview/accessibility.md),
  [styling](../../docs/content/overview/styling.md),
  [performance](../../docs/content/overview/performance.md),
  [inspiration](../../docs/content/overview/inspiration.md)
- Guides: [columns](../../docs/content/guides/columns.md),
  [sorting](../../docs/content/guides/sorting.md),
  [column layout](../../docs/content/guides/column-layout.md),
  [column groups](../../docs/content/guides/column-groups.md),
  [virtualization](../../docs/content/guides/virtualization.md),
  [row selection](../../docs/content/guides/selection.md),
  [trees and grouping](../../docs/content/guides/trees-and-grouping.md),
  [keyboard navigation](../../docs/content/guides/keyboard-navigation.md),
  [cell ranges and clipboard](../../docs/content/guides/cell-ranges.md),
  [editing](../../docs/content/guides/editing.md),
  [drag and drop](../../docs/content/guides/drag-and-drop.md),
  [animation](../../docs/content/guides/animation.md),
  [live data](../../docs/content/guides/live-data.md),
  [loading and empty states](../../docs/content/guides/data-loading.md),
  [your own markup](../../docs/content/guides/custom-markup.md),
  [localization](../../docs/content/guides/localization.md)
- [Components](../../docs/content/components/root.md): every part with its props, slots, data
  attributes and keys
- [Composables](../../docs/content/composables/use-data-table.md): `useDataTable`, the features, and
  every composable under the parts
- [Examples](../../docs/content/examples/index.md): complete tables with their source

## License

MIT
