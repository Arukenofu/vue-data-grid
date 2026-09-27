---
title: useStickyOffset
description: The height of a sticky block, such as a header or a footer, tracked without reading layout on every frame.
---

# useStickyOffset

<Description>
The height of a sticky block, such as the header or the footer of a table, tracked with a
<code>ResizeObserver</code>. The engine needs it to keep scrolled-to rows clear of what sticks over them.
</Description>

`useDataTable` measures its header and footer with it and hands the heights to the engine, as
`table.headHeight` and `table.footHeight`. You need it yourself when you build on the core engine, or
when something else sticks to the top or the bottom of the table.

## Usage

```ts
import { useStickyOffset, useTableEngine } from '@vue-stack/table';
import { shallowRef } from 'vue';

const root = shallowRef<HTMLElement | null>(null);
const head = shallowRef<HTMLElement | null>(null);
const foot = shallowRef<HTMLElement | null>(null);

const engine = useTableEngine({
	columns,
	rows,
	root,
	rowKey: 'id',
	rowHeight: 40,
	virtual: true,
	scrollMargin: useStickyOffset(head),
	scrollMarginEnd: useStickyOffset(foot),
});
```

Bind `head` and `foot` with `:ref` to the sticky elements. The height is read once when the element
arrives, so the first frame is right, and then follows the observer. It is `0` while there is no
element.

## Arguments

<PropsTable
	label="Argument"
	:data="[
		{ name: 'element', type: 'Ref<HTMLElement | null>', required: true, description: 'The sticky block: the header, the footer, or rows pinned to an edge.' },
	]"
/>

## Returns

`ShallowRef<number>`: the height of the block, px, border included; `0` without an element.

## Examples

### A toolbar that sticks above the header

Something that sticks at the top together with the header adds to the room scrolling must keep clear:

```ts
const headHeight = useStickyOffset(head);
const toolbarHeight = useStickyOffset(toolbar);

const engine = useTableEngine({
	columns,
	rows,
	root,
	rowKey: 'id',
	rowHeight: 40,
	scrollMargin: () => headHeight.value + toolbarHeight.value,
});
```

### A bar that stands on the footer

`TableLoading` places itself above the footer with `table.footHeight`, the same measure. A bar of
your own can do the same:

```vue
<div class="bulk-bar" :style="{ insetBlockEnd: `${table.footHeight.value}px` }">…</div>
```

## Accessibility

- Keyboard focus relies on it: a cell focused with the arrow keys or scrolled to with `scrollToRow` is
  brought out from under the sticky header and footer, not left hidden behind them.
- Page steps, <kbd>PageUp</kbd> and <kbd>PageDown</kbd>, count only the rows between the sticky
  blocks, so a page is what the eye sees.

## See also

- [useDataTable](/composables/use-data-table): `headHeight` and `footHeight`.
- [The core](/composables/core): the engine that takes `scrollMargin` and `scrollMarginEnd`.
- [Virtualization](/guides/virtualization)
