---
title: Render memo
description: keepMounted and isSameTokens - skipping the render of a row in render functions of your own, as v-memo does in templates.
---

# Render memo

<Description>
For grids rendered by render functions of your own: keep the vnode of a row while the things it
depends on hold, and Vue skips its whole subtree, as <code>v-memo</code> does in a template.
</Description>

<Demo name="api-render-memo" />

`GridRow` needs none of this. It is a component whose `row` prop stays the same object while the
row's data, place and node hold, so Vue skips it by its props. The memo is for markup of your own
that renders rows in one render function, where there is no component per row to skip.

## Usage

```ts
import { isSameTokens, keepMounted, type VirtualItem } from '@vue-data-grid/core';
import { h, type VNode } from 'vue';

const cache = new Map<string, { tokens: unknown[]; vnode: VNode }>();

function renderRow(item: VirtualItem) {
	const row = grid.rows.value[item.index];
	const tokens = [row, item.start, grid.selection?.isSelected(item.key)];
	const cached = cache.get(item.key);

	if (cached && isSameTokens(cached.tokens, tokens)) {
		return keepMounted(cached.vnode);
	}

	const vnode = h('div', { key: item.key, ...grid.getRowProps(item) }, renderCells(row));

	cache.set(item.key, { tokens, vnode });

	return vnode;
}
```

The tokens are everything the row's markup reads: the row object, its offset, its selection. While
they hold, the previous vnode comes back marked, and Vue stops at it without walking its cells.

## API

<ReturnsTable
	:data="[
		{ name: 'isSameTokens', type: '(current: readonly unknown[], next: readonly unknown[]) => boolean', description: 'Whether two token lists match, item by item with `Object.is`: the check before `keepMounted`.' },
		{ name: 'keepMounted', type: '<TVNode extends VNode>(vnode: TVNode) => TVNode', description: 'Marks a vnode so that Vue returns it as it is and stops at it when patching. Return the previous vnode, marked, while its tokens match.' },
	]"
/>

## Choosing tokens

- **The row object.** Rows are immutable: a changed row is a new object, so the object itself is the
  token of its data.
- **Its place.** `item.start` and `item.size` with positioned rows; the row's index when it shows the
  index.
- **Its state, per row.** `selection.isSelected(key)`, `ranges.getSelectedColumns(index)`: reactive
  per row, they wake only the rows whose state changed.
- **What the whole grid shares.** The rendered columns, `scope.renderedColumns.value`: when the column
  window moves or a column is hidden, every row renders again, which is right.

A token left out is a bug that shows as a stale row; a token too many only costs a render. When in
doubt, add it.

## Examples

### Clearing the cache

Keep the cache as long as the grid, and drop rows that leave the window, so it does not grow:

```ts
watch(grid.items, (items) => {
	const shown = new Set(items.map(item => item.key));

	for (const key of cache.keys()) {
		if (!shown.has(key)) {
			cache.delete(key);
		}
	}
});
```

## Accessibility

A memoized row is skipped whole, attributes included, so its tokens must cover what its ARIA
attributes read: `aria-selected` from the selection, `aria-expanded` and `aria-level` from its tree
node, `aria-rowindex` from its index. The prop-getters read exactly these, which is why they belong
among the tokens.

## See also

- [Performance](/overview/performance): the row memo of the parts.
- [Body](/components/body): `GridBody` and `GridRow`.
- [Your own markup](/guides/custom-markup)
