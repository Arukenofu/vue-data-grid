# vue-data-grid

Headless table building blocks for Vue 3. MIT.

| Package | |
| --- | --- |
| [`@vue-data-grid/core`](./packages/core) | column model, row and column windows, CSS-variable geometry, row pipeline |
| [`vue-data-grid`](./packages/vue-data-grid) | the main package on top of the core: render fields of columns, keyboard navigation, autosize, sticky offset, render memo; headless components next |
| [`@vue-data-grid/drag-and-drop`](./packages/drag-and-drop) | drag and drop for lists and trees: pointer, touch and keyboard, Vue 3.6 Vapor ready; independent of the core |

The documentation of `vue-data-grid`, with guides, the API reference and live demos, is the VitePress
site in [`docs/`](./docs): run `pnpm docs`.

## Development

Requires Node.js 22.12+ and pnpm 12 (`corepack enable` picks the version from `packageManager`).

```sh
pnpm install
pnpm exec playwright install chromium   # once: the browser tests of vue-data-grid run in it
pnpm check        # lint, typecheck, test, build
pnpm test:watch
pnpm docs         # the documentation site with live demos
```

| Script | |
| --- | --- |
| `pnpm build` | builds every package: Vite library mode for JS, `tsc` for declarations; the docs as a static site |
| `pnpm test` | Vitest across all packages and the demos of the docs (`vitest.config.ts`), the browser tests of `vue-data-grid` in headless Chromium included |
| `pnpm vitest run --project vue-data-grid-browser` | only the browser tests: autosize, scrolling from under sticky blocks, focus |
| `pnpm typecheck` | `tsc` per package, sources and tests; `vue-tsc` for the docs |
| `pnpm docs` | a dev server of the documentation site |
| `pnpm lint` | oxlint |
| `pnpm --filter @vue-data-grid/core lint:package` | publint over the packed package |

## Layout

```
packages/
  core/
    src/            index.ts (stable API), internals.ts (building blocks, no semver)
    tests/          mirrors src/
    vite.config.ts  build and test config of the package
  vue-data-grid/    the same layout; tests run against the sources of core
  drag-and-drop/    the same layout: src/, tests/, vite.config.ts
docs/               the documentation site of vue-data-grid: VitePress, live demos, the styled kit
tsconfig.base.json  shared compiler options
pnpm-workspace.yaml workspace and version catalog
```

Packages are ESM-only, ship `.d.ts` next to each module and declare `sideEffects: false`. Dev-only code
checks `__DEV__`, which the build turns into `process.env.NODE_ENV !== 'production'`, so the consumer's
bundler strips it from production builds.
