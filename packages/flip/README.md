# @vue-data-grid/flip

Pluggable FLIP transitions. A list changes the DOM, measures what moved, came and went, and hands
it to an **engine**, a plain function, that decides how it looks: the Web Animations API, GSAP,
anime.js, Motion, CSS classes, or nothing. It is what `@vue-data-grid/core` and
`@vue-data-grid/drag-and-drop` animate with, and both re-export it.

```sh
pnpm add @vue-data-grid/flip
```

No dependencies, Vue included. ESM-only and free of side effects.

## The engine

```ts
type MotionEngine = (
	transition: MotionTransition,
) => PromiseLike<unknown> | void;

interface MotionTransition {
	kind: string; // what changed, named by whoever changed it: 'rows', 'gap', your own
	moves: readonly { element: Element; x: number; y: number }[];
	enters: readonly Element[];
	leaves: readonly Element[];
	context: unknown; // whatever the one who started the change passed along
	signal: AbortSignal;
}
```

Every element is in its final state when the engine is called:

- a **move** stands at its new place, and should look as if it came from `x`, `y` px away;
- an **enter** is shown where it is;
- a **leave** is a still element standing where the thing that left was, removed from the DOM
  once the transition ends.

The transition ends when the returned promise settles, or at once when nothing is returned. When
`signal` aborts, because a new change of the same elements cuts the transition short, the engine
puts every element in its final state at once: the new change measures where the elements are
drawn first, and carries on from there.

An engine animates over the styles of the elements and leaves them as they were: whoever changed
the DOM may position the elements by their inline styles, and an engine that writes over them
breaks the layout. `webAnimations()` layers its moves over the element's own `translate`.

### `webAnimations(options?)`

The default engine: moves `slide` by `translate`, layered over the element's own with
`composite: 'add'`; enters `fadeIn` to the element's own opacity, leaves `fadeOut` from it. A move
from farther than a screen away is not played, and a reduced motion preference of the user plays
nothing.

| Option     |                                                                    |
| ---------- | ------------------------------------------------------------------ |
| `duration` | ms; `200` by default, `0` plays nothing                            |
| `easing`   | a CSS easing of the moves; `cubic-bezier(0.2, 0, 0, 1)` by default |
| `fade`     | whether enters and leaves fade; `true` by default                  |

### Your own: `defineMotionEngine`

`defineMotionEngine` writes an engine as how each element moves, comes and goes, and keeps the
rest of the contract for it: a reduced motion preference of the user plays nothing, moves from
farther than a screen away are left out, a transition that is cut short stops every animation, and
the transition ends once they have all finished.

```ts
import { defineMotionEngine, fadeIn, slide } from "@vue-data-grid/flip";

const cascade = defineMotionEngine({
	move: (move, index) => slide(move, { duration: 300, delay: index * 20 }),
	enter: (element) => fadeIn(element),
});
```

`slide`, `fadeIn` and `fadeOut` are the animations of `webAnimations()`: a move slides over the
element's own `translate`, an enter fades in to its own opacity, a leave fades out and stays
hidden. Each takes the timing of `Element.animate`, and waits at its start during a `delay`.

An engine on a library returns its animations and says how they stop:

```ts
import { defineMotionEngine } from "@vue-data-grid/flip";
import gsap from "gsap";

const engine = defineMotionEngine({
	move: ({ element, x, y }, index) =>
		gsap.from(element, { x, y, delay: index * 0.02, clearProps: "transform" }),
	leave: (element) => gsap.to(element, { opacity: 0, duration: 0.2 }),
	stop: (tween) => tween.progress(1).kill(),
});
```

| Field                               |                                                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `move(move, index, transition)`     | plays an element that moved; `index` is its place among the moves                                                                                                 |
| `enter(element, index, transition)` | plays an element that came                                                                                                                                        |
| `leave(element, index, transition)` | plays an element that goes; it is removed once the transition ends                                                                                                |
| `play(transition)`                  | plays the transition as a whole, such as one timeline; a function alone is `play`                                                                                 |
| `stop(animation)`                   | puts an animation at its end when the transition is cut short; without it, animations of the Web Animations API are cancelled and others are left to the engine |
| `reducedMotion`                     | `'skip'`, the default, plays nothing for a user who prefers reduced motion; `'play'` plays                                                                        |
| `farMoves`                          | `'skip'`, the default, leaves out moves from farther than a screen away; `'play'` keeps them                                                                      |

Each part returns an animation, a list, or nothing: one of the Web Animations API, anything with a
`finished` promise (Motion), or a thenable (a promise, a GSAP tween or timeline). An engine written
by hand as a plain function fits wherever an engine does.

An engine may decide by `kind` and `context`: skip some transitions, play others longer.

## Your own lists

`captureLayout(items)` is the first step of a FLIP: it measures where the items are drawn before a
change, and cuts short the transitions they are in. After the change, `animate` measures them again
and plays what moved and what came with an engine:

```ts
import { captureLayout, webAnimations } from "@vue-data-grid/flip";

const engine = webAnimations();

async function shuffle() {
	const capture = captureLayout(list.value.children);

	items.value = shuffled(items.value);
	await nextTick();
	capture.animate(list.value.children, engine, { kind: "shuffle" });
}
```

An item is an element, or a `[key, element]` pair for an element that re-renders: an item with a
captured key is a move, an item with a new key is an enter. Elements a cut short transition was
moving are moves too, from where they were drawn. `compare(items)` returns the moves and the enters
without playing them, and every measurement comes before any write.

|                                  |                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `captureLayout(items)`           | measures, and returns `{ compare, animate }`                                                                    |
| `playMotion(engine, change)`     | plays a change already in the DOM: `{ kind, moves?, enters?, leaves?, context? }`; returns `{ finished, stop }` |
| `stopMotion(elements)`           | cuts short the transitions the elements are in, whoever started them                                            |
| `webAnimations(options?)`        | the engine of the Web Animations API                                                                            |
| `defineMotionEngine(definition)` | an engine from `move`, `enter`, `leave` or `play`, and `stop`                                                   |
| `slide`, `fadeIn`, `fadeOut`     | the animations of `webAnimations()`, with timing of your own                                                    |
| `prefersReducedMotion()`         | whether the user asks for reduced motion                                                                        |

An element is in one transition at a time, whichever package started it: a new one cuts the
running one short rather than playing on top of it.

## License

MIT
