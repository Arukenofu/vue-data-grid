import type { MotionEngine } from '@vue-data-grid/flip';

import { createEdgeScroll, type DragAutoScroll, type EdgeScroll, getEdgeSpeed, scrollBy, stepEdgeScroll } from './auto-scroll';
import { createDragGhost, type DragGhost, type DragGhostContent, type DragLanding } from './ghost';
import { DRAG_ACTIVE_ATTRIBUTE, type DragAxis, type DragPayload, type DragPoint, type DragRect } from './model';

const START_DISTANCE = 4;
const TOUCH_TOLERANCE = 8;
const DEFAULT_TOUCH_DELAY = 250;
const CLICK_SUPPRESSION_TIMEOUT = 100;
const CAPTURE = { capture: true };
// A frame after a long pause, such as a hidden tab, would scroll by a whole second at once.
const MAX_FRAME = 64;

export interface DragSourceItem {
	element: HTMLElement;
	payload: DragPayload;
}

export interface DragSourceOptions {
	/** What inside an item starts a drag; the whole item without it. */
	handle?: string;
	/** What inside an item never starts a drag: a resize handle, buttons, other gestures. */
	ignore?: string;
	/**
	 * How long a finger must rest on an item before a touch drag starts, ms; `250` by default. Until
	 * then the gesture is a scroll. A touch on a `handle` starts at once, since a handle is there to
	 * drag.
	 */
	touchDelay?: number;
	/** The item and its payload for what was pressed; `null` when there is nothing to drag. */
	resolve: (target: Element) => DragSourceItem | null;
	preview?: (item: DragSourceItem) => DragGhostContent | null;
	/** The area neither the pointer nor the ghost leaves; the window without it. */
	bounds?: () => HTMLElement | null;
	/** The engine the ghost ends the gesture with; without one it disappears at once. */
	motion?: MotionEngine | null;
	/** How the window scrolls while a drag without `bounds` nears its edges; `false` for not at all. */
	autoScroll?: DragAutoScroll | false;
	/**
	 * The item's element once a gesture that dropped nowhere has ended, for the ghost to fly back to;
	 * the ghost fades where it is without one.
	 */
	home?: (payload: DragPayload) => DragLanding;
}

export interface DropTargetHandlers {
	element: HTMLElement;
	accepts: (payload: DragPayload) => boolean;
	/** What to scroll while the pointer is near its edge, and along which `axis`. */
	scroller?: () => HTMLElement | null;
	axis?: DragAxis;
	/** How `scroller` scrolls, read on every frame; `false` for not at all. */
	autoScroll?: () => DragAutoScroll | false | undefined;
	onStart?: (payload: DragPayload) => void;
	onEnter?: (payload: DragPayload) => void;
	/** The pointer is over the target; `hit` is the deepest element under it. */
	onOver?: (payload: DragPayload, point: DragPoint, hit: Element) => void;
	onLeave?: (payload: DragPayload) => void;
	/**
	 * Whether the target holds the drag while the pointer is over no target: what it showed stays, and
	 * a drop over nothing goes to it. It lets go once another target takes the pointer, with
	 * `onRelease`. A list holds, so that a place does not run home under a pointer that strays; a zone
	 * does not.
	 */
	hold?: boolean;
	/** Another target took the pointer after this one held the drag: what it showed goes. */
	onRelease?: (payload: DragPayload) => void;
	/**
	 * The item was dropped over the target, where the last `onOver` said. Returns where it landed, for
	 * the ghost to fly to: the element, or a promise of it once the drop has re-rendered, or `null`
	 * for the ghost to fade over the target. Nothing returned means the target did not take the item,
	 * and the ghost goes back to the source's `home`.
	 */
	onDrop?: (payload: DragPayload) => DragLanding | undefined;
	onEnd?: (payload: DragPayload) => void;
}

interface Pending {
	pointerId: number;
	pointerType: string;
	origin: DragPoint;
	pointer: DragPoint;
	item: DragSourceItem;
	source: DragSourceOptions;
	/** A touch that waits for a long press; the drag starts when the timer fires. */
	timer: ReturnType<typeof setTimeout> | null;
}

interface Session {
	pointerId: number;
	pointerType: string;
	payload: DragPayload;
	source: DragSourceOptions;
	ghost: DragGhost | null;
	pointer: DragPoint;
	/** The pointer moved or the content under it scrolled: the target must be found again. */
	stale: boolean;
	target: DropTargetHandlers | null;
	/** The target that holds the drag while the pointer is over no target. */
	held: DropTargetHandlers | null;
	interested: Set<DropTargetHandlers>;
	frame: number;
	/** The time of the last frame, for speeds per second. */
	time: number | null;
	/** How fast each area scrolls now, the window included. */
	scrolls: Map<object, EdgeScroll>;
	restore: () => void;
}

