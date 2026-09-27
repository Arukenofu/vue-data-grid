import { captureLayout, type MotionEngine, webAnimations } from '@vue-stack/flip';
import { type MaybeRef, type MaybeRefOrGetter, nextTick, onScopeDispose, shallowReadonly, shallowRef, toValue, unref, watch } from 'vue';

import {
	announce,
	DEFAULT_ANNOUNCEMENTS,
	type DragAnnouncement,
	type DragAnnouncements,
	getInstructionsId,
	mountInstructions,
} from './announcer';
import type { DragAutoScroll } from './auto-scroll';
import { bindDragSource, type DragSourceItem, type DragSourceOptions, isDragging, registerDropTarget } from './drag-manager';
import {
	collectDropSlots,
	createFlatTree,
	describeDestination,
	type DragTree,
	type DropSlot,
	getOwnDestination,
	isInside,
	resolveDestination,
	resolvePosition,
	resolveSiblingIndex,
} from './drop-position';
import { createGap } from './gap';
import { createDropIndicator, type DropIndicator } from './indicator';
import { measureLayout } from './layout';
import {
	DRAG_SOURCE_ATTRIBUTE,
	type DragAxis,
	type DragDestination,
	type DragDropEvent,
	type DragPayload,
	type DragPoint,
	type DragRect,
	DROP_LEVEL_PROPERTY,
	DROP_TARGET_ATTRIBUTE,
	type DropPosition,
} from './model';
import type { DragPreview } from './preview';

/**
 * How a list shows the place on top of the `data-drop-target` mark, which is always set: `'mark'`
 * leaves the drawing to the markup; `'line'` adds one element, `[data-drop-indicator]`, that slides
 * from place to place; `'gap'` moves the items apart where the dragged one would go.
 */
export type DragIndicator = 'mark' | 'line' | 'gap';

/** An item being dragged over a list, for `canAccept`. */
export interface DragOffer {
	payload: DragPayload;
	/** Whether it comes from another list of the group. */
	external: boolean;
}

