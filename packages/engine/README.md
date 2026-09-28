# @vue-data-grid/engine

Headless grid core for Vue 3. It models columns (declaration, groups, order, widths, pinning,
hiding, group collapse and sort state), keeps that state in a store of your choice, and turns it into
geometry: `flex`, `position: sticky` and CSS custom properties. It also windows rows and columns, and
ships optional composables for work on rows and cells: sorting, streaming updates, grouping with
aggregates, trees, selection, cell focus, cell ranges, editing with undo, paste and fill, recent
cell changes and CSV.

There is no markup here: no components, no templates, no `h()` calls, no render types. The engine
gives you a `GridScope`, and your own markup renders the grid from it. It is the low-level layer:
[`@vue-data-grid/core`](../core), the main package, builds on it with the render fields of columns,
keyboard navigation, autosize from content and more.

## Install

```sh
pnpm add @vue-data-grid/engine vue
```

Vue 3.5 or later is a peer dependency. The package is ESM-only and free of side effects.

## Quick start

```ts
import { defineComponent, h, shallowRef } from 'vue';
import {
	defineColumn,
	defineColumns,
	getCellText,
	createGridScopeContext,
	useGridEngine,
	useGridGeometry,
} from '@vue-data-grid/engine';

interface Instrument {
	id: string;
	symbol: string;
	price: number;
}

const column = defineColumn<Instrument>();

const columns = defineColumns({
	symbol: column(row => row.symbol, { label: 'Symbol', width: 140 }),
	price: column(row => row.price, { label: 'Price', align: 'right', format: value => value.toFixed(2) }),
});

export default defineComponent({
	props: { rows: { type: Array as () => Instrument[], required: true } },
	setup(props) {
		const root = shallowRef<HTMLElement | null>(null);

		const engine = useGridEngine({
			columns,
			rows: () => props.rows,
			root,
			rowKey: 'id',
			rowHeight: 36,
			virtual: true,
		});

		createGridScopeContext(engine.scope);
		useGridGeometry(root, engine.layers);

		return () => h('div', { ref: root, style: 'overflow: auto; height: 400px' }, [
			h('div', { style: { position: 'relative', height: `${engine.totalSize.value}px` } },
				engine.items.value.map((item) => {
					const row = engine.scope.rows.value[item.index];

					return h('div', {
						key: item.key,
						'data-dg-index': item.index,
						style: { display: 'flex', position: 'absolute', top: `${item.start}px`, height: `${item.size}px` },
					}, engine.scope.renderedColumns.value.map(rendered => h('div', rendered.cellProps,
						rendered.column ? getCellText(rendered.column, row) : undefined)));
				})),
		]);
	},
});
```

A real grid also renders a header from `headerProps`, handles gestures and memoizes rows. The core
styles only the geometry of a cell: its width, grow factor and pin. `align` becomes a `data-dg-align`
attribute, and the layout of a cell, alignment included, comes from CSS: the structural styles of
`@vue-data-grid/core` (`@vue-data-grid/core/style.css`), or rules of your own on `[data-dg-column]` and
`[data-dg-align]`. Without them the `price` column above is not right-aligned.
The documentation site in [`docs/`](../../docs) documents `@vue-data-grid/core`, which re-exports this
core: its [core page](../../docs/content/composables/core.md) maps the exports, and a guide on
[your own markup](../../docs/content/guides/custom-markup.md) renders a grid from the engine. Run it
with `pnpm docs` from the repository root. Every export carries JSDoc with the details.

## Service columns and row headers

A column holds data of the row unless it says `kind: 'service'`: a checkbox, a row number, actions.
Service columns are real columns, pinned, resized and moved like any other, but `toCsv`,
`useCellRanges`, `useCellChanges` and autosize in `@vue-data-grid/core` leave them out unless told
otherwise (`includeService`, or naming the columns).

