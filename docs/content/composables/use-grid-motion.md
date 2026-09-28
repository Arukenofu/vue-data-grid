---
title: useGridMotion
description: Animates the rows, the columns and the widths of a grid whenever they change, with an engine of your choice.
---

# useGridMotion

<Description>
Animates the rows and the columns of a grid whenever their order changes, from wherever the change
comes, and the widths of the columns when the layout changes them. The grid measures; an engine
plays.
</Description>

<Demo name="motion-engines" />

## Usage

```ts
import { useDataGrid, useGridMotion } from '@vue-data-grid/core';

const grid = useDataGrid({ columns, rows, rowKey: 'id', rowHeight: 40 });

const motion = useGridMotion(grid);
```

Call it in `setup`, after the grid. It needs nothing in the template: it finds the rows by the
attributes the parts put on them. The [Animation](/guides/animation) guide explains what moves and
how to write an engine; this page is the reference.

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'engine', type: 'MaybeRef<MotionEngine | undefined>', default: 'webAnimations()', description: 'Plays the movement. A `ref` rather than a getter, since an engine is a function itself; the engine can change while the grid is shown.' },
		{ name: 'trigger', type: 'MaybeRefOrGetter<\'change\' | \'run\'>', default: '\'change\'', description: 'Which changes animate: every change of the order but those made inside `skip`, or only those made inside `run`.' },
		{ name: 'when', type: '(change: GridMotionChange) => boolean', description: 'Whether to animate a change the `trigger` lets through; asked before anything is measured.' },
		{ name: 'widths', type: 'GridMotionWidths | false', default: '{ duration: 200 }', description: 'How the columns go from their old widths to new ones set by the layout, such as a fit or an autosize; `false` for at once. A resize with the pointer is never animated.' },
	]"
/>

`GridMotionChange` is `{ kind: 'rows' | 'columns' | 'widths', context }`, where `context` is what
`run` passed along, `undefined` for a change made outside it. `GridMotionWidths` is
`{ duration?: number, easing?: (progress: number) => number }`, with the duration in milliseconds.

## Returns

<ReturnsTable
	:data="[
		{ name: 'run', type: '<T>(update: () => T, context?: unknown) => Promise<Awaited<T>>', description: 'Animates the changes `update` makes, with `context` for `when` and the engine, whatever the `trigger`. An async `update` animates the changes made until it settles.' },
		{ name: 'skip', type: '<T>(update: () => T) => Promise<Awaited<T>>', description: 'Makes the changes of `update` without movement, whatever the `trigger`.' },
		{ name: 'stop', type: '() => void', description: 'Cuts the running movement short: every row and cell jumps to its place.' },
	]"
/>

## What it needs of the grid

`useGridMotion` takes the grid of `useDataGrid`, or the same parts of a grid built on the core:
its `scope`, `state` and `root`, and for the rows its `body` with rows that carry `data-dg-index`
(`indexAttribute`). A grid rendered from your own markup with the prop-getters has all of them. The
columns and their widths need only the `root`.

## Engines

An engine is a function of a transition: `{ kind, moves, enters, leaves, context, signal }`. Every
element is already in its final state when the engine is called; a move should look as if it came
from `x`, `y` pixels away. These come from `@vue-data-grid/core`:

<ReturnsTable
	:data="[
		{ name: 'webAnimations(options?)', type: 'MotionEngine', description: 'The default engine on the Web Animations API: `duration` (200 ms), `easing`, and `fade` for enters and leaves.' },
		{ name: 'defineMotionEngine(definition)', type: 'MotionEngine', description: 'An engine from `move`, `enter`, `leave` or `play`, and `stop`; it skips reduced motion and far moves and ends when every animation has finished.' },
		{ name: 'slide(move, timing?)', type: 'Animation | undefined', description: 'The move of `webAnimations()`: a `translate` layered over the element\'s own.' },
		{ name: 'fadeIn(element, timing?)', type: 'Animation | undefined', description: 'The enter of `webAnimations()`.' },
		{ name: 'fadeOut(element, timing?)', type: 'Animation | undefined', description: 'The leave of `webAnimations()`: it stays hidden until the transition ends.' },
		{ name: 'prefersReducedMotion()', type: 'boolean', description: 'Whether the user asks for reduced motion, for an engine written by hand.' },
	]"
/>

The same engines animate [drag and drop](/guides/drag-and-drop), through the `motion` prop of the
drag parts.

### GSAP

```ts
import { defineMotionEngine } from '@vue-data-grid/core';
import { gsap } from 'gsap';

export const gsapEngine = defineMotionEngine({
	move: ({ element, x, y }, index) => gsap.from(element, { x, y, duration: 0.6, delay: index * 0.025, clearProps: 'transform' }),
	enter: element => gsap.from(element, { autoAlpha: 0, duration: 0.4, clearProps: 'opacity,visibility' }),
	leave: element => gsap.to(element, { autoAlpha: 0, duration: 0.3 }),
	stop: tween => tween.progress(1).kill(),
});
```

### Motion

```ts
import { defineMotionEngine } from '@vue-data-grid/core';
import { animate } from 'motion';

export const motionEngine = defineMotionEngine({
	move: ({ element, x, y }) => animate(element, { x: [x, 0], y: [y, 0] }, { type: 'spring', stiffness: 420, damping: 30 }),
	enter: element => animate(element, { opacity: [0, 1] }, { duration: 0.3 }),
	stop: animation => animation.complete(),
});
```

### anime.js

```ts
import { defineMotionEngine } from '@vue-data-grid/core';
import { animate } from 'animejs';

export const animeEngine = defineMotionEngine({
	move: ({ element, x, y }) => animate(element, {
		x: { from: x, to: 0 },
		y: { from: y, to: 0 },
		ease: 'outElastic(1, .75)',
		onComplete: animation => animation.revert(),
	}),
	stop: animation => animation.complete(),
});
```

### Switching engines

```ts
const choice = shallowRef<'web' | 'gsap'>('web');
const engines = { web: webAnimations(), gsap: gsapEngine };

useGridMotion(grid, { engine: computed(() => engines[choice.value]) });
```

## Accessibility

- A user who prefers reduced motion sees no movement: the default engine and every engine of
  `defineMotionEngine` play nothing, and widths change at once. `reducedMotion: 'play'` in an engine
  definition opts in, for movement that is gentle enough.
- Rows that leave are animated as still copies with `aria-hidden="true"`, `inert`, and no role, id or
  index, so assistive technology never meets a row twice.
- The DOM is updated before the movement starts, so screen readers and the keyboard work with the
  final order from the first moment.
