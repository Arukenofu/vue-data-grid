---
title: Animation
description: Rows and columns move into place instead of jumping, with the Web Animations API, GSAP, Motion, anime.js or an engine of your own.
---

# Animation

<Description>
When rows are sorted, dragged, filtered or streamed in, they can move into place instead of jumping.
The table measures what moved, came and went; an engine of your choice plays it: the Web Animations
API, GSAP, Motion, anime.js, or a function of your own.
</Description>

<Demo name="motion-engines" />

Pick an engine and press the buttons. Every change goes through the same measurement, and only the
engine differs: open the code and compare `gsap.ts`, `motion.ts` and `anime.ts`, each a dozen lines.

## One line to turn it on

```ts
import { useDataTable, useTableMotion } from 'vue-data-grid';

const table = useDataTable({ columns, rows, rowKey: 'id', rowHeight: 40 });

useTableMotion(table);
```

From then on, whatever changes the order of the table animates, wherever the change comes from: a
header click, a drag, a group expanded, new data from a server, your own code.

- Rows that **stay** slide from where they were drawn to their new place.
- Rows that **come** fade in where they stand.
- Rows that **go** fade out where they stood, as still copies of themselves: the real row is already
  gone from the table.
- **Columns** that change order slide sideways, every cell of them, the header included.
- **Widths** that the layout changes, by fitting the columns, an autosize or a reset, grow and
  shrink to the new ones. A resize with the pointer is never animated: the edge follows the pointer.

### How it works

The technique is called FLIP. Just before Vue renders a change, the table measures where the rows
are drawn. After the render, it measures them again at their new places, and hands the engine each
element with the distance it moved. The engine plays the element back from the old place to the new
one.

This means the DOM is already final when the animation starts. Nothing is rendered again during it,
the rows keep their real positions, and a second change in the middle of an animation cuts it short
and starts from wherever the rows are drawn at that moment.

## Choosing what animates

By default every change of the order animates. Two options narrow that down:

```ts
const motion = useTableMotion(table, {
	trigger: 'change',
	when: change => change.kind !== 'rows' || rows.value.length < 500,
});
```

- `trigger: 'change'`, the default, animates every change; `'run'` animates only the changes made
  inside `motion.run()`.
- `when(change)` is asked about each change before anything is measured: `change.kind` is `'rows'`,
  `'columns'` or `'widths'`, and `change.context` is whatever `run` passed along.

`run` and `skip` decide for one change at a time, whatever the options say:

```ts
await motion.skip(() => {
	rows.value = freshPageFromServer;
});

await motion.run(() => {
	table.state.sort.value = [{ name: 'points', direction: 'desc' }];
}, { reason: 'leaderboard' });
```

Both return a promise that settles once the change is rendered; an async `update` animates the
changes it makes until it settles. `motion.stop()` cuts whatever is playing short, and every row
jumps to its place.

### Widths

Width changes of the layout play frame by frame through the table's own geometry, without rendering a
cell. They take `widths: { duration, easing }`, 200 ms with a quick start that slows into place by
default, or `widths: false` to apply new widths at once.

## Engines

An engine is the part that decides how movement looks. The default is `webAnimations()`, on the
browser's Web Animations API, with no dependency:

```ts
import { useTableMotion, webAnimations } from 'vue-data-grid';

useTableMotion(table, {
	engine: webAnimations({ duration: 320, easing: 'cubic-bezier(0.2, 0, 0, 1)', fade: true }),
});
```

`engine` also takes a `ref`, so the engine can change while the table is on screen, as in the demo.

### Your own with `defineMotionEngine`

`defineMotionEngine` writes an engine as three small functions: how an element **moves**, how it
**enters** and how it **leaves**. Each gets the element; a move also gets `x` and `y`, the distance
from where it was drawn, and every function gets its `index` among the others, for a stagger:

```ts
import { defineMotionEngine, fadeIn, slide } from 'vue-data-grid';

const cascade = defineMotionEngine({
	move: (move, index) => slide(move, { duration: 300, delay: index * 20 }),
	enter: element => fadeIn(element, { duration: 250 }),
});
```

The engine keeps the rest of the contract for you: a user who prefers reduced motion gets no
movement, moves from farther than a screen away are left out (they would only flash by), a change
that cuts the movement short stops every animation, and the transition ends when they all finish.
`slide`, `fadeIn` and `fadeOut` are the animations of `webAnimations()`, with timing of your own.

Each function returns what it started: an animation of the Web Animations API, anything with a
`finished` promise, or anything with a `then`. `stop` says how to put an animation at its end when
the movement is cut short.

### GSAP

GSAP tweens are thenable, so they fit as they are. `gsap.from` plays the element from the old place
to where it already stands, and `clearProps` leaves its styles as they were:

```ts
import { defineMotionEngine } from 'vue-data-grid';
import { gsap } from 'gsap';

export const gsapEngine = defineMotionEngine({
	move: ({ element, x, y }, index) => gsap.from(element, {
		x,
		y,
		duration: 0.6,
		delay: index * 0.025,
		ease: 'power3.out',
		clearProps: 'transform',
	}),
	enter: element => gsap.from(element, { autoAlpha: 0, x: -24, duration: 0.45, clearProps: 'opacity,visibility,transform' }),
	leave: element => gsap.to(element, { autoAlpha: 0, x: 48, duration: 0.3 }),
	stop: tween => tween.progress(1).kill(),
});
```

### Motion

