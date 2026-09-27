# @vue-data-grid/drag-and-drop

Drag and drop for Vue lists and trees: with a mouse, a finger or the keyboard. Nothing re-renders
during a gesture: the source and the target get attributes, items may make room through their
`translate`, and on the drop you get a key, a parent and an index to apply to your data. Items may
unmount and mount again in the middle of a drag, so it works under a virtual window.

```sh
pnpm add @vue-data-grid/drag-and-drop vue
```

Vue 3.5 or later is a peer dependency; Vapor components of Vue 3.6 are supported (see
[Vapor](#vue-36-vapor)). The package is ESM-only and free of side effects, and depends only on
`@vue-data-grid/flip`, the engines of its movement, not on `@vue-data-grid/engine`.

## A sortable list

```vue
<script setup lang="ts">
import { useDragList, vDragItem } from '@vue-data-grid/drag-and-drop';
import { shallowRef, useTemplateRef } from 'vue';

const tasks = shallowRef([{ id: 'a', title: 'Write' }, { id: 'b', title: 'Review' }, { id: 'c', title: 'Ship' }]);
const container = useTemplateRef<HTMLElement>('container');

const { list, describedBy } = useDragList({
	kind: 'task',
	axis: 'vertical',
	keys: () => tasks.value.map(task => task.id),
	container,
	getLabel: key => tasks.value.find(task => task.id === key)?.title ?? key,
	onDrop: ({ key, index }) => {
		const moved = tasks.value.find(task => task.id === key)!;
		const rest = tasks.value.filter(task => task.id !== key);

		tasks.value = [...rest.slice(0, index), moved, ...rest.slice(index)];
	},
});
</script>

<template>
	<ul ref="container">
		<li
			v-for="task in tasks"
			:key="task.id"
			v-drag-item="{ list, key: task.id }"
			tabindex="0"
			:aria-describedby="describedBy"
		>
			{{ task.title }}
		</li>
	</ul>
</template>
```

`index` is the position among the siblings **once the item is taken out**: remove the item, then
insert it at `index`. A place where a drop would change nothing is never offered.

## What to style

| | |
| --- | --- |
| `[data-drag-source]` | the item being dragged; it stays in place, or stands in the gap of `indicator: 'gap'` |
| `[data-drop-target="before" \| "after" \| "inside"]` | the item next to or into which the drop goes |
| `--drop-level` | inline on the target, the indicator and a source in a gap: the nesting level of the place |
| `[data-drag-ghost]` | the ghost under the pointer, when there is a `preview` |
| `[data-drag-landing]` | the item a ghost of `exit: 'land'` flies into after the gesture, until it lands |
| `[data-drop-indicator="before" \| "after" \| "inside"]` | the sliding line of `indicator: 'line'` |
| `html[data-dragging]` | the whole page during a pointer drag, with the `kind` as the value |

```css
[data-drag-source] { opacity: 0.4; }
[data-drop-target] { position: relative; }
[data-drop-target]::after {
	position: absolute;
	inset-inline: calc(var(--drop-level, 0) * 16px) 0;
	height: 2px;
	background: royalblue;
	content: '';
}
[data-drop-target='before']::after { top: -1px; }
[data-drop-target='after']::after { bottom: -1px; }
[data-drop-target='inside'] { outline: 2px solid royalblue; }
```

## Showing the place

`indicator` picks how the place is shown; the `data-drop-target` mark is set in every case.

- `'mark'`, the default: the marks alone, drawn by your CSS as above. The line jumps from item to
  item, since each item draws its own.
- `'line'`: one element, `[data-drop-indicator]`, that slides from place to place. It lives in the
  `container` for the length of a gesture; the package places it along the edge of the place, or
  over the whole item for `'inside'`, and sets `--drop-level` on it. The look is yours:

  ```css
  [data-drop-indicator] { z-index: 1; }
  [data-drop-indicator]::before {
  	position: absolute;
  	inset-inline: calc(var(--drop-level, 0) * 16px) 0;
  	top: -1px;
  	height: 2px;
  	background: royalblue;
  	content: '';
  }
  [data-drop-indicator='inside']::before { inset: 0; height: auto; background: none; outline: 2px solid royalblue; }
  ```

  In a horizontal list the element spans the height of the item and has no width: draw a vertical
  line instead. It is created outside your template, so Vue's scoped styles reach it through
  `:deep([data-drop-indicator])`.
- `'gap'`: the items move apart where the dragged one would go, and the dragged item itself stands
  in the gap, with `--drop-level` set to the level it would land at. Items move through their
  `translate` property, which the package owns during a gesture; `transform`, which virtual lists
  position rows with, is left alone. Nothing changes in layout, so the drop re-renders the items
  exactly where the gap drew them. The dragged item with the shown part of its subtree moves as one
  block; into a collapsed item there is no place to open, and only its mark shows the drop. Items
  that are not rendered are taken as the size of the dragged one, and an item of another list as
  the size of the items at the gap. The gap reads where every item is drawn before it moves any,
  so the browser restyles the list once per move, not once per item. An item drawn by more than
  one element, such as a column of a table, is moved by `shift(shifts, engine)` instead: one call
  gets every item that moved, as a map from key to offset, the list leaves the `translate` of their
  elements to you, and measures the registered element without the one you give it.

`indicator` may be a ref: it is read when each gesture starts.

A place stays until the pointer finds another one. Over a place `canDrop` refuses, between items,
or off the list altogether, the list keeps showing the last place, and a drop there goes to it:
what the gap shows is what the drop does, and Escape cancels. Only the item's own place takes the
gap back home, and only another target, such as a `useDropTarget`, takes the drop away from the
list. Items are found along the list from the pointer, so a column of a table is found with the
pointer over its body cells.

## Movement

The list does not animate anything itself: it changes the DOM, measures what moved, and hands it
to an engine of [`@vue-data-grid/flip`](../flip/README.md), which this package re-exports. The
engine is `motion`: `webAnimations()` by default, one of your own on GSAP, anime.js or Motion, or
`false` for none. Each transition says what it is by its `kind`:

| `kind` | |
| --- | --- |
| `'gap'` | the items making way, and moving back |
| `'indicator'` | the line going to a new place |
| `'settle'` | once the drop has re-rendered the list, the items going from where they were drawn to where they are, and the items that came in as enters |
| `'ghost'` | the ghost landing on its item as a move, or leaving as a leave |

```ts
import { type MotionEngine, useDragList, webAnimations } from '@vue-data-grid/drag-and-drop';

const slide = webAnimations({ duration: 250 });

// The gap and the ghost as usual, the rest at once.
const engine: MotionEngine = transition => (transition.kind === 'gap' || transition.kind === 'ghost' ? slide(transition) : undefined);

useDragList({ /* … */ motion: engine });
```

`motion` is a ref rather than a getter, since an engine is a function itself; it is read when each
gesture starts. `webAnimations()` plays nothing for a reduced motion preference of the user.
`settle: false` leaves the movement after a drop to something else that animates every new order,
such as the markup: the gap still closes without a jump.

The list positions the items, the line and the ghost by their `translate`. An engine of your own
moves them by `transform`, as GSAP and Motion do with `x` and `y`, or layers over `translate` with
`composite: 'add'`, rather than write `translate` inline.

How the ghost ends is `preview.exit`: `'fade'`, the default, fades it where it is, which suits a
label or a card; `'land'` flies it into the item it becomes (back to where it was when the gesture
drops nowhere, and fading over a `useDropTarget`), which suits a ghost that looks like the item;
`'none'` removes it at once.

The list positions the items of the gap, the line and the ghost by `translate`: an engine moves
them by `transform`, or layers over `translate` with `composite: 'add'`, as `webAnimations()`
does; a `transition` stays yours. Under a virtual window an item that mounts in the middle of a
gesture takes its place at once. An element is in one transition at a time: a new change of it
cuts the running one short, whoever started it, `@vue-data-grid/core` included, and carries on from
where the element is drawn.

While a landing ghost flies, its item has `[data-drag-landing]`: for a ghost that looks like the item, hide
the item (`opacity: 0`) so that one of them is seen, not both.

## `useDragList`

| Option | |
| --- | --- |
| `kind` | what the list holds, such as `'task'`: a list accepts only its own kind |
| `axis` | `'vertical'` or `'horizontal'` |
| `keys` | keys of the shown items in display order |
| `container` | the list's area: drags begin in it and targets are looked for over it |
| `onDrop(event)` | `{ key, parent, index, payload, external }`: where the item goes |
| `tree` | nesting of the items, see [Trees](#trees); without it the list is flat |
| `handle` | a selector inside an item that starts a drag; the whole item without it |
| `ignore` | a selector inside an item that never starts a drag: resize handles, buttons |
| `canDrag(key)` | whether an item may be dragged now; asked only when a gesture would start |
| `canDrop(key, target)` | whether `key` may go to this place; a rejected place is not shown |
| `group` | a name shared by lists that take each other's items |
| `canAccept({ payload, external })` | whether to take an item from the group |
| `getData(key)` | what to attach to the payload for other lists, which know nothing but the key |
| `preview` | the ghost: `{ render(key, container), placement, exit }` |
| `scroller` | what to scroll near the edges during a drag; `container` by default |
| `bounds` | an element neither the pointer nor the ghost leaves; the window by default |
| `touchDelay` | the long press before a touch drag starts, ms; `250` by default |
| `autoScroll` | how `scroller`, and the window without `bounds`, scroll while an item nears their edges; `false` for not at all |
| `keyboard` | keyboard dragging; `true` by default |
| `stepKeys` | Alt with the arrows moves an item one place at once; `false` by default |
| `getLabel(key)` | the item's name for screen readers; the key by default |
| `reveal(key)` | brings an item into view during a keyboard drag; `scrollIntoView` by default |
| `announcements` | what screen readers hear; English by default |
| `indicator` | how the place is shown: `'mark'`, `'line'` or `'gap'`, see [Showing the place](#showing-the-place) |
| `motion` | the engine of the movement: `webAnimations()` by default, or `false`, see [Movement](#movement) |
| `settle` | whether the items move after a drop; `true` by default |
| `shift(shifts, engine)` | draws the items the gap moves, all at once, instead of their `translate` |

### Scrolling

While an item is dragged near an edge of `scroller`, the list scrolls it: slowly for most of the
zone and quickly right at the edge. Without `bounds` the window scrolls the same way. `autoScroll`
changes the feel, and is read on every frame:

```ts
useDragList({
	/* … */
	autoScroll: {
		threshold: 64,                     // the zone at each edge, px; 48 by default
		speed: 900,                        // px per second at the edge; 1200 by default
		curve: depth => depth ** 2,        // the share of speed at a depth, 0 to 1; a cube by default
		smoothing: 120,                    // ms for the speed to follow the pointer; 0 by default
		margin: { top: headerHeight },     // what is stuck to the edges: the zones start inside it
	},
});
```

`autoScroll: false` scrolls nothing. The settings are those of `useAutoScroll` in
`@vue-data-grid/core`, for gestures of your own.

`handle`, `ignore`, `touchDelay`, `keyboard`, `stepKeys` and `announcements` may be refs or
getters, as `indicator`, `group`, `bounds` and `settle` may, and `motion` a ref: each is read when
it is needed, so a list follows them without being made again.

| Returns | |
| --- | --- |
| `list` | pass it to `v-drag-item="{ list, key }"` on every item |
| `active` | the key of this list's item being dragged, or `null` |
| `dragging` | the payload being dragged that this list takes, own or from the group |
| `over` | whether the payload is over the list |
| `target` | where the item goes if dropped now, or `null` |
| `describedBy` | the id of the hidden keyboard instructions, for `aria-describedby`; it follows `announcements` |

## Touch

Nothing needs `touch-action`. A finger resting on an item for `touchDelay` starts a drag, and a
finger that moves sooner scrolls the list as usual. With a `handle`, a touch on the handle drags at
once, since a handle is there to drag. Once a touch drag has started, the page does not scroll under
it: the source listens to `touchmove` as a non-passive listener from the moment it is bound, because
browsers decide at the start of a touch whether it may still be cancelled. A long press does not
open the system menu of a link or an image inside the list.

## Keyboard and screen readers

Space or Enter on an item (or on its handle, with `handle`) picks it up. The arrow keys along the
`axis` step through every place the item can go, Home and End jump to the first and the last,
Space or Enter drops, and Escape, Tab or a pointer press cancel. In a right-to-left container the
horizontal arrows follow the reading direction.

With `stepKeys`, Alt with an arrow key along the `axis`, on an item or anything inside it, moves the
item one place among its siblings at once: `onDrop` gets it as a drop there, and it is announced as
one. It suits items that are not focusable themselves, such as the rows of a grid whose cells are.

`canDrag` refuses an item for the pointer, Space and Enter, and Alt with the arrows alike; the keys
of a refused item are left to the page. So are the keys pressed in a field or inside `ignore`.

Items or handles must be focusable (`tabindex="0"`, or a `<button>`) and should point at the
instructions with `aria-describedby="describedBy"`. Each step is read out through a live region:
"Picked up Write, position 1 of 3", "Write: position 2 of 3", "Dropped Write at position 2 of 3".
Replace any text through `announcements`, for another language for example:

```ts
useDragList({
	// …
	announcements: {
		instructions: 'Пробел или Enter, затем стрелки. Пробел или Enter — отпустить, Escape — отмена.',
		pickUp: ({ item, position, total }) => `${item} взят, позиция ${position} из ${total}`,
	},
});
```

`announcements` may be a ref: a new language takes effect at the next announcement, and
`describedBy` points at the new instructions.

Under a virtual window the place may be far from what is rendered: pass `reveal`, such as a
function that scrolls to the item's row, and keep the dragged item rendered while `active` holds
its key. After a keyboard drop, focus returns to the moved item once your list re-renders.

## Trees

```ts
interface DragTree {
	getParent: (key: string) => string | null;
	getLevel: (key: string) => number;
	getChildren: (parent: string | null) => readonly string[];   // in display order, collapsed or not
	canNest: (key: string) => boolean;                             // the item takes children
	isExpanded: (key: string) => boolean;
}
```

Over an item that nests, the middle of it drops inside, as its first child; the edges drop next to
it. Below the middle of an expanded item is its first child. An item never goes into its own
subtree. The keyboard offers the same places, in display order.

## Several lists and drop areas

Lists with the same `group` take each other's items; the drop event then has `external: true`, and
the payload carries `data` from the source's `getData`. `useDropTarget(element, { kinds, group,
canDrop, onDrop })` is an area that takes an item without being a list: a bin, "add to favourites".

## Vue 3.6 Vapor

A Vapor component takes directives as functions rather than objects with hooks, so the directive
comes from its own entry, under the same name:

```ts
import { vDragItem } from '@vue-data-grid/drag-and-drop/vapor';
```

Templates keep `v-drag-item="{ list, key }"`, and `useDragList` and the rest work in both kinds of
components. `useDragPreviewRenderer` renders Vue content into the ghost for components with a
virtual DOM only: in a Vapor component, fill the ghost in `preview.render` yourself.

## With `@vue-data-grid/engine`

Columns: `index` of the drop means what `scope.moveColumnTo(name, index)` expects.

```ts
const columns = useDragList({
	kind: 'column',
	axis: 'horizontal',
	keys: () => scope.columns.value.flatMap(item => item.column ? [item.column.name] : []),
	container: header,
	ignore: '.resize-handle',
	canDrop: (key, target) => scope.canMoveColumnTo(key, target.index),
	reveal: key => scope.scrollToColumn(key),
	onDrop: ({ key, index }) => scope.moveColumnTo(key, index),
});
```

Rows of a `useRowTree`: its API is a `DragTree` already, and `keepRendered` keeps the dragged row in
the row window.

```ts
const dragTree: DragTree = {
	getParent: key => tree.getNode(key)?.parent ?? null,
	getLevel: key => tree.getNode(key)?.level ?? 0,
	getChildren: parent => tree.getChildren(parent),
	canNest: key => tree.getNode(key)?.group ?? false,
	isExpanded: key => tree.isExpanded(key),
};

const rows = useDragList({ kind: 'row', axis: 'vertical', tree: dragTree, reveal: key => scope.scrollToRow(scope.getRowIndex(key)), /* … */ });

scope.keepRendered({ rows: () => (rows.active.value ? [scope.getRowIndex(rows.active.value)] : []) });
```

## Low level

`bindDragSource(element, options)` and `registerDropTarget(handlers)` are the gesture engine the
composables are built on, for your own kind of list. A target's `onDrop` returns where the item
landed, for the ghost to fly to: an element, a promise of it once the drop has re-rendered, or
`null` to fade over the target; returning nothing says the target did not take the item, and the
ghost goes back to the source's `home`. A target with `hold` keeps the drag while the pointer is
over no target, and takes a drop there; `onRelease` tells it that another target took the pointer.
`isDragging()` tells whether a pointer drag is in progress. The pure placement functions (`resolvePosition`, `resolveDestination`, `collectDropSlots`,
`createFlatTree`) take a `DragTree` and no DOM.

The engine keeps one gesture for the page in module state: there is one pointer. Two copies of this
package in one bundle would not see each other's lists.