const targets = new Set<DropTargetHandlers>();
const targetsByElement = new WeakMap<Element, DropTargetHandlers>();

let pending: Pending | null = null;
let session: Session | null = null;

/** Whether a pointer drag is in progress anywhere on the page. */
export function isDragging() {
	return session !== null;
}

function getViewport(): DragRect {
	const { clientWidth, clientHeight } = document.documentElement;

	return { left: 0, top: 0, right: clientWidth, bottom: clientHeight };
}

function intersect(first: DragRect, second: DragRect): DragRect {
	return {
		left: Math.max(first.left, second.left),
		top: Math.max(first.top, second.top),
		right: Math.min(first.right, second.right),
		bottom: Math.min(first.bottom, second.bottom),
	};
}

function contains(rect: DragRect, point: DragPoint) {
	return point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom;
}

function resolveBounds(current: Session): DragRect {
	const viewport = getViewport();
	const element = current.source.bounds?.() ?? null;

	if (!element) {
		return viewport;
	}

	const bounds = intersect(viewport, element.getBoundingClientRect());

	return bounds.right > bounds.left && bounds.bottom > bounds.top ? bounds : viewport;
}

function clampPoint(point: DragPoint, bounds: DragRect): DragPoint {
	return {
		x: Math.min(Math.max(point.x, bounds.left), bounds.right - 1),
		y: Math.min(Math.max(point.y, bounds.top), bounds.bottom - 1),
	};
}

function findTarget(current: Session, hit: Element | null) {
	for (let element = hit; element; element = element.parentElement) {
		const target = targetsByElement.get(element);

		if (target && current.interested.has(target)) {
			return target;
		}
	}

	return null;
}

function hitTest(current: Session, point: DragPoint) {
	const hit = document.elementFromPoint(point.x, point.y);
	const target = findTarget(current, hit);

	current.stale = false;

	if (target !== current.target) {
		const previous = current.target;

		previous?.onLeave?.(current.payload);

		if (previous?.hold) {
			current.held = previous;
		}

		current.target = target;

		if (target) {
			if (current.held !== target) {
				current.held?.onRelease?.(current.payload);
			}

			current.held = null;
			target.onEnter?.(current.payload);
		}
	}

	if (target && hit) {
		target.onOver?.(current.payload, point, hit);
	}
}

const STILL: DragPoint = { x: 0, y: 0 };

/** Scrolls `area` a frame's worth towards `target` px per second; whether it moved. */
function scrollArea(current: Session, area: HTMLElement | Window, target: DragPoint, elapsed: number, settings: DragAutoScroll) {
	let state = current.scrolls.get(area);

	if (!state) {
		state = createEdgeScroll();
		current.scrolls.set(area, state);
	}

	const by = stepEdgeScroll(state, target, elapsed, settings.smoothing);

	if (by.x === 0 && by.y === 0) {
		return false;
	}

	if (scrollBy(area, by)) {
		return true;
	}

	// At the end of the content the speed has nowhere to go: it builds up again from the start.
	current.scrolls.delete(area);

	return false;
}

function autoScroll(current: Session, point: DragPoint, elapsed: number) {
	const viewport = getViewport();
	let scrolled = false;

	for (const target of current.interested) {
		const scroller = target.scroller?.();
		const settings = target.autoScroll?.() ?? {};

		if (!scroller || settings === false) {
			continue;
		}

		const rect = intersect(viewport, scroller.getBoundingClientRect());
		const speed = contains(rect, point) ? getEdgeSpeed(rect, point, target.axis ?? 'both', settings) : STILL;

		// One area at a time: the first that moves, and the others only slow down.
		if (scrollArea(current, scroller, scrolled ? STILL : speed, elapsed, settings)) {
			scrolled = true;
		}
	}

	const settings = current.source.autoScroll ?? {};

	if (scrolled || current.source.bounds?.() || settings === false) {
		return scrolled;
	}

	return scrollArea(current, window, getEdgeSpeed(viewport, point, 'both', settings), elapsed, settings);
}

function tick(now: number) {
	const current = session;

	if (!current) {
		return;
	}

	current.frame = requestAnimationFrame(tick);

	const elapsed = current.time === null ? 0 : Math.min(now - current.time, MAX_FRAME);

	current.time = now;

	const bounds = resolveBounds(current);
	const point = clampPoint(current.pointer, bounds);

	current.ghost?.move(point, bounds);

	if (autoScroll(current, point, elapsed) || current.stale) {
		hitTest(current, point);
	}
}

