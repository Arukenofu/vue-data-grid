# @vue-data-grid/docs

The documentation site of `@vue-data-grid/core`: guides, the reference of every part and composable,
and live demos with their source. Built with VitePress, in the manner of the Reka UI docs. Private,
never published.

```sh
pnpm docs                                   # the dev server, from the repository root
pnpm --filter @vue-data-grid/docs build         # the static site; fails on dead links
pnpm vitest run --project docs              # mounts every demo, fails on any warning
pnpm --filter @vue-data-grid/docs typecheck     # vue-tsc over the theme, the kit and the demos
```

The demos import the packages by their public names, `@vue-data-grid/core` and
`@vue-data-grid/core/drag-and-drop`, and get their sources through the aliases of
`.vitepress/aliases.ts`: no build of the packages is needed.

## Layout

```
.vitepress/
	config.ts       the site: navigation, search, markdown, Vite plugins
	sidebar.ts      the sections and their pages
	aliases.ts      package sources, `@/`, `__DEV__`, the icons plugin
	demo-plugin.ts  `<Demo name="…" />`: the demo and the highlighted source of its files
	theme/          the theme over VitePress's default one: colours, the Demo frame, API tables, home
content/          the pages, one Markdown file each: overview, guides, components, composables, examples
demos/<name>/     a demo: `index.vue` and any other files, all shown in the Code view
data/             deterministic sample data, the same on the server and in the browser
ui/               the kit of the demos: tokens, the `ui-table` theme, controls on Reka UI (`@/ui`)
tests/            the demo test
```

## Writing a page

- A page starts with a `<Description>` and shows its demo early: `<Demo name="my-demo" />` on a line
  of its own renders `demos/my-demo`.
- Reference tables are components: `PropsTable`, `ReturnsTable`, `SlotsTable`, `EmitsTable`,
  `DataAttributesTable`, `CssVariablesTable`, `KeyboardTable`; lists of features are `Highlights`.
- Every page has an `## Accessibility` section, with the keys of what it documents.
- Demo code carries no comments, imports only the public API, starts timers in `onMounted`, and
  uses data that is the same on every render, so pages hydrate as they were rendered.
- Every demo must be shown on a page: the demo test fails on one that is not.