export interface DragListOptions {
	/** What the list holds, such as `'table-row'`: a list accepts only its own kind. */
	kind: string;
	axis: DragAxis;
	/** Keys of the shown items in display order. */
	keys: MaybeRefOrGetter<readonly string[]>;
	/** The list's area: drags begin in it, targets are looked for over it, past the last item is the end. */
	container: MaybeRefOrGetter<HTMLElement | null>;
	/** What to scroll while the pointer is near its edge; `container` by default. */
	scroller?: MaybeRefOrGetter<HTMLElement | null>;
	/**
	 * How `scroller` scrolls while an item is dragged near its edges, and the window for a drag without
	 * `bounds`: the zone, the speed and its curve, a soft start and stop, what is stuck to the edges; or
	 * `false` for not at all. Read on every frame.
	 */
	autoScroll?: MaybeRefOrGetter<DragAutoScroll | false | undefined>;
	/** The area neither the pointer nor the ghost leaves; the window without it. */
	bounds?: MaybeRefOrGetter<HTMLElement | null>;
	/** What inside an item starts a drag; the whole item without it. */
	handle?: MaybeRefOrGetter<string | undefined>;
	/** What inside an item never starts a drag: a resize handle, buttons, other gestures. */
	ignore?: MaybeRefOrGetter<string | undefined>;
	/** How long a finger rests on an item before a touch drag starts, ms; see `bindDragSource`. */
	touchDelay?: MaybeRefOrGetter<number | undefined>;
	/**
	 * Whether item `key` may be dragged now; every item by default. Asked when a gesture would start,
	 * with the pointer, a finger or the keyboard, so nothing is computed for items nobody touches.
	 */
	canDrag?: (key: string) => boolean;
	/** Name shared by lists that accept each other's items; without it the list takes only its own. */
	group?: MaybeRefOrGetter<string | null | undefined>;
	/** Whether to accept an item being dragged, own or from the group; any by default. */
	canAccept?: (offer: DragOffer) => boolean;
	/** What to attach to the payload for other lists, which know nothing but the key. */
	getData?: (key: string) => unknown;
	/** Nesting of the items; without it the list is flat, with places before and after only. */
	tree?: DragTree;
	/** Whether `key` may go to this place; always by default. A rejected place is not shown. */
	canDrop?: (key: string, target: DragListTarget) => boolean;
	/** The ghost under the pointer; without it the drag is shown by the marks alone. */
	preview?: DragPreview;
	/** Dragging with the keyboard: Space or Enter on an item or its handle, then the arrows. `true` by default. */
	keyboard?: MaybeRefOrGetter<boolean | undefined>;
	/**
	 * Alt with an arrow key along the `axis`, on an item or anything in it, moves the item one place
	 * among its siblings at once, through `onDrop`, as a shortcut next to a keyboard drag. `false` by
	 * default.
	 */
	stepKeys?: MaybeRefOrGetter<boolean | undefined>;
	/** The item's name in announcements; the key by default. */
	getLabel?: (key: string) => string;
	/**
	 * Brings an item into view while the keyboard moves the drop place; `scrollIntoView` by default.
	 * Under a virtual window pass what scrolls to the item, such as `scope.scrollToRow`.
	 */
	reveal?: (key: string) => void;
	/** What screen readers hear during a keyboard drag; English by default. Read when each is said. */
	announcements?: MaybeRefOrGetter<Partial<DragAnnouncements> | undefined>;
	/** How the place is shown, read when a gesture starts; `'mark'` by default. See `DragIndicator`. */
	indicator?: MaybeRefOrGetter<DragIndicator>;
	/**
	 * The engine that plays the movement, `webAnimations()` by default; `false` moves nothing. Each
	 * transition says what it is by its `kind`: `'gap'`, the items making way; `'indicator'`, the line
	 * going to a new place; `'settle'`, the items going to their places after a drop, and the items
	 * that came in as enters; `'ghost'`, the ghost landing on its item, or leaving. Read when a gesture
	 * starts. A ref rather than a getter: an engine is a function itself.
	 */
	motion?: MaybeRef<MotionEngine | false | undefined>;
	/**
	 * Whether the items move to their places after a drop; `true` by default. `false` when something
	 * else animates the new order, such as the markup on every change of the order: the gap still
	 * closes into it without a jump.
	 */
	settle?: MaybeRefOrGetter<boolean>;
	/**
	 * Draws the items that the gap moves, by key, each `offset` px from its place, with `engine` or at
	 * once, instead of the list setting the `translate` of their elements: for an item drawn by more
	 * than one element, such as a column of a table, whose cells all move. One call gets every item
	 * that moved, so that the DOM is read and written once; `{ x: 0, y: 0 }` puts an item back. Move
	 * the registered element by `translate` too, which the list measures the layout without.
	 */
	shift?: (shifts: ReadonlyMap<string, DragPoint>, engine: MotionEngine | null) => void;
	/** The item was dropped on this list; whether it is own or foreign is in the event. */
	onDrop: (event: DragDropEvent) => void;
}

export interface DragList {
	/** Connects an element with key `key`; returns the disconnect. Usually through `v-drag-item`. */
	register: (element: HTMLElement, key: string) => () => void;
}

/** The place under the pointer or picked with the keyboard: what is marked and where the item goes. */
export interface DragListTarget extends DragDestination {
	/** The marked item; `null` when the area of an empty list is marked. */
	key: string | null;
	position: DropPosition;
	/** Nesting level at which the mark is drawn. */
	level: number;
}

interface Mark extends DragListTarget {
	/** `null` while the marked item is not in the DOM: it gets the mark when it registers. */
	element: HTMLElement | null;
}

interface KeyboardDrag {
	payload: DragPayload;
	slots: readonly (DropSlot & { order: number })[];
	slot: (DropSlot & { order: number }) | null;
	order: number;
}

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

const VERTICAL_STEPS: Readonly<Record<string, number>> = { ArrowUp: -1, ArrowDown: 1 };

const HORIZONTAL_KEYS = new Set(['ArrowLeft', 'ArrowRight']);

const DEFAULT_ENGINE = webAnimations();

/** The item's own place: a drop there changes nothing, and a gap closes at home. */
const HOME = Symbol('home');