function suppressClick() {
	let timer = 0;

	function release() {
		window.removeEventListener('click', stop, CAPTURE);
		clearTimeout(timer);
	}

	function stop(event: Event) {
		event.stopPropagation();
		event.preventDefault();
		release();
	}

	window.addEventListener('click', stop, CAPTURE);
	timer = window.setTimeout(release, CLICK_SUPPRESSION_TIMEOUT);
}

function lockPage() {
	const { body, documentElement } = document;
	const previous = {
		userSelect: body.style.userSelect,
		webkitUserSelect: body.style.webkitUserSelect,
		cursor: body.style.cursor,
	};

	body.style.userSelect = 'none';
	body.style.webkitUserSelect = 'none';
	body.style.cursor = 'grabbing';
	window.getSelection()?.removeAllRanges();

	return () => {
		body.style.userSelect = previous.userSelect;
		body.style.webkitUserSelect = previous.webkitUserSelect;
		body.style.cursor = previous.cursor;
		documentElement.removeAttribute(DRAG_ACTIVE_ATTRIBUTE);
	};
}

function start(next: Pending) {
	const { item, source } = next;
	const { payload } = item;
	const content = source.preview?.(item) ?? null;
	const bounds = source.bounds?.() ?? null;
	const interested = new Set([...targets].filter(target =>
		target.accepts(payload) && (bounds === null || bounds.contains(target.element))));

	pending = null;
	document.documentElement.setAttribute(DRAG_ACTIVE_ATTRIBUTE, payload.kind);

	session = {
		pointerId: next.pointerId,
		pointerType: next.pointerType,
		payload,
		source,
		ghost: content
			? createDragGhost(content, { kind: payload.kind, source: item.element, grab: next.origin })
			: null,
		pointer: next.pointer,
		stale: true,
		target: null,
		held: null,
		interested,
		frame: 0,
		time: null,
		scrolls: new Map(),
		restore: lockPage(),
	};

	for (const target of interested) {
		target.onStart?.(payload);
	}

	session.frame = requestAnimationFrame(tick);
}

function finish(dropped: boolean) {
	const current = session;

	if (!current) {
		return;
	}

	session = null;
	cancelAnimationFrame(current.frame);
	unlisten();

	const { payload, source } = current;
	let landing: DragLanding | undefined;

	try {
		if (dropped) {
			if (current.stale) {
				hitTest(current, clampPoint(current.pointer, resolveBounds(current)));
			}

			landing = (current.target ?? current.held)?.onDrop?.(payload);
		}
	} finally {
		for (const target of current.interested) {
			target.onEnd?.(payload);
		}

		// Targets have re-rendered by the time a landing resolves: the ghost flies to the item there.
		current.ghost?.settle(
			landing === undefined ? source.home?.(payload) ?? null : landing,
			source.motion ?? null,
		);
		current.restore();

		if (dropped) {
			suppressClick();
		}
	}
}

function abort() {
	if (pending?.timer) {
		clearTimeout(pending.timer);
	}

	pending = null;
	unlisten();
}

function cancel() {
	if (pending) {
		abort();
	} else {
		finish(false);
	}
}

function isLongPress(next: Pending) {
	return next.timer !== null;
}

function handlePointerMove(event: PointerEvent) {
	const point = { x: event.clientX, y: event.clientY };

	if (pending) {
		if (event.pointerId !== pending.pointerId) {
			return;
		}

		const distance = Math.hypot(point.x - pending.origin.x, point.y - pending.origin.y);

		pending.pointer = point;

		if (isLongPress(pending)) {
			// A finger that moves before the long press ends is scrolling, not dragging.
			if (distance > TOUCH_TOLERANCE) {
				abort();
			}

			return;
		}

		if (distance < START_DISTANCE) {
			return;
		}

		start(pending);
	}

	if (session && event.pointerId === session.pointerId) {
		session.pointer = point;
		session.stale = true;
	}
}

function handlePointerUp(event: PointerEvent) {
	if (pending) {
		if (event.pointerId === pending.pointerId) {
			abort();
		}
	} else if (session && event.pointerId === session.pointerId) {
		finish(true);
	}
}

function handlePointerCancel(event: PointerEvent) {
	if (event.pointerId === (pending ?? session)?.pointerId) {
		cancel();
	}
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key !== 'Escape') {
		return;
	}

	if (session) {
		event.preventDefault();
		event.stopPropagation();
	}

	cancel();
}

function handleVisibilityChange() {
	if (document.visibilityState === 'hidden') {
		cancel();
	}
}

function handleContextMenu(event: Event) {
	if (session) {
		event.preventDefault();
	}
}

function handleScroll() {
	if (session) {
		session.stale = true;
	}
}

