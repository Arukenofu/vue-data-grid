---
title: useAutoScroll
description: Scrolls a container while the pointer is near its edges during a gesture of your own — faster the closer it gets, as a browser does.
---

# useAutoScroll

<Description>
Scrolls a container while the pointer is near its edges during a gesture of your own: the closer to
an edge, the faster, and faster still past it, as a browser does when it selects text. Frames run
only while it scrolls.
</Description>

<Demo name="api-use-cell-drag" />

Press on a row and drag towards the bottom edge of the table: the drag under this demo scrolls with
`useAutoScroll`, starting inside the sticky header and footer rather than at the edges of the box.

## Usage

Call `start` when the gesture starts, `move` with every pointer move and `stop` when it ends.
`onScroll` tells you when the content moved under a pointer that stood still, so the gesture can
look at what is under it now.

```ts
import { useAutoScroll } from '@vue-data-grid/core';

const autoScroll = useAutoScroll(() => table.root.value, {
	margin: () => ({ top: table.headHeight.value, bottom: table.footHeight.value }),
	onScroll: point => updateUnder(point),
});

function onPointerdown(event: PointerEvent) {
	autoScroll.start({ x: event.clientX, y: event.clientY });
	window.addEventListener('pointermove', onPointermove);
	window.addEventListener('pointerup', onPointerup, { once: true });
}

function onPointermove(event: PointerEvent) {
	autoScroll.move({ x: event.clientX, y: event.clientY });
}

function onPointerup() {
	autoScroll.stop();
	window.removeEventListener('pointermove', onPointermove);
}
```

## Options

<PropsTable
	label="Option"
	:data="[
		{ name: 'margin', type: 'MaybeRefOrGetter<{ top?, right?, bottom?, left? }>', description: 'What is stuck to the edges of the scroller, px, such as the header and pinned columns: the zones start inside it, where the content that scrolls is seen. Physical sides, as the pointer is.' },
		{ name: 'threshold', type: 'MaybeRefOrGetter<number>', default: '32', description: 'How deep the zone at each edge is, px; never more than a third of the scroller.' },
		{ name: 'speed', type: 'MaybeRefOrGetter<number>', default: '600', description: 'The speed at the edge itself, px per second.' },
		{ name: 'curve', type: '(depth: number) => number', default: 'linear', description: 'The share of `speed` at a depth into the zone: `0` where it starts, `1` at the edge, up to `3` past it.' },
		{ name: 'smoothing', type: 'MaybeRefOrGetter<number>', default: '0', description: 'How long the speed takes to follow the pointer, ms: a soft start, a soft stop, and no jerk when the pointer twitches.' },
		{ name: 'axis', type: 'MaybeRefOrGetter<\'x\' | \'y\' | \'both\'>', default: '\'both\'', description: 'Which way it scrolls.' },
		{ name: 'onScroll', type: '(point: { x, y }) => void', description: 'The scroller moved while the pointer stood still over it: what is under the pointer changed. Called after each frame that scrolled.' },
	]"
/>

## Returns

<ReturnsTable
	:data="[
		{ name: 'start', type: '(point: { x, y }) => void', description: 'A gesture starts at a point in viewport coordinates.' },
		{ name: 'move', type: '(point: { x, y }) => void', description: 'The pointer moved; it scrolls towards the edge it is near.' },
		{ name: 'stop', type: '() => void', description: 'The gesture ended: it stops at once.' },
		{ name: 'active', type: 'Readonly<Ref<boolean>>', description: 'Whether a gesture is in progress, between `start` and `stop`.' },
	]"
/>

## Examples

### A feel of your own

The defaults behave as a browser selecting text. An ease-in curve with smoothing feels calmer, for a
gesture that places things precisely:

```ts
useAutoScroll(scroller, {
	curve: depth => depth ** 2,
	speed: 900,
	smoothing: 150,
});
```

### Speed that builds up again

At the end of the content the speed has nowhere to go and drops to zero, so scrolling back the other
way starts smoothly rather than at full speed.

## Accessibility

Scrolling near the edges is a help for pointer gestures, not a way to reach content. Make sure what
the gesture does can be done from the keyboard too, where the table scrolls to the focused cell by
itself.

## See also

- [useCellDrag](/composables/use-cell-drag): a drag across cells, built on it.
- [useTableRowDrag](/composables/use-table-row-drag): row drags have an `autoScroll` of their own.