[Motion](https://motion.dev)'s `animate` returns controls with a `finished` promise, and springs come
for free:

```ts
import { defineMotionEngine } from 'vue-data-grid';
import { animate } from 'motion';

export const motionEngine = defineMotionEngine({
	move: ({ element, x, y }, index) => animate(
		element,
		{ x: [x, 0], y: [y, 0] },
		{ type: 'spring', stiffness: 420, damping: 30, delay: index * 0.02 },
	),
	enter: element => animate(element, { opacity: [0, 1], scale: [0.94, 1] }, { duration: 0.35 }),
	leave: element => animate(element, { opacity: 0, scale: 0.94 }, { duration: 0.25 }),
	stop: animation => animation.complete(),
});
```

### anime.js

[anime.js](https://animejs.com) 4 animations are thenable too. `revert` on completion takes away the
inline styles it wrote, so a row is left exactly as the table drew it:

```ts
import { defineMotionEngine } from 'vue-data-grid';
import { animate, type JSAnimation } from 'animejs';

function clear(animation: JSAnimation) {
	animation.revert();
}

export const animeEngine = defineMotionEngine({
	move: ({ element, x, y }, index) => animate(element, {
		x: { from: x, to: 0 },
		y: { from: y, to: 0 },
		duration: 700,
		delay: index * 20,
		ease: 'outElastic(1, .75)',
		onComplete: clear,
	}),
	enter: element => animate(element, { opacity: { from: 0, to: 1 }, duration: 400, onComplete: clear }),
	leave: element => animate(element, { opacity: 0, x: 40, duration: 280 }),
	stop: animation => animation.complete(),
});
```

::: tip Leave the styles as they were
The table positions rows by their `top` and moves dragged rows by `translate`. An engine animates
over them and leaves them alone: `clearProps` in GSAP, `revert` in anime.js. A row left with a
`transform` of its own gets its own stacking context, and an editor's message or list that should
hang over the rows below would then be covered by them.
:::

### A plain function

An engine does not need `defineMotionEngine` at all: it is any function of the transition. The
transition says what changed, `kind` and `context`, and lists the `moves`, `enters` and `leaves`.
That makes an engine a good place to decide, such as animating the rows but not the columns:

```ts
import type { MotionEngine } from 'vue-data-grid';

const rowsOnly: MotionEngine = transition => (transition.kind === 'rows' ? gsapEngine(transition) : undefined);
```

Returning nothing ends the transition at once. `() => undefined` is the engine that animates
nothing, the "None" of the demo.

## The height of the table

A table that grows with its rows, instead of scrolling, changes its height when rows come and go.
The rows glide, but the container would jump to its new height at once, and the page under it with
it. The demo animates the container too, with the same technique as the rows, applied to one
element: measure its height before the change, let Vue render, measure again, and play the
difference with the selected engine.

```ts
import { prefersReducedMotion } from 'vue-data-grid';
import { nextTick, watch } from 'vue';

watch(() => table.totalSize.value, async () => {
	const element = table.root.value;

	if (!element || prefersReducedMotion()) {
		return;
	}

	const from = element.getBoundingClientRect().height;

	await nextTick();

	const to = element.getBoundingClientRect().height;

	gsap.fromTo(element, { height: from }, { height: to, duration: 0.5, ease: 'power3.out', clearProps: 'height' });
}, { flush: 'pre' });
```

`table.totalSize` is the height of all body rows, so it changes exactly when rows are added or
removed, not when they are sorted or shuffled. The watcher runs before the render, while the table
still has its old height; after `nextTick` the table has its new one, and the tween plays from the
old to the new, then clears its inline height so the table follows its content again. Open
`height.ts` in the demo for the version of each engine: `element.animate()` for Web Animations,
`animate()` of Motion and anime.js, and nothing for "None".

Two details keep the page still:

- the table does not scroll vertically, `overflow-y: hidden`, so no scrollbar flashes while its
  height catches up with the rows;
- the area around it keeps the height of the table at its largest, so the page under the demo does
  not move while the table grows or shrinks inside it.

## Drags

Dragging has an engine of its own: the gap that opens where a row would land, the ghost, and the row
settling after the drop. Pass it to the drag parts with `motion`, or `false` for none. With
`useTableMotion` as well, a dropped row still moves only once: the later transition cuts the earlier
one short.

```vue
<TableRowDrag :motion="gsapEngine" @drop="reorder">
```

## Reduced motion

People who set "reduce motion" in their system get no movement: `webAnimations()` and every engine of
`defineMotionEngine` play nothing for them, and widths change at once. An engine that should play
anyway, such as a gentle fade, says `reducedMotion: 'play'`. A hand-written engine checks
`prefersReducedMotion()` itself.

## Accessibility

- The DOM is final before anything moves, so a screen reader reads the new order at once; the
  animation is only drawn on top of it.
- The still copies of leaving rows are hidden from assistive technology and inert: no role, no ids,
  no index, `aria-hidden="true"`. Nothing takes them for rows.
- Focus stays on the row it was on while that row slides away, and the grid navigation brings it
  back after a render that moved the row in the DOM.
- The reduced motion preference is respected by default, for rows, columns, widths and drags.

## See also

- [`useTableMotion`](/composables/use-table-motion): the options and the handle in full.
- [Drag and drop](/guides/drag-and-drop): the movement of drags.
- [Live data](/guides/live-data): streaming updates, where you may want `when` to skip large batches.
