import { captureLayout, type MotionEngine, playMotion } from '@vue-stack/flip';

import { measureLayout } from './layout';
import { DRAG_GHOST_ATTRIBUTE, DRAG_LANDING_ATTRIBUTE, type DragPoint, type DragRect } from './model';
import type { DragGhostExit, DragPreviewPlacement } from './preview';

const OUTSIDE_OFFSET: DragPoint = { x: 12, y: 4 };
const Z_INDEX = 1000;

export interface DragGhostContent {
	render: (container: HTMLElement) => (() => void) | void;
	placement: DragPreviewPlacement;
	exit: DragGhostExit;
}

interface DragGhostOptions {
	kind: string;
	/** The grabbed element and the point where it was grabbed, for the `'source'` placement. */
	source: HTMLElement;
	grab: DragPoint;
}

/** Where the ghost goes at the end of a gesture: the item it becomes, once the drop has re-rendered. */
export type DragLanding = Promise<Element | null> | Element | null;

export interface DragGhost {
	/** Puts the ghost under the pointer without letting it out of `bounds`. */
	move: (point: DragPoint, bounds: DragRect) => void;
	/**
	 * Ends the ghost as its `exit` says, with the engine as a `'ghost'`: a leave where it is, or a move
	 * into the item it landed as, or a leave when there is none. Without an engine it goes at once.
	 */
	settle: (landing: DragLanding, engine: MotionEngine | null) => void;
	destroy: () => void;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), Math.max(min, max));
}

/** A plain DOM element over the page that follows the pointer: no snapshots, no OS drag images. */
export function createDragGhost(content: DragGhostContent, options: DragGhostOptions): DragGhost {
	const element = document.createElement('div');
	const sourceRect = options.source.getBoundingClientRect();

	element.setAttribute(DRAG_GHOST_ATTRIBUTE, options.kind);
	Object.assign(element.style, {
		position: 'fixed',
		top: '0',
		left: '0',
		zIndex: String(Z_INDEX),
		width: 'max-content',
		pointerEvents: 'none',
		willChange: 'translate',
	});
	document.body.append(element);

	const cleanup = content.render(element);

	let width = element.offsetWidth;
	let height = element.offsetHeight;
	let placed: { point: DragPoint; bounds: DragRect; left: number; top: number } | null = null;
	let destroyed = false;

	function getOffset(): DragPoint {
		switch (content.placement) {
			case 'center':
				return { x: -width / 2, y: -height / 2 };
			case 'source':
				return {
					x: Math.max(sourceRect.left - options.grab.x, -width),
					y: Math.max(sourceRect.top - options.grab.y, -height),
				};
			default:
				return OUTSIDE_OFFSET;
		}
	}

	function move(point: DragPoint, bounds: DragRect) {
		const offset = getOffset();
		const left = clamp(point.x + offset.x, bounds.left, bounds.right - width);
		const top = clamp(point.y + offset.y, bounds.top, bounds.bottom - height);

		placed = { point, bounds, left, top };
		element.style.translate = `${left}px ${top}px`;
	}

	const observer = typeof ResizeObserver === 'undefined'
		? null
		: new ResizeObserver(() => {
			width = element.offsetWidth;
			height = element.offsetHeight;

			if (placed) {
				move(placed.point, placed.bounds);
			}
		});

	observer?.observe(element);

	function destroy() {
		if (destroyed) {
			return;
		}

		destroyed = true;
		observer?.disconnect();
		cleanup?.();
		element.remove();
	}

	/** Sees the ghost off where it is. */
	function leave(engine: MotionEngine) {
		void playMotion(engine, { kind: 'ghost', leaves: [element] }).finished.then(destroy);
	}

	/**
	 * Moves the ghost the least distance that puts it inside the item, then removes it: a ghost of the
	 * item's size lands exactly on it, a smaller label lands over it. The item has
	 * `DRAG_LANDING_ATTRIBUTE` meanwhile, for the markup to hide it under a ghost that looks like it.
	 */
	function fly(target: unknown, engine: MotionEngine, from: { left: number; top: number }) {
		const landing = target instanceof Element && target.isConnected ? target : null;

		if (!landing) {
			leave(engine);

			return;
		}

		// Where the item is laid out, not where it is drawn: it may be moving into its place.
		const box = measureLayout(landing);
		const capture = captureLayout([element]);

		landing.setAttribute(DRAG_LANDING_ATTRIBUTE, '');
		element.style.translate = `${clamp(from.left, box.left, box.right - width)}px ${clamp(from.top, box.top, box.bottom - height)}px`;

		void capture.animate([element], engine, { kind: 'ghost' }).finished.then(() => {
			landing.removeAttribute(DRAG_LANDING_ATTRIBUTE);
			destroy();
		});
	}

	function settle(landing: DragLanding, engine: MotionEngine | null) {
		observer?.disconnect();

		const from = placed;

		if (!engine || !from || content.exit === 'none') {
			destroy();

			return;
		}

		if (content.exit === 'fade') {
			leave(engine);

			return;
		}

		void Promise.resolve(landing).then(
			target => fly(target, engine, from),
			() => fly(null, engine, from),
		);
	}

	return { move, settle, destroy };
}