One column names each row for assistive technology: the first shown data column, or every column
with `rowHeader: true`; `rowHeader: false` on the first data column leaves the grid without one.
`RenderedColumn.rowHeader` marks it, and the column window always renders it in its place, with
spacers on both sides, so a row keeps its accessible name while scrolled sideways. Spacers are told
apart by `key` (`dg-spacer-start`, `dg-spacer-start-1`, …); every rendered column and group cell
has a `key` for `v-for`.

## What the core does, and what is left to you

| Core | Your markup |
| --- | --- |
| column order, widths, pinning, hiding, sort state | header, body, footer, rows and cells |
| keeping that state in `localStorage`, memory or your own store | a server-side store, if you want one |
| column groups: header rows, cells, collapse, keep-together | how groups look: rows, one line, a collapse control |
| row and column windows, scrolling to a row or a column | pinned rows |
| service columns (`kind: 'service'`) and row headers | what service cells show: checkboxes, numbers, actions |
| geometry as CSS variables, the layer of pinned cells (`--dg-pinned-z-index`), widths in one write, fit to viewport | styling, ARIA roles and attributes: the core gives the numbers |
| stable references for memoization; a row moved in the data, `moveRow` | dragging rows and columns, as in `@vue-data-grid/core/drag-and-drop` |
| sorting, streaming, grouping, trees, selection as separate composables | filtering, loading data, selection gestures, checkboxes |
| cell focus and ranges: addresses by row key (`{ key, column }`) and by row index (`{ index, column }`), moves, adding ranges and taking cells out, reactivity per row, range rectangles, clipboard text | key bindings, `tabindex`, `element.focus()`, drawing ranges, clipboard writes |
| editing: rights, parsing, validation, immutable writes with a source, `onBeforeCommit`, undo and redo | editors, their keys, showing errors, saving rows |
| recent changes of cell values and their direction | the flash or arrow that shows them |
| cell text through `format`, CSV, reading pasted text as a spreadsheet does and laying it over a selection | files, `Blob`, downloads, the `paste` event |

The engine learns about the right-hand side through `insets`, `rows`, and what must stay rendered:
`keepRows`, `keepColumns` or `scope.keepRendered`.

## Entry points

- `@vue-data-grid/engine` is the stable API. Everything in the guides is imported from here.
- `@vue-data-grid/engine/internals` exposes the building blocks `useGridEngine` is made of, for
  those who assemble their own engine. It is not covered by semver: signatures there change together
  with the engine, including in minor releases. Nothing from the root entry is repeated there.

## Source layout

```
src/
	persist/        stores and usePersistedState: keeping any state between visits
	columns/        column declaration, order, layout, header sort, column state
	column-groups/  column groups: declaration, header rows, collapse
	engine/         useGridEngine and GridScope; column reconciliation, fit, resize
	virtual/        row and column windows, scrolling, viewport
	render/         what markup uses: CSS variables, cell styles
	rows/           row pipeline: sorting, streaming, grouping with aggregates, trees, selection, row keys
	cells/          cell addresses, focus, ranges, editing, history, paste, fill, cell changes, CSV
	shared/         stableComputed, the model ref, the row token
```

A folder is a feature: it holds both the pure logic and the composable on top of it. Reactivity
lives only in `use-*` files. The other files never call `ref`, `computed` or `watch`, so they can be
tested with plain function calls. The one exception is `shared/stable-computed.ts`, which is itself
a reactive primitive.

Each folder has an `index.ts` with everything it exports to its neighbours and to the entry points.
The root `index.ts` and `internals.ts` export only from those barrels, and `tests/entries.spec.ts`
checks that every folder export lands in exactly one entry point.

Folders depend on each other in one direction only, by layers: `shared`, `persist` ← `columns` ←
`render`, `rows` ← `column-groups`, `virtual` ← `engine` ← `cells`. A folder imports only folders of
lower layers, and `tests/folders.spec.ts` fails on anything else, so any folder can be moved into a
package of its own.

## Tests

Run `pnpm test` from the repository root. `tests/` mirrors `src/`.