/**
 * Keeps the browser from scrolling under a finger that drags. The listener is registered on the
 * source when it is bound, not when a drag starts: browsers decide whether a touch may be cancelled
 * when it begins, and a listener added later could no longer stop the scroll.
 */
function handleTouchMove(event: TouchEvent) {
	const touchDrag = session?.pointerType === 'touch';
	const touchOnHandle = pending?.pointerType === 'touch' && !isLongPress(pending);

	if ((touchDrag || touchOnHandle) && event.cancelable) {
		event.preventDefault();
	}
}

function preventDefault(event: Event) {
	event.preventDefault();
}

function listen() {
	window.addEventListener('pointermove', handlePointerMove, CAPTURE);
	window.addEventListener('pointerup', handlePointerUp, CAPTURE);
	window.addEventListener('pointercancel', handlePointerCancel, CAPTURE);
	window.addEventListener('keydown', handleKeyDown, CAPTURE);
	window.addEventListener('dragstart', preventDefault, CAPTURE);
	window.addEventListener('selectstart', preventDefault, CAPTURE);
	window.addEventListener('contextmenu', handleContextMenu, CAPTURE);
	window.addEventListener('scroll', handleScroll, CAPTURE);
	window.addEventListener('blur', cancel);
	document.addEventListener('visibilitychange', handleVisibilityChange);
}

function unlisten() {
	window.removeEventListener('pointermove', handlePointerMove, CAPTURE);
	window.removeEventListener('pointerup', handlePointerUp, CAPTURE);
	window.removeEventListener('pointercancel', handlePointerCancel, CAPTURE);
	window.removeEventListener('keydown', handleKeyDown, CAPTURE);
	window.removeEventListener('dragstart', preventDefault, CAPTURE);
	window.removeEventListener('selectstart', preventDefault, CAPTURE);
	window.removeEventListener('contextmenu', handleContextMenu, CAPTURE);
	window.removeEventListener('scroll', handleScroll, CAPTURE);
	window.removeEventListener('blur', cancel);
	document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function resolveItem(target: Element, options: DragSourceOptions) {
	const item = options.resolve(target);

	if (!item) {
		return null;
	}

	const { element } = item;
	const ignored = options.ignore ? target.closest(options.ignore) : null;
	const handle = options.handle ? target.closest(options.handle) : element;

	return element.contains(ignored) || !element.contains(handle) ? null : item;
}

/**
 * The area where a drag can begin: one listener for the container rather than one per item, and
 * `resolve` says which item was pressed. The gesture then goes on through listeners on the window,
 * so the item may leave the DOM in the middle of it, for example under a virtual window.
 *
 * A mouse or a pen drags after a few pixels of movement. A touch drags at once on a `handle`, and
 * after a long press elsewhere, so that the list still scrolls under a finger.
 */
export function bindDragSource(element: HTMLElement, options: DragSourceOptions) {
	const previousCallout = element.style.getPropertyValue('-webkit-touch-callout');

	function handlePointerDown(event: PointerEvent) {
		if (pending || session || event.button !== 0 || !event.isPrimary || !(event.target instanceof Element)) {
			return;
		}

		const item = resolveItem(event.target, options);

		if (!item) {
			return;
		}

		const origin = { x: event.clientX, y: event.clientY };
		const next: Pending = {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			origin,
			pointer: origin,
			item,
			source: options,
			timer: null,
		};

		if (event.pointerType === 'touch' && !options.handle) {
			next.timer = setTimeout(() => {
				if (pending === next) {
					next.timer = null;
					start(next);
				}
			}, options.touchDelay ?? DEFAULT_TOUCH_DELAY);
		}

		pending = next;
		listen();
	}

	element.addEventListener('pointerdown', handlePointerDown);
	element.addEventListener('touchmove', handleTouchMove, { passive: false });
	// A long press must not open the system menu of a link or an image inside the item.
	element.style.setProperty('-webkit-touch-callout', 'none');

	return () => {
		element.removeEventListener('pointerdown', handlePointerDown);
		element.removeEventListener('touchmove', handleTouchMove);
		element.style.setProperty('-webkit-touch-callout', previousCallout);

		if (pending?.source === options) {
			abort();
		}
	};
}

/**
 * An area over which targets are looked for: the deepest element under the pointer goes up to the
 * first registered ancestor that accepts the payload, so nested areas win over outer ones.
 */
export function registerDropTarget(target: DropTargetHandlers) {
	targets.add(target);
	targetsByElement.set(target.element, target);

	return () => {
		targets.delete(target);
		session?.interested.delete(target);

		if (session?.target === target) {
			session.target = null;
		}

		if (session?.held === target) {
			session.held = null;
		}

		if (targetsByElement.get(target.element) === target) {
			targetsByElement.delete(target.element);
		}
	};
}