function setMark({ element, position, level }: Mark) {
	element?.setAttribute(DROP_TARGET_ATTRIBUTE, position);
	element?.style.setProperty(DROP_LEVEL_PROPERTY, String(level));
}

function clearMark(element: HTMLElement | null) {
	element?.removeAttribute(DROP_TARGET_ATTRIBUTE);
	element?.style.removeProperty(DROP_LEVEL_PROPERTY);
}

function isSameMark(first: Mark | null, second: Mark | null) {
	return first?.element === second?.element
		&& first?.key === second?.key
		&& first?.position === second?.position
		&& first?.level === second?.level
		&& first?.parent === second?.parent
		&& first?.index === second?.index;
}

/**
 * A list reordered by dragging, with the pointer, a finger or the keyboard. It moves nothing in the
 * DOM or in your data: until the drop it only marks the source and the target with attributes, and
 * on the drop it says where the item goes. Items may re-render, unmount and mount again in the
 * middle of a drag, a virtual window included. A place where a drop would change nothing is not
 * marked.
 */
export function useDragList(options: DragListOptions) {
	const origin = Symbol(options.kind);
	const tree = options.tree ?? createFlatTree(() => toValue(options.keys));
	const active = shallowRef<string | null>(null);
	const dragging = shallowRef<DragPayload | null>(null);
	const over = shallowRef(false);
	const target = shallowRef<DragListTarget | null>(null);
	const elements = new Map<string, HTMLElement>();
	const keysByElement = new WeakMap<Element, string>();
	const layouts = new Map<Element, DragRect>();

	let mark: Mark | null = null;
	let keyboard: KeyboardDrag | null = null;
	// A horizontal list in a right-to-left container runs from the right edge.
	let rtl = false;
	// How the current gesture shows the place and moves, read when it starts.
	let mode: DragIndicator = 'mark';
	let engine: MotionEngine | null = null;
	let indicator: DropIndicator | null = null;
	let settling: Promise<void> | null = null;
	// The ghost of the current gesture flies into its item, which then does not slide itself.
	let ghostLands = false;

	const gap = createGap({
		axis: options.axis,
		tree,
		keys: () => toValue(options.keys),
		elements,
		isRtl: () => rtl,
		draw: options.shift,
	});

	function resolveEngine() {
		const value = unref(options.motion);

		return value === false ? null : value ?? DEFAULT_ENGINE;
	}

	function getLabel(key: string) {
		return options.getLabel?.(key) ?? key;
	}

	function getAnnouncements(): DragAnnouncements {
		const custom = toValue(options.announcements);

		return custom ? { ...DEFAULT_ANNOUNCEMENTS, ...custom } : DEFAULT_ANNOUNCEMENTS;
	}

	function getHandle() {
		return toValue(options.handle);
	}

	function getIgnore() {
		return toValue(options.ignore);
	}

	function isKeyboardOn() {
		return toValue(options.keyboard) ?? true;
	}

	function mayDrag(key: string) {
		return options.canDrag?.(key) ?? true;
	}

	/** Keys pressed in a field or inside what the list never drags from are not the list's. */
	function isIgnored(target: Element) {
		const ignore = getIgnore();

		return target.closest(EDITABLE) !== null || (ignore !== undefined && target.closest(ignore) !== null);
	}

	function createPayload(key: string): DragPayload {
		return { kind: options.kind, key, origin, group: toValue(options.group) ?? null, data: options.getData?.(key) };
	}

	function accepts(payload: DragPayload) {
		if (payload.kind !== options.kind) {
			return false;
		}

		const group = toValue(options.group) ?? null;
		const external = payload.origin !== origin;

		if (external && (group === null || payload.group !== group)) {
			return false;
		}

		return options.canAccept?.({ payload, external }) ?? true;
	}

	function isOwn(payload: DragPayload) {
		return payload.origin === origin;
	}

	function findKey(hit: Element, container: HTMLElement) {
		for (let element: Element | null = hit; element && element !== container; element = element.parentElement) {
			const key = keysByElement.get(element);

			if (key !== undefined) {
				return key;
			}
		}

		return null;
	}

	function readDirection() {
		const container = toValue(options.container);

		rtl = options.axis === 'horizontal' && container !== null && getComputedStyle(container).direction === 'rtl';
	}

	/**
	 * The laid-out rect of an item during a gesture, measured once: items move only by the translates a
	 * layout rect leaves out, so the rects hold until something scrolls or the items change.
	 */
	function getLayout(element: Element) {
		let rect = layouts.get(element);

		if (!rect) {
			rect = measureLayout(element);
			layouts.set(element, rect);
		}

		return rect;
	}

	function forgetLayouts() {
		layouts.clear();
	}

	function getRatio(element: HTMLElement, point: DragPoint) {
		const rect = getLayout(element);

		if (options.axis === 'vertical') {
			return (point.y - rect.top) / (rect.bottom - rect.top);
		}

		const width = rect.right - rect.left;

		return rtl ? (rect.right - point.x) / width : (point.x - rect.left) / width;
	}

	function isBeyond(element: HTMLElement, point: DragPoint) {
		const rect = getLayout(element);

		if (options.axis === 'vertical') {
			return point.y >= rect.bottom;
		}

		return rtl ? point.x < rect.left : point.x >= rect.right;
	}

	function isAhead(element: HTMLElement, point: DragPoint) {
		const rect = getLayout(element);

		if (options.axis === 'vertical') {
			return point.y < rect.top;
		}

		return rtl ? point.x >= rect.right : point.x < rect.left;
	}

	/**
	 * A place, `HOME` for one where a drop changes nothing, or `null` for no place, such as one that
	 * `canDrop` refuses: the list then keeps showing the last place.
	 */
	function toMark(payload: DragPayload, key: string, position: DropPosition, element: HTMLElement | null): Mark | typeof HOME | null {
		const destination = resolveDestination(tree, payload.key, key, position);

		if (!destination) {
			return HOME;
		}

		const next: Mark = {
			...destination,
			element,
			key,
			position,
			level: tree.getLevel(key) + (position === 'inside' ? 1 : 0),
		};

		return (options.canDrop?.(payload.key, next) ?? true) ? next : null;
	}

	function resolveItem(payload: DragPayload, key: string, element: HTMLElement, point: DragPoint) {
		// Over the dragged item or its subtree, which move as one: the item is over its own place.
		if (key === payload.key || isInside(tree, key, payload.key)) {
			return HOME;
		}

		return toMark(payload, key, resolvePosition(tree, key, getRatio(element, point)), element);
	}

	function resolveEdgeSlot(payload: DragPayload, key: string, element: HTMLElement, position: DropPosition, targetIndex: number) {
		const index = resolveSiblingIndex(tree, payload.key, null, targetIndex, position);

		if (index === null) {
			return HOME;
		}

		const next: Mark = { element, key, position, level: 0, parent: null, index };

		return (options.canDrop?.(payload.key, next) ?? true) ? next : null;
	}

	/** The area around the items: past the last one is the end, before the first the start, empty is inside. */
	function resolveEdge(payload: DragPayload, container: HTMLElement, point: DragPoint): Mark | typeof HOME | null {
		const keys = toValue(options.keys);

		if (keys.length === 0) {
			return { element: container, key: null, position: 'inside', level: 0, parent: null, index: 0 };
		}

		const root = tree.getChildren(null);
		const lastKey = keys[keys.length - 1];
		const last = elements.get(lastKey);

		if (last && isBeyond(last, point)) {
			return resolveEdgeSlot(payload, lastKey, last, 'after', root.length - 1);
		}

		const [firstKey] = keys;
		const first = elements.get(firstKey);

		if (first && firstKey === root[0] && isAhead(first, point)) {
			return resolveEdgeSlot(payload, firstKey, first, 'before', 0);
		}

		return null;
	}

	/** The item under a point through whatever covers it: pinned rows, a header, overlays. */
	function findCoveredKey(point: DragPoint, container: HTMLElement) {
		for (const element of document.elementsFromPoint(point.x, point.y)) {
			const key = keysByElement.get(element);

			if (key !== undefined && container.contains(element)) {
				return key;
			}
		}

		return null;
	}

	/**
	 * The item laid out across a point along the list, wherever the point is across it: a column of a
	 * table under the pointer over its body cells, a row under the pointer past the end of its cells.
	 * By the layout: with a gap the items are drawn away from it, and the item drawn under the pointer
	 * would move the gap away from it, and back, on every frame.
	 */
	function findLaidOutKey(point: DragPoint) {
		for (const [key, element] of elements) {
			const rect = getLayout(element);
			const across = options.axis === 'vertical'
				? point.y >= rect.top && point.y < rect.bottom
				: point.x >= rect.left && point.x < rect.right;

			if (across) {
				return key;
			}
		}

		return null;
	}

	function resolveMark(payload: DragPayload, point: DragPoint, hit: Element, container: HTMLElement) {
		const key = mode === 'gap'
			? findLaidOutKey(point)
			: findKey(hit, container) ?? findCoveredKey(point, container) ?? findLaidOutKey(point);
		const element = key === null ? undefined : elements.get(key);

		return key !== null && element
			? resolveItem(payload, key, element, point)
			: resolveEdge(payload, container, point);
	}

	/** The edge of the place, or the whole item for `'inside'`, in viewport coordinates. */
	function getIndicatorBox(element: HTMLElement, position: DropPosition): DragRect {
		const rect = element.getBoundingClientRect();

		if (position === 'inside') {
			return rect;
		}

		if (options.axis === 'vertical') {
			const y = position === 'after' ? rect.bottom : rect.top;

			return { left: rect.left, right: rect.right, top: y, bottom: y };
		}

		const x = (position === 'after') !== rtl ? rect.right : rect.left;

		return { left: x, right: x, top: rect.top, bottom: rect.bottom };
	}

	function showIndicator() {
		const container = toValue(options.container);
		const element = mark?.element;

		if (mode !== 'line' || !container) {
			return;
		}

		if (!mark || !element) {
			indicator?.hide();

			return;
		}

		indicator ??= createDropIndicator(container, options.axis, engine);
		indicator.show(getIndicatorBox(element, mark.position), mark.position, mark.level);
	}

	/** In a gap the dragged item stands where it would land: it shows the level it would land at. */
	function showSourceLevel() {
		const source = active.value === null ? undefined : elements.get(active.value);

		if (mode === 'gap' && mark) {
			source?.style.setProperty(DROP_LEVEL_PROPERTY, String(mark.level));
		} else {
			source?.style.removeProperty(DROP_LEVEL_PROPERTY);
		}
	}

	/** `moveItems: false` at the end of a gesture: the marks go, a gap stays until the list settles. */
	function applyMark(next: Mark | null, moveItems = true) {
		if (isSameMark(mark, next)) {
			return;
		}

		clearMark(mark?.element ?? null);

		if (next) {
			setMark(next);
		}

		mark = next;
		target.value = next
			? { key: next.key, position: next.position, level: next.level, parent: next.parent, index: next.index }
			: null;
		showIndicator();

		if (moveItems && mode === 'gap') {
			showSourceLevel();
			gap.place(next);
		}
	}

	function markSource(key: string) {
		active.value = key;
		elements.get(key)?.setAttribute(DRAG_SOURCE_ATTRIBUTE, '');
	}

	function unmarkSource(key: string) {
		const element = elements.get(key);

		element?.removeAttribute(DRAG_SOURCE_ATTRIBUTE);
		element?.style.removeProperty(DROP_LEVEL_PROPERTY);
		active.value = null;
	}

	/** A gesture this list takes part in starts, own or foreign: how it shows the place is read now. */
	function begin(payload: DragPayload) {
		forgetLayouts();
		window.addEventListener('scroll', forgetLayouts, { capture: true, passive: true });
		readDirection();
		mode = toValue(options.indicator) ?? 'mark';
		engine = resolveEngine();
		dragging.value = payload;

		if (isOwn(payload)) {
			markSource(payload.key);
		}

		if (mode === 'gap') {
			gap.begin(payload.key, isOwn(payload), engine);
		}
	}

	/**
	 * Once the drop has re-rendered the list, items move from where they were drawn to where they
	 * are, and items that came in enter: a reorder moves rather than jumps, and a gap closes into the
	 * new order without a jump. `skip` is the item a ghost flies to: it waits for the ghost instead.
	 */
	function settle(skip: string | null) {
		if (settling) {
			return settling;
		}

		const movement = toValue(options.settle) === false ? null : engine;
		const items = () => [...elements].filter(([key]) => key !== skip);
		const capture = movement ? captureLayout(items()) : null;

		settling = nextTick().then(() => {
			settling = null;
			gap.clear();
			capture?.animate(items(), movement, { kind: 'settle' });
		});

		return settling;
	}

	/** The gesture is over for this list: the indicator goes, and the items settle. */
	function end(skip: string | null) {
		indicator?.destroy();
		indicator = null;
		gap.freeze();
		void settle(skip);
	}

	/** Where the item is once the list has settled, for a ghost to fly to. */
	function land(key: string, skip: string | null) {
		return settle(skip).then(() => elements.get(key) ?? null);
	}

	/** The item a ghost of this list flies to at the end of a pointer gesture. */
	function getGhostKey(payload: DragPayload) {
		return isOwn(payload) && ghostLands ? payload.key : null;
	}

	/** No place under the pointer keeps the last one: a gap does not run home under a pointer that strays. */
	function handleOver(payload: DragPayload, point: DragPoint, hit: Element) {
		const container = toValue(options.container);
		const next = container ? resolveMark(payload, point, hit, container) : null;

		if (next !== null) {
			applyMark(next === HOME ? null : next);
		}
	}

	/** The list holds the drag while the pointer is over no target: the place stays until another takes it. */
	function handleLeave() {
		over.value = false;
	}

	function handleRelease() {
		applyMark(null);
	}

	function handleDrop(payload: DragPayload) {
		const drop = mark;

		applyMark(null, false);

		if (!drop) {
			return undefined;
		}

		options.onDrop({
			key: payload.key,
			parent: drop.parent,
			index: drop.index,
			payload,
			external: !isOwn(payload),
		});

		return land(payload.key, getGhostKey(payload));
	}

	function handleEnd(payload: DragPayload) {
		window.removeEventListener('scroll', forgetLayouts, { capture: true });
		forgetLayouts();
		dragging.value = null;
		over.value = false;
		applyMark(null, false);

		if (isOwn(payload)) {
			unmarkSource(payload.key);
		}

		end(getGhostKey(payload));
	}

	function resolveSource(hit: Element): DragSourceItem | null {
		const container = toValue(options.container);
		const key = container && !keyboard ? findKey(hit, container) : null;
		const element = key === null ? undefined : elements.get(key);

		return key === null || !element || !mayDrag(key) ? null : { element, payload: createPayload(key) };
	}

	function getPreview(item: DragSourceItem) {
		const { preview } = options;

		if (!preview) {
			ghostLands = false;

			return null;
		}

		const exit = toValue(preview.exit) ?? 'fade';

		ghostLands = exit === 'land';

		return {
			render: (container: HTMLElement) => preview.render(item.payload.key, container),
			placement: toValue(preview.placement) ?? 'outside',
			exit,
		};
	}

	function describe(key: string, destination: DragDestination): DragAnnouncement {
		return {
			item: getLabel(key),
			...describeDestination(tree, key, destination),
			parent: destination.parent === null ? null : getLabel(destination.parent),
		};
	}

	function reveal(key: string) {
		if (options.reveal) {
			options.reveal(key);
		} else {
			elements.get(key)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		}
	}

	function cancelOnPointer() {
		endKeyboard(false);
	}

	function pickUp(key: string) {
		const keys = toValue(options.keys);
		const payload = createPayload(key);

		keyboard = {
			payload,
			slots: collectDropSlots(tree, keys, key, slot => options.canDrop?.(key, slot) ?? true),
			slot: null,
			order: keys.indexOf(key),
		};

		begin(payload);
		window.addEventListener('pointerdown', cancelOnPointer, { capture: true });
		announce(getAnnouncements().pickUp(describe(key, getOwnDestination(tree, key))));
	}

	function moveTo(slot: (DropSlot & { order: number }) | undefined) {
		if (!keyboard || !slot) {
			return;
		}

		const { key } = keyboard.payload;

		keyboard.slot = slot;
		keyboard.order = slot.order;
		applyMark({ ...slot, element: elements.get(slot.key) ?? null });
		reveal(slot.key);
		announce(getAnnouncements().move(describe(key, slot)));
	}

	function restoreFocus(key: string, handleFocused: boolean) {
		void nextTick(() => {
			const container = toValue(options.container);
			const element = elements.get(key);
			const handle = getHandle();
			const focusable = handleFocused && handle ? element?.querySelector<HTMLElement>(handle) : element;

			if (focusable && !container?.contains(document.activeElement)) {
				focusable.focus({ preventScroll: true });
			}
		});
	}

	function endKeyboard(dropped: boolean) {
		const current = keyboard;

		if (!current) {
			return;
		}

		const { payload, slot } = current;
		const handle = getHandle();
		const handleFocused = handle !== undefined && document.activeElement?.closest(handle) !== null;

		keyboard = null;
		window.removeEventListener('pointerdown', cancelOnPointer, { capture: true });
		applyMark(null, false);
		unmarkSource(payload.key);
		dragging.value = null;

		if (dropped && slot) {
			options.onDrop({ key: payload.key, parent: slot.parent, index: slot.index, payload, external: false });
			announce(getAnnouncements().drop(describe(payload.key, slot)));
			restoreFocus(payload.key, handleFocused);
		} else {
			announce(getAnnouncements().cancel(describe(payload.key, getOwnDestination(tree, payload.key))));
		}

		end(null);
	}

	function getStep(event: KeyboardEvent, container: HTMLElement) {
		if (options.axis === 'vertical') {
			return VERTICAL_STEPS[event.key] ?? 0;
		}

		const reversed = getComputedStyle(container).direction === 'rtl';

		if (event.key === 'ArrowRight') {
			return reversed ? -1 : 1;
		}

		if (event.key === 'ArrowLeft') {
			return reversed ? 1 : -1;
		}

		return 0;
	}

	function findPrevious(slots: KeyboardDrag['slots'], order: number) {
		for (let index = slots.length - 1; index >= 0; index -= 1) {
			if (slots[index].order < order) {
				return slots[index];
			}
		}

		return undefined;
	}

	function handleDragKey(event: KeyboardEvent, container: HTMLElement, current: KeyboardDrag) {
		const step = getStep(event, container);

		if (step !== 0) {
			event.preventDefault();
			moveTo(step > 0
				? current.slots.find(slot => slot.order > current.order)
				: findPrevious(current.slots, current.order));
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			moveTo(event.key === 'Home' ? current.slots[0] : current.slots.at(-1));
		} else if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			endKeyboard(true);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			endKeyboard(false);
		} else if (event.key === 'Tab') {
			endKeyboard(false);
		}
	}

	/** Moves an item one place among its siblings at once, as a drop there would. */
	function stepItem(key: string, step: number) {
		const parent = tree.getParent(key);
		const siblings = tree.getChildren(parent);
		const from = siblings.indexOf(key);
		const index = from + step;

		if (from === -1 || step === 0 || index < 0 || index >= siblings.length) {
			return;
		}

		const destination: DragListTarget = {
			key: siblings[index],
			position: step > 0 ? 'after' : 'before',
			level: tree.getLevel(key),
			parent,
			index,
		};

		if (!(options.canDrop?.(key, destination) ?? true)) {
			return;
		}

		options.onDrop({ key, parent, index, payload: createPayload(key), external: false });
		announce(getAnnouncements().drop(describe(key, destination)));
		// The items are still where they were: the drop re-renders them at the next tick.
		engine = resolveEngine();
		void settle(null).then(() => reveal(key));
	}

	function handleStepKey(event: KeyboardEvent, container: HTMLElement) {
		const along = options.axis === 'vertical' ? Object.hasOwn(VERTICAL_STEPS, event.key) : HORIZONTAL_KEYS.has(event.key);
		const target = event.target as Element;
		const key = along ? findKey(target, container) : null;

		// A refused item leaves the keys to the page: the browser and the navigation still get them.
		if (key === null || isIgnored(target) || !mayDrag(key)) {
			return;
		}

		event.preventDefault();
		stepItem(key, getStep(event, container));
	}

	function handleKeydown(event: KeyboardEvent) {
		const container = toValue(options.container);

		if (!container || !(event.target instanceof Element)) {
			return;
		}

		if (keyboard) {
			handleDragKey(event, container, keyboard);

			return;
		}

		if (isDragging()) {
			return;
		}

		if (toValue(options.stepKeys) && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
			handleStepKey(event, container);

			return;
		}

		if (!isKeyboardOn() || (event.key !== ' ' && event.key !== 'Enter') || event.repeat) {
			return;
		}

		const key = findKey(event.target, container);
		const element = key === null ? undefined : elements.get(key);
		const handle = getHandle();
		const onHandle = handle ? event.target.closest(handle) !== null : event.target === element;

		if (key === null || !onHandle || isIgnored(event.target) || !mayDrag(key)) {
			return;
		}

		event.preventDefault();
		pickUp(key);
	}

	function register(element: HTMLElement, key: string) {
		elements.set(key, element);
		keysByElement.set(element, key);
		forgetLayouts();

		if (active.value === key) {
			element.setAttribute(DRAG_SOURCE_ATTRIBUTE, '');
			showSourceLevel();
		}

		if (mark?.key === key) {
			mark.element = element;
			setMark(mark);
			showIndicator();
		}

		gap.mount(key, element);

		return () => {
			keysByElement.delete(element);
			gap.unmount(element);
			forgetLayouts();

			if (elements.get(key) === element) {
				elements.delete(key);
			}

			if (mark?.element === element) {
				mark.element = null;
				showIndicator();
			}
		};
	}

	watch(() => toValue(options.container), (container, _previous, onCleanup) => {
		if (!container) {
			return;
		}

		// Getters: the source reads them when a gesture starts, so they follow the refs of the options.
		const source: DragSourceOptions = {
			get handle() {
				return getHandle();
			},
			get ignore() {
				return getIgnore();
			},
			get touchDelay() {
				return toValue(options.touchDelay);
			},
			get motion() {
				return resolveEngine();
			},
			get autoScroll() {
				return toValue(options.autoScroll);
			},
			resolve: resolveSource,
			preview: getPreview,
			bounds: () => toValue(options.bounds) ?? null,
			home: payload => land(payload.key, getGhostKey(payload)),
		};
		const unbind = bindDragSource(container, source);

		const unregister = registerDropTarget({
			element: container,
			axis: options.axis,
			accepts,
			scroller: () => toValue(options.scroller) ?? container,
			autoScroll: () => toValue(options.autoScroll),
			onStart: begin,
			onEnter: () => {
				over.value = true;
			},
			onOver: handleOver,
			onLeave: handleLeave,
			hold: true,
			onRelease: handleRelease,
			onDrop: handleDrop,
			onEnd: handleEnd,
		});

		container.addEventListener('keydown', handleKeydown);

		onCleanup(() => {
			unbind();
			unregister();
			container.removeEventListener('keydown', handleKeydown);
		});
	}, { immediate: true, flush: 'post' });

	// On the client only, once there is a container; new instructions go in when their text changes.
	watch(
		() => (toValue(options.container) && isKeyboardOn() ? getAnnouncements().instructions : null),
		(text) => {
			if (text !== null) {
				mountInstructions(text);
			}
		},
		{ immediate: true, flush: 'post' },
	);

	onScopeDispose(() => {
		window.removeEventListener('scroll', forgetLayouts, { capture: true });

		if (keyboard) {
			window.removeEventListener('pointerdown', cancelOnPointer, { capture: true });
			keyboard = null;
		}

		indicator?.destroy();
		indicator = null;
		gap.clear();
	});

	const list: DragList = { register };

	return {
		list,
		/** The key of this list's item being dragged, with the pointer or the keyboard. */
		active: shallowReadonly(active),
		/** The payload being dragged that this list accepts: its own or from the group. */
		dragging: shallowReadonly(dragging),
		/** The payload is over the list's area. */
		over: shallowReadonly(over),
		/** Where the item goes if dropped now; `null` for nowhere. */
		target: shallowReadonly(target),
		/**
		 * The id of the hidden keyboard instructions: bind it as `aria-describedby` of items or handles.
		 * It follows the text of `announcements`.
		 */
		get describedBy() {
			return getInstructionsId(getAnnouncements().instructions);
		},
	};
}
